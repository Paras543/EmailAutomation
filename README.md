# Outreach CRM — HR Email Automation

A production-grade, lightweight personal HR outreach CRM built with Next.js for sending personalized job/internship application emails through Gmail.

## Features

- **CSV/Excel Upload** — Upload structured HR contact lists with validation
- **Gmail OAuth Integration** — Secure email sending via Gmail API (no passwords stored)
- **Personalized Emails** — Template engine with variable substitution (`{{hr_name}}`, `{{company}}`, `{{role}}`, etc.)
- **Resume Attachment** — Attach your PDF resume to every email
- **Mandatory Review** — Preview, edit, skip, and selectively send individual emails before any batch send
- **Duplicate Detection** — Cross-checks against local database and Gmail sent mail
- **Campaign Dashboard** — Real-time stats: total, ready, sent, failed, skipped, duplicates
- **Pause/Resume/Cancel** — Full control over active campaigns
- **Rate Limiting** — Configurable delay between emails, max emails per campaign
- **Campaign History** — Persistent record of all campaigns and individual email statuses

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Cloud project with Gmail API enabled
- OAuth 2.0 credentials (Client ID and Secret)

### Setup Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or use existing)
3. Enable the **Gmail API** and **Google People API**
4. Create OAuth 2.0 credentials:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
5. Copy the Client ID and Client Secret

### Installation

```bash
cd email
npm install
```

### Environment Variables

Create a `.env.local` file in the `email/` directory:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000

USER_NAME=Your Name
USER_EMAIL=your.email@gmail.com
USER_PHONE=+91 XXXXXXXXXX
USER_LINKEDIN=https://www.linkedin.com/in/yourprofile/
USER_GITHUB=https://github.com/yourusername
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## User Flow

1. **Connect Gmail** — Click "Connect Gmail" in the sidebar to authenticate
2. **New Campaign** — Click "New Campaign" in the sidebar
3. **Upload Contacts** — Upload a CSV/Excel file with HR contacts
4. **Select Resume** — Upload or select a previously uploaded resume PDF
5. **Configure Template** — Edit the email subject and body template, set delay and limits
6. **Review Emails** — Preview every generated email, edit individual emails, skip contacts
7. **Send** — Click "Send Selected Emails" → Confirm → Watch real-time progress
8. **History** — View all past campaigns and their results

## CSV Formats

### 1. Professor / Academic Outreach CSV (Winter Research Internship)

| Column | Required | Description |
|--------|----------|-------------|
| Professor | ✓ | Professor/Faculty Name (e.g. `Prof. Andrew Ng` or `Dr. Rajesh Sharma`) |
| Institution | ✓ | University/Institute (e.g. `Stanford University`, `IIT Delhi`) |
| Official Email | ✓ | Official academic email address (e.g. `andrew@cs.stanford.edu`) |
| Research Area | ✗ | Research domain (e.g. `Deep Learning & LLMs`) — defaults to *Winter Research Internship* if omitted |
| Notes | ✗ | Lab name, department, or special reference |

A sample CSV is provided at `sample_professors.csv`.

### 2. Recruiter / Corporate Outreach CSV (Job / Internship)

| Column | Required | Description |
|--------|----------|-------------|
| HR Name | ✓ | Name of the recruiter/HR |
| HR Email | ✓ | Recruiter's email address |
| Company Name | ✓ | Company the recruiter works for |
| Role | ✓ | Position you're applying for |
| Job URL | ✗ | Link to the job posting |
| Notes | ✗ | Any additional context |

A sample CSV is provided at `sample_contacts.csv`.

## Template Variables

### Professor / Academic Variables
| Variable | Description |
|----------|-------------|
| `{{professor_salutation}}` | Formatted academic title (e.g., `Prof. Andrew Ng` or `Dr. Rajesh Sharma`) |
| `{{professor_name}}` | Professor's name |
| `{{institution}}` | University, Institute, or College |
| `{{research_area}}` | Research area or domain |
| `{{research_area_phrase}}` | Auto-generates `, particularly regarding [Research Area]` if specified |

### Common & Recruiter Variables
| Variable | Description |
|----------|-------------|
| `{{hr_name}}` | HR/Recruiter's name |
| `{{company}}` | Company name |
| `{{role}}` | Job role/position |
| `{{job_url}}` | Job posting URL |
| `{{job_url_section}}` | Auto-generates "Job listing: URL" if URL exists |
| `{{user_name}}` | Your name (from env: `Paras Gupta`) |
| `{{user_phone}}` | Your phone (from env: `+91 7428065794`) |
| `{{user_linkedin}}` | Your LinkedIn URL (from env) |
| `{{user_github}}` | Your GitHub URL (from env) |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite (via better-sqlite3) — zero setup, file-based
- **Email**: Gmail API (googleapis)
- **Parsing**: PapaParse (CSV), SheetJS (Excel)
- **Styling**: Vanilla CSS with custom design system

## Security Notes

- OAuth tokens are stored locally in SQLite — never in plain text files
- Gmail passwords are never requested or stored
- No mechanisms to bypass Gmail sending limits
- Each email is sent individually (no BCC exposure)
- All file uploads are validated and sanitized
# EmailAutomation
