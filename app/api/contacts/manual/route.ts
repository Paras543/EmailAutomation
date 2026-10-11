import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { insertContacts, updateCampaign, findDuplicateSentEmail, getContactsByCampaign, updateContact as updateContactFn } from '@/lib/db';
import { checkSentMailForDuplicate } from '@/lib/gmail';
import { generateSubject, generateBody, DEFAULT_SUBJECT_TEMPLATE, DEFAULT_BODY_TEMPLATE } from '@/lib/templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaign_id, contacts: manualContacts, subject_template, body_template } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    if (!manualContacts || !Array.isArray(manualContacts) || manualContacts.length === 0) {
      return NextResponse.json({ error: 'At least one contact is required' }, { status: 400 });
    }

    const subjectTmpl = subject_template || DEFAULT_SUBJECT_TEMPLATE;
    const bodyTmpl = body_template || DEFAULT_BODY_TEMPLATE;

    const userVars = {
      user_name: process.env.USER_NAME || '',
      user_phone: process.env.USER_PHONE || '',
      user_linkedin: process.env.USER_LINKEDIN || '',
      user_github: process.env.USER_GITHUB || '',
    };

    // Validate contacts
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 0; i < manualContacts.length; i++) {
      const c = manualContacts[i];
      if (!c.hr_name?.trim()) errors.push(`Contact ${i + 1}: Name / Professor is required`);
      if (!c.hr_email?.trim()) errors.push(`Contact ${i + 1}: Email is required`);
      else if (!emailRegex.test(c.hr_email.trim())) errors.push(`Contact ${i + 1}: Invalid email format`);
      if (!c.company_name?.trim()) errors.push(`Contact ${i + 1}: Company / Institution is required`);
      // Default role if not provided
      if (!c.role?.trim()) {
        c.role = 'Winter Research Internship';
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    // Detect duplicates within list
    const seenEmails = new Map<string, number>();
    const processedContacts = [];

    for (let i = 0; i < manualContacts.length; i++) {
      const c = manualContacts[i];
      const email = c.hr_email.trim().toLowerCase();
      const role = (c.role || 'Winter Research Internship').trim();

      const vars = {
        ...userVars,
        hr_name: c.hr_name.trim(),
        company: c.company_name.trim(),
        role: role,
        job_url: c.job_url?.trim() || '',
        notes: c.notes?.trim() || '',
        professor_name: c.hr_name.trim(),
        institution: c.company_name.trim(),
        research_area: role,
      };

      const generatedSubject = generateSubject(subjectTmpl, vars);
      const generatedBody = generateBody(bodyTmpl, vars);

      let isDuplicate = false;
      let duplicateReason = '';

      // Check in-list duplicate
      const key = `${email}|${role.toLowerCase()}`;
      if (seenEmails.has(key)) {
        isDuplicate = true;
        duplicateReason = `Duplicate: same email and role as contact ${seenEmails.get(key)! + 1}`;
      } else {
        seenEmails.set(key, i);

        // Check local DB
        const dbDuplicate = findDuplicateSentEmail(email, role);
        if (dbDuplicate) {
          isDuplicate = true;
          duplicateReason = `Previously sent: email to ${email} for ${role}`;
        } else {
          try {
            const gmailDuplicate = await checkSentMailForDuplicate(email, role);
            if (gmailDuplicate) {
              isDuplicate = true;
              duplicateReason = `Found in Gmail sent mail: previous email to ${email} about ${role}`;
            }
          } catch { /* continue */ }
        }
      }

      processedContacts.push({
        hr_name: c.hr_name.trim(),
        hr_email: email,
        company_name: c.company_name.trim(),
        role: role,
        job_url: c.job_url?.trim() || '',
        notes: c.notes?.trim() || '',
        row_number: i + 1,
        validation_errors: '[]',
        generated_subject: generatedSubject,
        generated_body: generatedBody,
        is_duplicate: isDuplicate,
        duplicate_reason: duplicateReason,
        status: isDuplicate ? 'duplicate' : 'ready',
      });
    }

    // Insert contacts
    insertContacts(campaign_id, processedContacts.map(c => ({
      hr_name: c.hr_name,
      hr_email: c.hr_email,
      company_name: c.company_name,
      role: c.role,
      job_url: c.job_url,
      notes: c.notes,
      row_number: c.row_number,
      validation_errors: c.validation_errors,
    })));

    // Update with generated emails and duplicate info
    const insertedContacts = getContactsByCampaign(campaign_id) as Array<{ id: string; row_number: number }>;
    for (const inserted of insertedContacts) {
      const original = processedContacts.find(c => c.row_number === inserted.row_number);
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

    // Update campaign
    updateCampaign(campaign_id, {
      total_contacts: manualContacts.length,
      status: 'review',
    });

    return NextResponse.json({
      success: true,
      totalRows: manualContacts.length,
      validRows: manualContacts.length,
      invalidRows: 0,
      duplicates: processedContacts.filter(c => c.is_duplicate).length,
    });
  } catch (error: unknown) {
    console.error('Manual contact error:', error);
    const message = error instanceof Error ? error.message : 'Failed to add contacts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
