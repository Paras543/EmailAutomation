import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaign,
  getContact,
  getAllFollowupContacts,
  getDueFollowups,
  markContactReplied,
  updateContactFollowup,
  recordSentEmail,
} from '@/lib/db';
import { sendEmail, checkIfContactReplied } from '@/lib/gmail';
import {
  generateFollowupSubject,
  generateFollowupBody,
  bodyToHtml,
  DEFAULT_FOLLOWUP_1_SUBJECT,
  DEFAULT_FOLLOWUP_1_BODY,
  DEFAULT_FOLLOWUP_2_SUBJECT,
  DEFAULT_FOLLOWUP_2_BODY,
} from '@/lib/templates';

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaign_id');
  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
  }

  try {
    const contacts = getAllFollowupContacts(campaignId);
    const dueContacts = getDueFollowups(campaignId);

    const stats = {
      total_sent: contacts.length,
      replied: contacts.filter(c => (c as Record<string, unknown>).followup_status === 'replied').length,
      due_now: dueContacts.length,
      scheduled: contacts.filter(c => (c as Record<string, unknown>).followup_status === 'scheduled').length,
      followup_1_sent: contacts.filter(c => (c as Record<string, unknown>).followup_count === 1).length,
      followup_2_sent: contacts.filter(c => ((c as Record<string, unknown>).followup_count as number) >= 2).length,
      stopped: contacts.filter(c => (c as Record<string, unknown>).followup_status === 'stopped').length,
    };

    return NextResponse.json({ contacts, dueContacts, stats });
  } catch (error: unknown) {
    console.error('Error fetching follow-ups:', error);
    return NextResponse.json({ error: 'Failed to fetch follow-ups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, campaign_id, contact_id } = body;

    const userVars = {
      user_name: process.env.USER_NAME || 'Paras Gupta',
      user_phone: process.env.USER_PHONE || '7428065794',
      user_linkedin: process.env.USER_LINKEDIN || '',
      user_github: process.env.USER_GITHUB || '',
    };

    // ─── ACTION: Check Replies ───────────────────────────────────────
    if (action === 'check_replies') {
      if (!campaign_id) {
        return NextResponse.json({ error: 'campaign_id required' }, { status: 400 });
      }

      const contacts = getAllFollowupContacts(campaign_id);
      let newlyReplied = 0;

      for (const rawContact of contacts) {
        const c = rawContact as Record<string, unknown>;
        if (c.followup_status === 'replied') continue;

        const replyCheck = await checkIfContactReplied(
          c.hr_email as string,
          (c.sent_at as string) || undefined,
          (c.gmail_thread_id as string) || undefined
        );

        if (replyCheck.replied) {
          markContactReplied(c.id as string, replyCheck.date);
          newlyReplied++;
        }
      }

      return NextResponse.json({
        success: true,
        checked: contacts.length,
        newly_replied: newlyReplied,
      });
    }

    // ─── ACTION: Stop Follow-up ──────────────────────────────────────
    if (action === 'stop_followup') {
      if (!contact_id) {
        return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
      }
      updateContactFollowup(contact_id, {
        followup_count: 99,
        followup_status: 'stopped',
        next_followup_at: null,
      });
      return NextResponse.json({ success: true });
    }

    // ─── ACTION: Send Single Follow-up ───────────────────────────────
    if (action === 'send_single') {
      if (!contact_id) {
        return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
      }

      const contact = getContact(contact_id) as Record<string, unknown> | undefined;
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }

      const campaign = getCampaign(contact.campaign_id as string) as Record<string, unknown> | undefined;
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      // Check if contact already replied
      const replyCheck = await checkIfContactReplied(
        contact.hr_email as string,
        (contact.sent_at as string) || undefined,
        (contact.gmail_thread_id as string) || undefined
      );

      if (replyCheck.replied) {
        markContactReplied(contact.id as string, replyCheck.date);
        return NextResponse.json({
          success: false,
          error: 'Recipient has already replied! Follow-up was stopped.',
          replied: true,
        });
      }

      const currentCount = (contact.followup_count as number) || 0;
      if (currentCount >= 2) {
        return NextResponse.json({ error: 'Maximum follow-ups (2) already sent.' }, { status: 400 });
      }

      const nextStep = (currentCount + 1) as 1 | 2;
      const customSubject = nextStep === 1
        ? (campaign.followup_1_subject as string) || DEFAULT_FOLLOWUP_1_SUBJECT
        : (campaign.followup_2_subject as string) || DEFAULT_FOLLOWUP_2_SUBJECT;
      const customBody = nextStep === 1
        ? (campaign.followup_1_body as string) || DEFAULT_FOLLOWUP_1_BODY
        : (campaign.followup_2_body as string) || DEFAULT_FOLLOWUP_2_BODY;

      const vars = {
        ...userVars,
        hr_name: contact.hr_name as string,
        company: contact.company_name as string,
        role: contact.role as string,
        job_url: (contact.job_url as string) || undefined,
        notes: (contact.notes as string) || undefined,
      };

      const originalSubject = (contact.edited_subject || contact.generated_subject || '') as string;
      const subject = customSubject.includes('{{')
        ? generateFollowupSubject(nextStep, customSubject, vars)
        : (originalSubject ? `Re: ${originalSubject.replace(/^Re:\s*/i, '')}` : customSubject);

      const bodyText = generateFollowupBody(nextStep, customBody, vars);
      const htmlBody = bodyToHtml(bodyText);

      const sendResult = await sendEmail({
        to: contact.hr_email as string,
        subject,
        body: htmlBody,
        attachmentPath: (campaign.resume_path as string) || undefined,
        attachmentFilename: (campaign.resume_filename as string) || undefined,
        threadId: (contact.gmail_thread_id as string) || undefined,
        inReplyTo: (contact.gmail_message_id as string) || undefined,
      });

      if (!sendResult.success) {
        return NextResponse.json({ error: sendResult.error || 'Failed to send follow-up' }, { status: 500 });
      }

      const delayDays = (campaign.followup_delay_days as number) || 5;
      const nextFollowupDate = nextStep === 1
        ? new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      updateContactFollowup(contact.id as string, {
        followup_count: nextStep,
        followup_status: nextStep === 1 ? 'scheduled' : 'completed',
        next_followup_at: nextFollowupDate,
        last_followup_at: new Date().toISOString(),
      });

      recordSentEmail({
        recipient_email: contact.hr_email as string,
        company_name: contact.company_name as string,
        role: contact.role as string,
        subject,
        campaign_id: campaign.id as string,
        contact_id: contact.id as string,
        gmail_message_id: sendResult.messageId,
      });

      return NextResponse.json({
        success: true,
        followup_sent: nextStep,
        next_followup_at: nextFollowupDate,
      });
    }

    // ─── ACTION: Send All Due Follow-ups ──────────────────────────────
    if (action === 'send_due') {
      const due = getDueFollowups(campaign_id);
      const results = {
        processed: 0,
        sent: 0,
        replied_skipped: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const rawContact of due) {
        const contact = rawContact as Record<string, unknown>;
        results.processed++;

        // 1. Double-check if contact replied before sending
        const replyCheck = await checkIfContactReplied(
          contact.hr_email as string,
          (contact.sent_at as string) || undefined,
          (contact.gmail_thread_id as string) || undefined
        );

        if (replyCheck.replied) {
          markContactReplied(contact.id as string, replyCheck.date);
          results.replied_skipped++;
          continue;
        }

        const currentCount = (contact.followup_count as number) || 0;
        const nextStep = (currentCount + 1) as 1 | 2;
        const customSubject = nextStep === 1
          ? (contact.followup_1_subject as string) || DEFAULT_FOLLOWUP_1_SUBJECT
          : (contact.followup_2_subject as string) || DEFAULT_FOLLOWUP_2_SUBJECT;
        const customBody = nextStep === 1
          ? (contact.followup_1_body as string) || DEFAULT_FOLLOWUP_1_BODY
          : (contact.followup_2_body as string) || DEFAULT_FOLLOWUP_2_BODY;

        const vars = {
          ...userVars,
          hr_name: contact.hr_name as string,
          company: contact.company_name as string,
          role: contact.role as string,
          job_url: (contact.job_url as string) || undefined,
          notes: (contact.notes as string) || undefined,
        };

        const originalSubject = (contact.edited_subject || contact.generated_subject || '') as string;
        const subject = customSubject.includes('{{')
          ? generateFollowupSubject(nextStep, customSubject, vars)
          : (originalSubject ? `Re: ${originalSubject.replace(/^Re:\s*/i, '')}` : customSubject);

        const bodyText = generateFollowupBody(nextStep, customBody, vars);
        const htmlBody = bodyToHtml(bodyText);

        try {
          const sendResult = await sendEmail({
            to: contact.hr_email as string,
            subject,
            body: htmlBody,
            attachmentPath: (contact.resume_path as string) || undefined,
            attachmentFilename: (contact.resume_filename as string) || undefined,
            threadId: (contact.gmail_thread_id as string) || undefined,
            inReplyTo: (contact.gmail_message_id as string) || undefined,
          });

          if (sendResult.success) {
            const delayDays = (contact.followup_delay_days as number) || 5;
            const nextFollowupDate = nextStep === 1
              ? new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString()
              : null;

            updateContactFollowup(contact.id as string, {
              followup_count: nextStep,
              followup_status: nextStep === 1 ? 'scheduled' : 'completed',
              next_followup_at: nextFollowupDate,
              last_followup_at: new Date().toISOString(),
            });

            recordSentEmail({
              recipient_email: contact.hr_email as string,
              company_name: contact.company_name as string,
              role: contact.role as string,
              subject,
              campaign_id: contact.campaign_id as string,
              contact_id: contact.id as string,
              gmail_message_id: sendResult.messageId,
            });

            results.sent++;
          } else {
            results.failed++;
            results.errors.push(`${contact.hr_email}: ${sendResult.error}`);
          }
        } catch (err: unknown) {
          results.failed++;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`${contact.hr_email}: ${msg}`);
        }

        // Polite delay between emails
        await new Promise(res => setTimeout(res, 2000));
      }

      return NextResponse.json({
        success: true,
        results,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Follow-up handler error:', error);
    const message = error instanceof Error ? error.message : 'Follow-up operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
