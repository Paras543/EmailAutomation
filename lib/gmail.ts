import { google, gmail_v1 } from 'googleapis';
import { getOAuthTokens, saveOAuthTokens } from './db';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function getAuthenticatedClient() {
  const tokens = getOAuthTokens();
  if (!tokens) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ? parseInt(tokens.expiry_date) : undefined,
  });

  // Auto-refresh token if expired
  oauth2Client.on('tokens', (newTokens) => {
    saveOAuthTokens({
      access_token: newTokens.access_token!,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expiry_date: newTokens.expiry_date?.toString(),
    });
  });

  return oauth2Client;
}

export async function getGmailService(): Promise<gmail_v1.Gmail | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;
  return google.gmail({ version: 'v1', auth });
}

export async function getUserProfile() {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;

  const oauth2 = google.oauth2({ version: 'v2', auth });
  const { data } = await oauth2.userinfo.get();
  return data;
}

function createRawEmail(options: {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachmentPath?: string;
  attachmentFilename?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const replyHeaders = [
    options.inReplyTo ? `In-Reply-To: <${options.inReplyTo}>` : '',
    options.references ? `References: <${options.references}>` : (options.inReplyTo ? `References: <${options.inReplyTo}>` : ''),
  ].filter(Boolean);

  let rawEmail = '';

  if (options.attachmentPath && options.attachmentFilename) {
    const fs = require('fs');
    const attachmentData = fs.readFileSync(options.attachmentPath);
    const attachmentBase64 = attachmentData.toString('base64');

    rawEmail = [
      `MIME-Version: 1.0`,
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      ...replyHeaders,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      options.body,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${options.attachmentFilename}"`,
      `Content-Disposition: attachment; filename="${options.attachmentFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      attachmentBase64,
      ``,
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    rawEmail = [
      `MIME-Version: 1.0`,
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      ...replyHeaders,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      options.body,
    ].join('\r\n');
  }

  return Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
  attachmentFilename?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ success: boolean; messageId?: string; threadId?: string; error?: string }> {
  try {
    const gmail = await getGmailService();
    if (!gmail) {
      return { success: false, error: 'Gmail not connected. Please authenticate first.' };
    }

    const tokens = getOAuthTokens();
    const fromEmail = tokens?.gmail_address || process.env.USER_EMAIL || '';

    // Verify attachment exists if specified
    if (options.attachmentPath) {
      const fs = require('fs');
      if (!fs.existsSync(options.attachmentPath)) {
        return { success: false, error: `Resume file not found: ${options.attachmentPath}` };
      }
    }

    const raw = createRawEmail({
      to: options.to,
      from: fromEmail,
      subject: options.subject,
      body: options.body,
      attachmentPath: options.attachmentPath,
      attachmentFilename: options.attachmentFilename,
      threadId: options.threadId,
      inReplyTo: options.inReplyTo,
      references: options.references,
    });

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: options.threadId || undefined,
      },
    });

    return {
      success: true,
      messageId: response.data.id || undefined,
      threadId: response.data.threadId || undefined,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error sending email';
    console.error('Gmail send error:', errMsg);
    return { success: false, error: errMsg };
  }
}

export async function checkIfContactReplied(
  recipientEmail: string,
  sentAfterIso?: string,
  threadId?: string
): Promise<{ replied: boolean; messageId?: string; snippet?: string; date?: string }> {
  try {
    const gmail = await getGmailService();
    if (!gmail) return { replied: false };

    const tokens = getOAuthTokens();
    const myEmail = (tokens?.gmail_address || process.env.USER_EMAIL || '').toLowerCase();

    // 1. Check thread if threadId is provided
    if (threadId) {
      try {
        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'metadata',
          metadataHeaders: ['From', 'Date'],
        });

        if (thread.data.messages && thread.data.messages.length > 1) {
          const sentAfterTime = sentAfterIso ? new Date(sentAfterIso).getTime() : 0;
          for (const msg of thread.data.messages) {
            const internalDate = parseInt(msg.internalDate || '0', 10);
            if (internalDate > sentAfterTime) {
              const headers = msg.payload?.headers || [];
              const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
              if (!fromHeader.toLowerCase().includes(myEmail) && (fromHeader.toLowerCase().includes(recipientEmail.toLowerCase()) || !myEmail)) {
                return {
                  replied: true,
                  messageId: msg.id || undefined,
                  snippet: msg.snippet || undefined,
                  date: new Date(internalDate).toISOString(),
                };
              }
            }
          }
        }
      } catch (threadErr) {
        console.warn('Could not check thread, falling back to query search:', threadErr);
      }
    }

    // 2. Query search: messages from recipient
    const query = `from:${recipientEmail}`;
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 5,
    });

    if (listRes.data.messages && listRes.data.messages.length > 0) {
      const sentAfterTime = sentAfterIso ? new Date(sentAfterIso).getTime() : 0;
      for (const msgRef of listRes.data.messages) {
        if (!msgRef.id) continue;
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: msgRef.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Date'],
        });
        const internalDate = parseInt(msg.data.internalDate || '0', 10);
        // If message was received after our outreach email, it's a reply!
        if (internalDate > sentAfterTime) {
          return {
            replied: true,
            messageId: msg.data.id || undefined,
            snippet: msg.data.snippet || undefined,
            date: new Date(internalDate).toISOString(),
          };
        }
      }
    }

    return { replied: false };
  } catch (err) {
    console.error('Error checking if contact replied:', err);
    return { replied: false };
  }
}

export async function checkSentMailForDuplicate(email: string, role?: string): Promise<boolean> {
  try {
    const gmail = await getGmailService();
    if (!gmail) return false;

    // Search sent mail for emails to this recipient
    let query = `to:${email} in:sent`;
    if (role) {
      query += ` subject:"${role}"`;
    }

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 1,
    });

    return (response.data.resultSizeEstimate || 0) > 0;
  } catch {
    return false;
  }
}
