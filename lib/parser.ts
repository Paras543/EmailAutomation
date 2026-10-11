import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedContact {
  hr_name: string;
  hr_email: string;
  company_name: string;
  role: string;
  job_url: string;
  notes: string;
  row_number: number;
  validation_errors: string[];
}

export interface ParseResult {
  contacts: ParsedContact[];
  errors: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

// Column name mapping - handles various header formats for recruiters and professors
const COLUMN_MAP: Record<string, string> = {
  // Recruiter / Contact Name
  'hr name': 'hr_name',
  'hr_name': 'hr_name',
  'hrname': 'hr_name',
  'name': 'hr_name',
  'recruiter name': 'hr_name',
  'recruiter': 'hr_name',
  'contact name': 'hr_name',

  // Professor / Academic Name
  'professor': 'hr_name',
  'prof': 'hr_name',
  'professor name': 'hr_name',
  'prof name': 'hr_name',
  'proffessor': 'hr_name',
  'faculty': 'hr_name',
  'faculty name': 'hr_name',
  'supervisor': 'hr_name',
  'mentor': 'hr_name',
  'pi': 'hr_name',
  'instructor': 'hr_name',

  // Recruiter / General Email
  'hr email': 'hr_email',
  'hr_email': 'hr_email',
  'hremail': 'hr_email',
  'email': 'hr_email',
  'recruiter email': 'hr_email',
  'contact email': 'hr_email',
  'email address': 'hr_email',
  'mail': 'hr_email',

  // Professor Official Email
  'official email': 'hr_email',
  'offical email': 'hr_email', // common typo tolerance
  'official_email': 'hr_email',
  'offical_email': 'hr_email',
  'official email id': 'hr_email',
  'prof email': 'hr_email',
  'professor email': 'hr_email',
  'faculty email': 'hr_email',
  'work email': 'hr_email',
  'institutional email': 'hr_email',
  'university email': 'hr_email',

  // Company / Institution
  'company name': 'company_name',
  'company_name': 'company_name',
  'companyname': 'company_name',
  'company': 'company_name',
  'organization': 'company_name',
  'institution': 'company_name',
  'instituion': 'company_name', // common typo tolerance
  'institution name': 'company_name',
  'university': 'company_name',
  'university name': 'company_name',
  'institute': 'company_name',
  'institute name': 'company_name',
  'college': 'company_name',
  'college name': 'company_name',
  'school': 'company_name',
  'univ': 'company_name',

  // Role / Research Area
  'role': 'role',
  'position': 'role',
  'job title': 'role',
  'job role': 'role',
  'title': 'role',
  'research area': 'role',
  'research interest': 'role',
  'research interests': 'role',
  'research topic': 'role',
  'research domain': 'role',
  'research field': 'role',
  'research': 'role',
  'domain': 'role',
  'field': 'role',
  'lab': 'role',
  'specialization': 'role',
  'topic': 'role',

  // Job / Lab URL
  'job url': 'job_url',
  'job_url': 'job_url',
  'joburl': 'job_url',
  'url': 'job_url',
  'link': 'job_url',
  'job link': 'job_url',
  'application url': 'job_url',
  'application link': 'job_url',
  'lab url': 'job_url',
  'lab link': 'job_url',
  'website': 'job_url',
  'profile url': 'job_url',

  // Notes / Department
  'notes': 'notes',
  'note': 'notes',
  'comments': 'notes',
  'comment': 'notes',
  'remarks': 'notes',
  'department': 'notes',
  'dept': 'notes',
};

function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().trim();
  return COLUMN_MAP[normalized] || normalized;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validateContact(contact: ParsedContact): string[] {
  const errors: string[] = [];

  if (!contact.hr_name || contact.hr_name.trim() === '') {
    errors.push('Professor / Contact Name is required');
  }

  if (!contact.hr_email || contact.hr_email.trim() === '') {
    errors.push('Official / Contact Email is required');
  } else if (!validateEmail(contact.hr_email)) {
    errors.push(`Invalid email format: ${contact.hr_email}`);
  }

  if (!contact.company_name || contact.company_name.trim() === '') {
    errors.push('Institution / Company Name is required');
  }

  // If role is missing (typical for professor CSV: Professor, Institution, Official Email),
  // automatically default to "Winter Research Internship"
  if (!contact.role || contact.role.trim() === '') {
    contact.role = 'Winter Research Internship';
  }

  return errors;
}

export function parseCSVContent(content: string): ParseResult {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => normalizeHeader(header),
  });

  const contacts: ParsedContact[] = [];
  const errors: string[] = [];

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      errors.push(`Row ${err.row}: ${err.message}`);
    }
  }

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as Record<string, string>;
    const contact: ParsedContact = {
      hr_name: (row.hr_name || '').trim(),
      hr_email: (row.hr_email || '').trim().toLowerCase(),
      company_name: (row.company_name || '').trim(),
      role: (row.role || '').trim(),
      job_url: (row.job_url || '').trim(),
      notes: (row.notes || '').trim(),
      row_number: i + 1,
      validation_errors: [],
    };

    contact.validation_errors = validateContact(contact);
    contacts.push(contact);
  }

  const validRows = contacts.filter(c => c.validation_errors.length === 0).length;
  const invalidRows = contacts.filter(c => c.validation_errors.length > 0).length;

  return { contacts, errors, totalRows: contacts.length, validRows, invalidRows };
}

export function parseExcelBuffer(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  const contacts: ParsedContact[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    // Normalize keys
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value);
    }

    const contact: ParsedContact = {
      hr_name: (normalized.hr_name || '').trim(),
      hr_email: (normalized.hr_email || '').trim().toLowerCase(),
      company_name: (normalized.company_name || '').trim(),
      role: (normalized.role || '').trim(),
      job_url: (normalized.job_url || '').trim(),
      notes: (normalized.notes || '').trim(),
      row_number: i + 1,
      validation_errors: [],
    };

    contact.validation_errors = validateContact(contact);
    contacts.push(contact);
  }

  const validRows = contacts.filter(c => c.validation_errors.length === 0).length;
  const invalidRows = contacts.filter(c => c.validation_errors.length > 0).length;

  return { contacts, errors: [], totalRows: contacts.length, validRows, invalidRows };
}

export function detectDuplicatesInList(contacts: ParsedContact[]): Map<number, string> {
  const duplicates = new Map<number, string>();
  const seen = new Map<string, number>();

  for (const contact of contacts) {
    const key = `${contact.hr_email.toLowerCase()}|${contact.role.toLowerCase()}`;
    if (seen.has(key)) {
      duplicates.set(
        contact.row_number,
        `Duplicate: same email (${contact.hr_email}) and role (${contact.role}) as row ${seen.get(key)}`
      );
    } else {
      seen.set(key, contact.row_number);
    }
  }

  return duplicates;
}
