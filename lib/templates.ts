// Email template engine with variable substitution

export interface TemplateVariables {
  hr_name: string;
  company: string;
  role: string;
  job_url?: string;
  user_name: string;
  user_phone: string;
  user_linkedin: string;
  user_github: string;
  notes?: string;
  // Professor / Academic aliases
  professor_name?: string;
  institution?: string;
  research_area?: string;
  professor_salutation?: string;
  research_area_phrase?: string;
}

// ─── Format Professor Salutation Helper ─────────────────────
export function formatProfessorSalutation(name: string): string {
  if (!name || !name.trim()) return 'Professor';
  const clean = name.trim();
  // If the name already starts with Prof., Professor, Dr., etc., keep as is
  if (/^(prof\.|dr\.|professor\b|dr\b)/i.test(clean)) {
    return clean;
  }
  return `Prof. ${clean}`;
}

// ─── Recruiter / Corporate Templates ─────────────────────────
export const DEFAULT_SUBJECT_TEMPLATE = 'Application for {{role}} at {{company}} - Paras Gupta';

export const DEFAULT_BODY_TEMPLATE = `Hi {{hr_name}},

I hope your week is off to a great start.

I am writing to express my strong interest in the {{role}} opportunity at {{company}}.

I am a Computer Science engineer specializing in AI/ML systems and modern software engineering. A quick snapshot of what I bring:
• AI & Autonomous Agents: Experience building production-grade LLM applications, retrieval-augmented systems, and intelligent workflows.
• Full-Stack & Systems: Hands-on expertise building fast, scalable APIs, database architectures, and clean user interfaces.
• High Ownership: Proven track record of taking products from concept to working code quickly with attention to detail.

{{job_url_section}}

I have attached my resume for your review. If the team is currently evaluating candidates for {{role}}, I would love the chance for a brief 10-minute conversation.

Thank you very much for your time and consideration!

Best regards,
{{user_name}}
{{user_phone}}
{{user_linkedin}}
{{user_github}}`;

export const DEFAULT_FOLLOWUP_1_SUBJECT = 'Re: Application for {{role}} at {{company}}';

export const DEFAULT_FOLLOWUP_1_BODY = `Hi {{hr_name}},

I hope you're having a productive week.

I wanted to follow up briefly on my application for the {{role}} position at {{company}} that I sent last week. I understand your schedule is very busy and inboxes fill up quickly.

I remain very excited about the work {{company}} is doing and would welcome the opportunity to discuss how my technical skills in AI/ML and software engineering can contribute to your team.

I have re-attached my resume here for your convenience. Would you or a member of the engineering team have 10 minutes for a brief chat sometime this week?

Thank you again for your time!

Best regards,
{{user_name}}
{{user_phone}}
{{user_linkedin}}
{{user_github}}`;

export const DEFAULT_FOLLOWUP_2_SUBJECT = 'Re: Application for {{role}} at {{company}}';

export const DEFAULT_FOLLOWUP_2_BODY = `Hi {{hr_name}},

I'm reaching out with a final check-in regarding the {{role}} role at {{company}}.

I know priorities and hiring roadmaps evolve. If the position has already been filled or timing isn't right at the moment, no worries at all!

If relevant opportunities open up in the future, I would be glad to stay connected. Feel free to keep my attached resume on file.

Wishing you and the entire {{company}} team continued success!

Best regards,
{{user_name}}
{{user_phone}}
{{user_linkedin}}
{{user_github}}`;

// ─── Professor / Academic Winter Research Templates ──────────
export const ACADEMIC_WINTER_SUBJECT_TEMPLATE = 'Prospective Winter Research Intern: Keen interest in your lab at {{institution}} - {{user_name}}';

export const ACADEMIC_WINTER_BODY_TEMPLATE = `Dear {{professor_salutation}},

I hope this email finds you well.

My name is {{user_name}}, an undergraduate student in Computer Science. I have been following the research work coming out of your group at {{institution}}{{research_area_phrase}}, and I am genuinely inspired by the problems your lab is tackling.

I am reaching out because I am very keen on the possibility of contributing to your research group as a winter research intern during the upcoming winter break (December – January).

A quick snapshot of my technical background and what I can bring:
• AI Systems & Deep Learning: Hands-on experience developing LLM pipelines, autonomous multi-agent architectures, and neural models.
• Systems & Software Engineering: Solid foundation in building robust full-stack software, data pipelines, and scalable APIs.
• High Motivation & Ownership: Self-driven, comfortable reading and implementing recent academic literature, and eager to put in focused hours.

I would be thrilled to assist with ongoing research experiments, model training, codebase development, or any active lab projects under your guidance.

I have attached my CV to this email for your reference. If you have any openings or potential tasks I could contribute to, I would love the chance for a brief 10-minute conversation at your convenience.

Thank you very much for your time and for considering my interest!

Sincerely,
{{user_name}}
{{user_phone}}
{{user_linkedin}}
{{user_github}}`;

export const ACADEMIC_WINTER_FOLLOWUP_1_SUBJECT = 'Re: Prospective Winter Research Intern: Keen interest in your lab at {{institution}} - {{user_name}}';

export const ACADEMIC_WINTER_FOLLOWUP_1_BODY = `Dear {{professor_salutation}},

I hope you are having a productive week.

I wanted to follow up briefly on my previous email regarding my keen interest in contributing to your research group at {{institution}} this winter. I understand your schedule is demanding and inboxes get busy with academic commitments.

I remain very excited about your group's research direction and would love the chance to apply my technical skills in AI/ML and software systems to your lab's active projects during the winter term.

I have re-attached my CV here for quick reference. Please let me know if there might be an opportunity to contribute or if you might have a few minutes for a brief chat.

Thank you again for your time and consideration!

Sincerely,
{{user_name}}
{{user_phone}}
{{user_linkedin}}
{{user_github}}`;

export const ACADEMIC_WINTER_FOLLOWUP_2_SUBJECT = 'Re: Prospective Winter Research Intern: Keen interest in your lab at {{institution}} - {{user_name}}';

export const ACADEMIC_WINTER_BODY_TEMPLATE_ALTERNATIVE_SUBJECTS = [
  'Prospective Winter Research Intern: Keen interest in your lab at {{institution}} - {{user_name}}',
  'Winter Research Internship — Eager to contribute to your group at {{institution}} ({{user_name}})',
  'Winter Research / Keen to collaborate with your research team at {{institution}} - {{user_name}}',
  'Following your work at {{institution}} — Prospective Winter Research Intern ({{user_name}})',
];

export const ACADEMIC_WINTER_FOLLOWUP_2_BODY = `Dear {{professor_salutation}},

I hope all is well.

I am sending a quick final check-in regarding potential winter research internship opportunities in your lab at {{institution}}.

If you do not have any openings for interns this winter, I completely understand and sincerely appreciate your time. I will continue following your publications and research closely.

Wishing you and your research team all the best with your ongoing work!

Sincerely,
{{user_name}}
{{user_phone}}
{{user_linkedin}}
{{user_github}}`;

// ─── Template Presets Configuration ──────────────────────────
export const TEMPLATE_PRESETS = {
  academic: {
    id: 'academic',
    name: 'Academic (Professors / Winter Research)',
    badge: '🎓 Winter Research',
    subject: ACADEMIC_WINTER_SUBJECT_TEMPLATE,
    body: ACADEMIC_WINTER_BODY_TEMPLATE,
    followup1Subject: ACADEMIC_WINTER_FOLLOWUP_1_SUBJECT,
    followup1Body: ACADEMIC_WINTER_FOLLOWUP_1_BODY,
    followup2Subject: ACADEMIC_WINTER_FOLLOWUP_2_SUBJECT,
    followup2Body: ACADEMIC_WINTER_FOLLOWUP_2_BODY,
    sampleCsvUrl: '/sample_professors.csv',
    sampleCsvName: 'sample_professors.csv',
    columnsHelp: 'Required: Professor, Institution, Official Email. Optional: Research Area, Notes',
  },
  recruiter: {
    id: 'recruiter',
    name: 'Corporate (Recruiters & HR Job Application)',
    badge: '💼 Job / Internship',
    subject: DEFAULT_SUBJECT_TEMPLATE,
    body: DEFAULT_BODY_TEMPLATE,
    followup1Subject: DEFAULT_FOLLOWUP_1_SUBJECT,
    followup1Body: DEFAULT_FOLLOWUP_1_BODY,
    followup2Subject: DEFAULT_FOLLOWUP_2_SUBJECT,
    followup2Body: DEFAULT_FOLLOWUP_2_BODY,
    sampleCsvUrl: '/sample_contacts.csv',
    sampleCsvName: 'sample_contacts.csv',
    columnsHelp: 'Required: HR Name, HR Email, Company Name, Role. Optional: Job URL, Notes',
  },
};

export function generateFollowupSubject(step: 1 | 2, customTemplate?: string, vars?: TemplateVariables): string {
  const tpl = customTemplate || (step === 1 ? DEFAULT_FOLLOWUP_1_SUBJECT : DEFAULT_FOLLOWUP_2_SUBJECT);
  return vars ? replaceVariables(tpl, vars) : tpl;
}

export function generateFollowupBody(step: 1 | 2, customTemplate?: string, vars?: TemplateVariables): string {
  const tpl = customTemplate || (step === 1 ? DEFAULT_FOLLOWUP_1_BODY : DEFAULT_FOLLOWUP_2_BODY);
  return vars ? generateBody(tpl, vars) : tpl;
}

export function generateSubject(template: string, vars: TemplateVariables): string {
  return replaceVariables(template, vars);
}

export function generateBody(template: string, vars: TemplateVariables): string {
  // Handle job_url_section specially
  let body = template;
  
  if (vars.job_url && vars.job_url.trim()) {
    body = body.replace(/\{\{job_url_section\}\}/g, `Job reference: ${vars.job_url}`);
  } else {
    body = body.replace(/\{\{job_url_section\}\}/g, '');
  }

  body = replaceVariables(body, vars);

  // Clean up double blank lines
  body = body.replace(/\n{3,}/g, '\n\n');

  return body.trim();
}

function replaceVariables(text: string, vars: TemplateVariables): string {
  const profName = vars.professor_name || vars.hr_name || '';
  const profSalutation = vars.professor_salutation || formatProfessorSalutation(profName);
  const institution = vars.institution || vars.company || '';
  const researchArea = vars.research_area || vars.role || '';
  
  const researchPhrase = vars.research_area_phrase !== undefined
    ? vars.research_area_phrase
    : (researchArea && researchArea.toLowerCase() !== 'winter research internship'
        ? `, particularly regarding ${researchArea}`
        : '');

  return text
    // Professor / Academic variables
    .replace(/\{\{professor_salutation\}\}/g, profSalutation)
    .replace(/\{\{professor_name\}\}/g, profName)
    .replace(/\{\{institution\}\}/g, institution)
    .replace(/\{\{research_area\}\}/g, researchArea)
    .replace(/\{\{research_area_phrase\}\}/g, researchPhrase)
    // Recruiter / Corporate variables
    .replace(/\{\{hr_name\}\}/g, vars.hr_name)
    .replace(/\{\{company\}\}/g, vars.company)
    .replace(/\{\{role\}\}/g, vars.role)
    .replace(/\{\{job_url\}\}/g, vars.job_url || '')
    // Common user details
    .replace(/\{\{user_name\}\}/g, vars.user_name)
    .replace(/\{\{user_phone\}\}/g, vars.user_phone)
    .replace(/\{\{user_linkedin\}\}/g, vars.user_linkedin)
    .replace(/\{\{user_github\}\}/g, vars.user_github)
    .replace(/\{\{notes\}\}/g, vars.notes || '');
}

export function bodyToHtml(plainText: string): string {
  // Convert plain text to HTML preserving line breaks and links
  let html = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color: #2563eb;">$1</a>'
    );

  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.6;">${html}</div>`;
}

export function validateTemplate(template: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for personalization
  const hasName = template.includes('{{hr_name}}') || template.includes('{{professor_name}}') || template.includes('{{professor_salutation}}');
  if (!hasName) {
    warnings.push('Template does not include recipient name variable ({{hr_name}} or {{professor_salutation}}).');
  }

  const hasOrg = template.includes('{{company}}') || template.includes('{{institution}}');
  if (!hasOrg) {
    warnings.push('Template does not mention company or institution ({{company}} or {{institution}}).');
  }

  return { valid: warnings.length === 0, warnings };
}
