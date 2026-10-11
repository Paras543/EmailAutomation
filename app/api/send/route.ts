import { NextRequest, NextResponse } from 'next/server';
import {
  getContactsByCampaign,
  updateContactStatus,
  updateCampaign,
  getCampaign,
  recordSentEmail,
  getCampaignStats,
  updateContact,
} from '@/lib/db';
import { sendEmail } from '@/lib/gmail';
import { bodyToHtml } from '@/lib/templates';
import fs from 'fs';

// In-memory campaign state for pause/cancel
const campaignStates = new Map<string, 'running' | 'paused' | 'cancelled'>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaign_id, contact_ids } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    const campaign = getCampaign(campaign_id) as Record<string, unknown> | undefined;
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify resume exists
    const resumePath = campaign.resume_path as string;
    const resumeFilename = campaign.resume_filename as string;

    if (resumePath && !fs.existsSync(resumePath)) {
      return NextResponse.json(
        { error: `Resume file not found at: ${resumePath}` },
        { status: 400 }
      );
    }

    // Get contacts to send
    const allContacts = getContactsByCampaign(campaign_id) as Array<Record<string, unknown>>;
    let contactsToSend = allContacts.filter(c => {
      if (contact_ids && contact_ids.length > 0) {
        return contact_ids.includes(c.id) && c.is_selected && c.status !== 'sent' && c.status !== 'sending';
      }
      return c.is_selected && (c.status === 'ready' || c.status === 'draft') && !c.is_duplicate;
    });

    if (contactsToSend.length === 0) {
      return NextResponse.json({ error: 'No contacts selected for sending' }, { status: 400 });
    }

    // Check max per campaign limit
    const maxPerCampaign = (campaign.max_per_campaign as number) || 50;
    if (contactsToSend.length > maxPerCampaign) {
      return NextResponse.json({
        error: `Too many contacts (${contactsToSend.length}). Maximum per campaign is ${maxPerCampaign}. Please reduce the selection or increase the limit.`,
      }, { status: 400 });
    }

    const delayMs = (campaign.delay_ms as number) || 3000;

    // Set campaign as active
    campaignStates.set(campaign_id, 'running');
    updateCampaign(campaign_id, { status: 'sending' });

    // Send emails in sequence (not blocking the response)
    const sendResults = {
      sent: 0,
      failed: 0,
      skipped: 0,
      total: contactsToSend.length,
    };

    // Process emails sequentially
    for (let i = 0; i < contactsToSend.length; i++) {
      const contact = contactsToSend[i];

      // Check campaign state
      const state = campaignStates.get(campaign_id);
      if (state === 'cancelled') {
        // Mark remaining as skipped
        for (let j = i; j < contactsToSend.length; j++) {
          updateContactStatus(contactsToSend[j].id as string, 'skipped', 'Campaign cancelled');
          sendResults.skipped++;
        }
        break;
      }

      if (state === 'paused') {
        // Wait for resume or cancel
        let waitCount = 0;
        while (campaignStates.get(campaign_id) === 'paused' && waitCount < 600) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          waitCount++;
        }
        if (campaignStates.get(campaign_id) === 'cancelled') {
          for (let j = i; j < contactsToSend.length; j++) {
            updateContactStatus(contactsToSend[j].id as string, 'skipped', 'Campaign cancelled');
            sendResults.skipped++;
          }
          break;
        }
      }

      // Mark as sending
      updateContactStatus(contact.id as string, 'sending');

      const subject = (contact.edited_subject || contact.generated_subject) as string;
      const bodyText = (contact.edited_body || contact.generated_body) as string;
      const htmlBody = bodyToHtml(bodyText);

      try {
        const result = await sendEmail({
          to: contact.hr_email as string,
          subject,
          body: htmlBody,
          attachmentPath: resumePath || undefined,
          attachmentFilename: resumeFilename || undefined,
        });

        if (result.success) {
          const now = new Date();
          const delayDays = (campaign.followup_delay_days as number) || 5;
          const nextFollowupDate = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000).toISOString();
          const isFollowupActive = campaign.followup_enabled !== 0;

          updateContactStatus(contact.id as string, 'sent');
          updateContact(contact.id as string, {
            sent_at: now.toISOString(),
            gmail_message_id: result.messageId || null,
            gmail_thread_id: result.threadId || null,
            followup_count: 0,
            followup_status: isFollowupActive ? 'scheduled' : 'none',
            next_followup_at: isFollowupActive ? nextFollowupDate : null,
          });
          recordSentEmail({
            recipient_email: contact.hr_email as string,
            company_name: contact.company_name as string,
            role: contact.role as string,
            subject,
            campaign_id,
            contact_id: contact.id as string,
            gmail_message_id: result.messageId,
          });
          sendResults.sent++;
        } else {
          updateContactStatus(contact.id as string, 'failed', result.error);
          sendResults.failed++;

          // If Gmail blocks sending, stop the campaign
          if (result.error?.includes('rate limit') ||
              result.error?.includes('quota') ||
              result.error?.includes('blocked') ||
              result.error?.includes('PERMISSION_DENIED')) {
            for (let j = i + 1; j < contactsToSend.length; j++) {
              updateContactStatus(contactsToSend[j].id as string, 'skipped', `Campaign stopped: ${result.error}`);
              sendResults.skipped++;
            }
            updateCampaign(campaign_id, {
              status: 'stopped',
            });
            break;
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        updateContactStatus(contact.id as string, 'failed', errMsg);
        sendResults.failed++;
      }

      // Delay between emails
      if (i < contactsToSend.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Update campaign stats
    const finalStats = getCampaignStats(campaign_id);
    const failedCnt = (finalStats as Record<string, number>)?.failed || 0;
    const sentCnt = (finalStats as Record<string, number>)?.sent || 0;
    
    let finalStatus = 'completed';
    if (sentCnt === 0 && failedCnt > 0) {
      finalStatus = 'failed';
    }

    updateCampaign(campaign_id, {
      status: finalStatus,
      sent_count: sentCnt,
      failed_count: failedCnt,
      skipped_count: (finalStats as Record<string, number>)?.skipped || 0,
      duplicate_count: (finalStats as Record<string, number>)?.duplicates || 0,
    });

    campaignStates.delete(campaign_id);

    return NextResponse.json({
      success: true,
      results: sendResults,
    });
  } catch (error: unknown) {
    console.error('Send error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Pause/Resume/Cancel campaign
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaign_id, action } = body;

    if (!campaign_id || !action) {
      return NextResponse.json({ error: 'campaign_id and action are required' }, { status: 400 });
    }

    switch (action) {
      case 'pause':
        campaignStates.set(campaign_id, 'paused');
        updateCampaign(campaign_id, { status: 'paused' });
        return NextResponse.json({ success: true, status: 'paused' });

      case 'resume':
        campaignStates.set(campaign_id, 'running');
        updateCampaign(campaign_id, { status: 'sending' });
        return NextResponse.json({ success: true, status: 'running' });

      case 'cancel':
        campaignStates.set(campaign_id, 'cancelled');
        updateCampaign(campaign_id, { status: 'cancelled' });
        return NextResponse.json({ success: true, status: 'cancelled' });

      default:
        return NextResponse.json({ error: 'Invalid action. Use: pause, resume, cancel' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Campaign control error:', error);
    return NextResponse.json({ error: 'Failed to update campaign state' }, { status: 500 });
  }
}
