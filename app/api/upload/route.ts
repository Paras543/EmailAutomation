import { NextRequest, NextResponse } from 'next/server';
import { parseCSVContent, parseExcelBuffer, detectDuplicatesInList } from '@/lib/parser';
import { insertContacts, updateCampaign, findDuplicateSentEmail } from '@/lib/db';
import { checkSentMailForDuplicate } from '@/lib/gmail';
import {
  generateSubject,
  generateBody,
  DEFAULT_SUBJECT_TEMPLATE,
  DEFAULT_BODY_TEMPLATE,
} from '@/lib/templates';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const campaignId = formData.get('campaign_id') as string;
    const subjectTemplate = (formData.get('subject_template') as string) || DEFAULT_SUBJECT_TEMPLATE;
    const bodyTemplate = (formData.get('body_template') as string) || DEFAULT_BODY_TEMPLATE;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    let parseResult;

    if (fileName.endsWith('.csv')) {
      const content = await file.text();
      parseResult = parseCSVContent(content);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      parseResult = parseExcelBuffer(buffer);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload a CSV or Excel file.' },
        { status: 400 }
      );
    }

    // Detect duplicates within the uploaded list
    const inListDuplicates = detectDuplicatesInList(parseResult.contacts);

    // Check against previously sent emails and Gmail sent folder
    const userVars = {
      user_name: process.env.USER_NAME || '',
      user_phone: process.env.USER_PHONE || '',
      user_linkedin: process.env.USER_LINKEDIN || '',
      user_github: process.env.USER_GITHUB || '',
    };

    const contactsWithEmails = [];

    for (const contact of parseResult.contacts) {
      // Generate email content
      const vars = {
        ...userVars,
        hr_name: contact.hr_name,
        company: contact.company_name,
        role: contact.role,
        job_url: contact.job_url,
        notes: contact.notes,
        professor_name: contact.hr_name,
        institution: contact.company_name,
        research_area: contact.role,
      };

      const generatedSubject = generateSubject(subjectTemplate, vars);
      const generatedBody = generateBody(bodyTemplate, vars);

      // Check for duplicates
      let isDuplicate = false;
      let duplicateReason = '';

      if (inListDuplicates.has(contact.row_number)) {
        isDuplicate = true;
        duplicateReason = inListDuplicates.get(contact.row_number)!;
      } else if (contact.validation_errors.length === 0) {
        // Check local DB
        const dbDuplicate = findDuplicateSentEmail(contact.hr_email, contact.role);
        if (dbDuplicate) {
          isDuplicate = true;
          duplicateReason = `Previously sent: email to ${contact.hr_email} for ${contact.role}`;
        } else {
          // Check Gmail sent folder (optional, may be slow)
          try {
            const gmailDuplicate = await checkSentMailForDuplicate(contact.hr_email, contact.role);
            if (gmailDuplicate) {
              isDuplicate = true;
              duplicateReason = `Found in Gmail sent mail: previous email to ${contact.hr_email} about ${contact.role}`;
            }
          } catch {
            // If Gmail check fails, continue without marking as duplicate
          }
        }
      }

      contactsWithEmails.push({
        hr_name: contact.hr_name,
        hr_email: contact.hr_email,
        company_name: contact.company_name,
        role: contact.role,
        job_url: contact.job_url,
        notes: contact.notes,
        row_number: contact.row_number,
        validation_errors: JSON.stringify(contact.validation_errors),
        generated_subject: generatedSubject,
        generated_body: generatedBody,
        is_duplicate: isDuplicate,
        duplicate_reason: duplicateReason,
        status: isDuplicate ? 'duplicate' : (contact.validation_errors.length > 0 ? 'invalid' : 'ready'),
      });
    }

    // Insert all contacts into DB
    insertContacts(campaignId, contactsWithEmails.map(c => ({
      hr_name: c.hr_name,
      hr_email: c.hr_email,
      company_name: c.company_name,
      role: c.role,
      job_url: c.job_url,
      notes: c.notes,
      row_number: c.row_number,
      validation_errors: c.validation_errors,
    })));

    // Now update generated emails and duplicate status on the inserted contacts
    const { getContactsByCampaign, updateContact: updateContactFn } = await import('@/lib/db');
    const insertedContacts = getContactsByCampaign(campaignId) as Array<{id: string; row_number: number}>;

    for (const inserted of insertedContacts) {
      const original = contactsWithEmails.find(c => c.row_number === inserted.row_number);
      if (original) {
        updateContactFn(inserted.id, {
          generated_subject: original.generated_subject,
          generated_body: original.generated_body,
          is_duplicate: original.is_duplicate ? 1 : 0,
          duplicate_reason: original.duplicate_reason || null,
          status: original.status,
        });
      }
    }

    // Update campaign counts
    updateCampaign(campaignId, {
      total_contacts: parseResult.totalRows,
      status: 'review',
    });

    return NextResponse.json({
      success: true,
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      invalidRows: parseResult.invalidRows,
      duplicates: contactsWithEmails.filter(c => c.is_duplicate).length,
      parseErrors: parseResult.errors,
    });
  } catch (error: unknown) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
