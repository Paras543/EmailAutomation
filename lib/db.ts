import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'data', 'outreach.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_subject TEXT,
    template_body TEXT,
    resume_filename TEXT,
    resume_path TEXT,
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    gmail_account TEXT,
    delay_ms INTEGER DEFAULT 3000,
    max_per_campaign INTEGER DEFAULT 50,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    hr_name TEXT NOT NULL,
    hr_email TEXT NOT NULL,
    company_name TEXT NOT NULL,
    role TEXT NOT NULL,
    job_url TEXT,
    notes TEXT,
    generated_subject TEXT,
    generated_body TEXT,
    edited_subject TEXT,
    edited_body TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    error_message TEXT,
    is_selected INTEGER DEFAULT 1,
    is_duplicate INTEGER DEFAULT 0,
    duplicate_reason TEXT,
    sent_at TEXT,
    row_number INTEGER,
    validation_errors TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sent_emails (
    id TEXT PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    company_name TEXT,
    role TEXT,
    subject TEXT,
    campaign_id TEXT,
    contact_id TEXT,
    gmail_message_id TEXT,
    sent_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY DEFAULT 'default',
    access_token TEXT,
    refresh_token TEXT,
    expiry_date TEXT,
    gmail_address TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_sent_emails_recipient ON sent_emails(recipient_email);
  CREATE INDEX IF NOT EXISTS idx_sent_emails_role ON sent_emails(recipient_email, role);
`);

// ─── Migrations for Follow-up Features ───────────────────────────────
function runMigrations() {
  const tableInfoContacts = db.prepare("PRAGMA table_info(contacts)").all() as Array<{ name: string }>;
  const contactCols = new Set(tableInfoContacts.map(c => c.name));
  
  if (!contactCols.has('gmail_thread_id')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN gmail_thread_id TEXT;`);
  }
  if (!contactCols.has('gmail_message_id')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN gmail_message_id TEXT;`);
  }
  if (!contactCols.has('followup_count')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN followup_count INTEGER DEFAULT 0;`);
  }
  if (!contactCols.has('followup_status')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN followup_status TEXT DEFAULT 'none';`);
  }
  if (!contactCols.has('next_followup_at')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN next_followup_at TEXT;`);
  }
  if (!contactCols.has('last_followup_at')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN last_followup_at TEXT;`);
  }
  if (!contactCols.has('replied_at')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN replied_at TEXT;`);
  }

  const tableInfoCampaigns = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>;
  const campaignCols = new Set(tableInfoCampaigns.map(c => c.name));

  if (!campaignCols.has('followup_enabled')) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN followup_enabled INTEGER DEFAULT 1;`);
  }
  if (!campaignCols.has('followup_delay_days')) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN followup_delay_days INTEGER DEFAULT 5;`);
  }
  if (!campaignCols.has('max_followups')) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN max_followups INTEGER DEFAULT 2;`);
  }
  if (!campaignCols.has('followup_1_subject')) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN followup_1_subject TEXT;`);
  }
  if (!campaignCols.has('followup_1_body')) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN followup_1_body TEXT;`);
  }
  if (!campaignCols.has('followup_2_subject')) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN followup_2_subject TEXT;`);
  }
  if (!campaignCols.has('followup_2_body')) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN followup_2_body TEXT;`);
  }
}
runMigrations();

// ─── Campaign Operations ────────────────────────────────────────────

export function createCampaign(data: {
  name: string;
  template_subject?: string;
  template_body?: string;
  resume_filename?: string;
  resume_path?: string;
  gmail_account?: string;
  delay_ms?: number;
  max_per_campaign?: number;
  followup_enabled?: number;
  followup_delay_days?: number;
  max_followups?: number;
  followup_1_subject?: string;
  followup_1_body?: string;
  followup_2_subject?: string;
  followup_2_body?: string;
}) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO campaigns (
      id, name, template_subject, template_body, resume_filename, resume_path,
      gmail_account, delay_ms, max_per_campaign, followup_enabled, followup_delay_days,
      max_followups, followup_1_subject, followup_1_body, followup_2_subject, followup_2_body
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, data.name, data.template_subject || null, data.template_body || null,
    data.resume_filename || null, data.resume_path || null, data.gmail_account || null,
    data.delay_ms || 3000, data.max_per_campaign || 50,
    data.followup_enabled !== undefined ? data.followup_enabled : 1,
    data.followup_delay_days || 5,
    data.max_followups || 2,
    data.followup_1_subject || null,
    data.followup_1_body || null,
    data.followup_2_subject || null,
    data.followup_2_body || null
  );
  return id;
}

export function getCampaign(id: string) {
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
}

export function getAllCampaigns() {
  return db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
}

export function updateCampaign(id: string, data: Record<string, unknown>) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  db.prepare(`UPDATE campaigns SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
}

export function deleteCampaign(id: string) {
  db.prepare('DELETE FROM contacts WHERE campaign_id = ?').run(id);
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
}

// ─── Contact Operations ─────────────────────────────────────────────

export function insertContacts(campaignId: string, contacts: Array<{
  hr_name: string;
  hr_email: string;
  company_name: string;
  role: string;
  job_url?: string;
  notes?: string;
  row_number: number;
  validation_errors?: string;
}>) {
  const stmt = db.prepare(`
    INSERT INTO contacts (id, campaign_id, hr_name, hr_email, company_name, role, job_url, notes, row_number, validation_errors, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((contacts: typeof arguments[1]) => {
    for (const c of contacts) {
      const hasErrors = c.validation_errors && c.validation_errors !== '[]';
      stmt.run(
        uuidv4(), campaignId, c.hr_name, c.hr_email, c.company_name, c.role,
        c.job_url || null, c.notes || null, c.row_number,
        c.validation_errors || null,
        hasErrors ? 'invalid' : 'draft'
      );
    }
  });

  insertMany(contacts);
}

export function getContactsByCampaign(campaignId: string) {
  return db.prepare('SELECT * FROM contacts WHERE campaign_id = ? ORDER BY row_number ASC').all(campaignId);
}

export function getContact(id: string) {
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
}

export function updateContact(id: string, data: Record<string, unknown>) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  db.prepare(`UPDATE contacts SET ${fields} WHERE id = ?`).run(...values, id);
}

export function updateContactStatus(id: string, status: string, errorMessage?: string) {
  if (errorMessage) {
    db.prepare('UPDATE contacts SET status = ?, error_message = ? WHERE id = ?').run(status, errorMessage, id);
  } else {
    db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(status, id);
  }
}

// ─── Sent Email Operations ──────────────────────────────────────────

export function recordSentEmail(data: {
  recipient_email: string;
  company_name?: string;
  role?: string;
  subject?: string;
  campaign_id?: string;
  contact_id?: string;
  gmail_message_id?: string;
}) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO sent_emails (id, recipient_email, company_name, role, subject, campaign_id, contact_id, gmail_message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.recipient_email, data.company_name || null, data.role || null,
    data.subject || null, data.campaign_id || null, data.contact_id || null,
    data.gmail_message_id || null);
  return id;
}

export function findDuplicateSentEmail(email: string, role?: string) {
  if (role) {
    return db.prepare('SELECT * FROM sent_emails WHERE recipient_email = ? AND role = ? LIMIT 1').get(email, role);
  }
  return db.prepare('SELECT * FROM sent_emails WHERE recipient_email = ? LIMIT 1').get(email);
}

export function getSentEmailsByCampaign(campaignId: string) {
  return db.prepare('SELECT * FROM sent_emails WHERE campaign_id = ? ORDER BY sent_at DESC').all(campaignId);
}

// ─── OAuth Token Operations ─────────────────────────────────────────

export function saveOAuthTokens(tokens: {
  access_token: string;
  refresh_token?: string;
  expiry_date?: string;
  gmail_address?: string;
}) {
  const existing = db.prepare('SELECT * FROM oauth_tokens WHERE id = ?').get('default');
  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];
    
    if (tokens.access_token) { fields.push('access_token = ?'); values.push(tokens.access_token); }
    if (tokens.refresh_token) { fields.push('refresh_token = ?'); values.push(tokens.refresh_token); }
    if (tokens.expiry_date) { fields.push('expiry_date = ?'); values.push(tokens.expiry_date); }
    if (tokens.gmail_address) { fields.push('gmail_address = ?'); values.push(tokens.gmail_address); }
    fields.push("updated_at = datetime('now')");
    
    db.prepare(`UPDATE oauth_tokens SET ${fields.join(', ')} WHERE id = ?`).run(...values, 'default');
  } else {
    db.prepare(`
      INSERT INTO oauth_tokens (id, access_token, refresh_token, expiry_date, gmail_address)
      VALUES ('default', ?, ?, ?, ?)
    `).run(tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null, tokens.gmail_address || null);
  }
}

export function getOAuthTokens() {
  return db.prepare('SELECT * FROM oauth_tokens WHERE id = ?').get('default') as {
    access_token: string;
    refresh_token: string;
    expiry_date: string;
    gmail_address: string;
  } | undefined;
}

export function deleteOAuthTokens() {
  db.prepare('DELETE FROM oauth_tokens WHERE id = ?').run('default');
}

// ─── Stats ──────────────────────────────────────────────────────────

export function getCampaignStats(campaignId: string) {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'ready' OR status = 'draft' THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) as duplicates,
      SUM(CASE WHEN status = 'invalid' THEN 1 ELSE 0 END) as invalid,
      SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) as sending,
      SUM(CASE WHEN followup_status = 'replied' THEN 1 ELSE 0 END) as replied,
      SUM(CASE WHEN followup_status = 'scheduled' THEN 1 ELSE 0 END) as followup_scheduled,
      SUM(CASE WHEN followup_count = 1 THEN 1 ELSE 0 END) as followup_1_sent,
      SUM(CASE WHEN followup_count >= 2 THEN 1 ELSE 0 END) as followup_2_sent
    FROM contacts WHERE campaign_id = ?
  `).get(campaignId);
  return stats;
}

// ─── Follow-up Operations ───────────────────────────────────────────

export function getDueFollowups(campaignId?: string) {
  let query = `
    SELECT c.*, cmp.followup_delay_days, cmp.max_followups, cmp.resume_path, cmp.resume_filename,
           cmp.followup_1_subject, cmp.followup_1_body, cmp.followup_2_subject, cmp.followup_2_body,
           cmp.template_subject, cmp.name as campaign_name
    FROM contacts c
    JOIN campaigns cmp ON c.campaign_id = cmp.id
    WHERE c.status = 'sent'
      AND c.followup_status NOT IN ('replied', 'stopped', 'completed')
      AND c.followup_count < COALESCE(cmp.max_followups, 2)
      AND c.next_followup_at IS NOT NULL
      AND c.next_followup_at <= datetime('now')
  `;
  if (campaignId) {
    query += ` AND c.campaign_id = ?`;
    return db.prepare(query).all(campaignId);
  }
  return db.prepare(query).all();
}

export function getAllFollowupContacts(campaignId: string) {
  return db.prepare(`
    SELECT * FROM contacts
    WHERE campaign_id = ? AND status = 'sent'
    ORDER BY created_at DESC
  `).all(campaignId);
}

export function markContactReplied(contactId: string, repliedAt?: string) {
  const time = repliedAt || new Date().toISOString();
  db.prepare(`
    UPDATE contacts
    SET followup_status = 'replied',
        replied_at = ?,
        next_followup_at = NULL
    WHERE id = ?
  `).run(time, contactId);
}

export function updateContactFollowup(
  contactId: string,
  data: {
    followup_count: number;
    followup_status: string;
    next_followup_at?: string | null;
    last_followup_at?: string;
  }
) {
  db.prepare(`
    UPDATE contacts
    SET followup_count = ?,
        followup_status = ?,
        next_followup_at = ?,
        last_followup_at = ?
    WHERE id = ?
  `).run(
    data.followup_count,
    data.followup_status,
    data.next_followup_at || null,
    data.last_followup_at || new Date().toISOString(),
    contactId
  );
}

export default db;
