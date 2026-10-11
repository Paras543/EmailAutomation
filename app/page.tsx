'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MailIcon, PlusIcon, UploadIcon, FileIcon, SendIcon, HistoryIcon,
  CheckCircleIcon, AlertCircleIcon, XIcon, EditIcon, EyeIcon,
  PauseIcon, PlayIcon, SquareIcon, SettingsIcon, TrashIcon,
  RefreshIcon, HomeIcon,
} from './components/Icons';

import {
  DEFAULT_SUBJECT_TEMPLATE,
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_FOLLOWUP_1_SUBJECT,
  DEFAULT_FOLLOWUP_1_BODY,
  DEFAULT_FOLLOWUP_2_SUBJECT,
  DEFAULT_FOLLOWUP_2_BODY,
  ACADEMIC_WINTER_SUBJECT_TEMPLATE,
  ACADEMIC_WINTER_BODY_TEMPLATE,
  ACADEMIC_WINTER_FOLLOWUP_1_SUBJECT,
  ACADEMIC_WINTER_FOLLOWUP_1_BODY,
  ACADEMIC_WINTER_FOLLOWUP_2_SUBJECT,
  ACADEMIC_WINTER_FOLLOWUP_2_BODY,
  generateFollowupSubject,
  generateFollowupBody,
} from '@/lib/templates';

// ─── Types ──────────────────────────────────────────────────
interface Contact {
  id: string;
  campaign_id: string;
  hr_name: string;
  hr_email: string;
  company_name: string;
  role: string;
  job_url?: string;
  notes?: string;
  generated_subject?: string;
  generated_body?: string;
  edited_subject?: string;
  edited_body?: string;
  status: string;
  error_message?: string;
  is_selected: number;
  is_duplicate: number;
  duplicate_reason?: string;
  sent_at?: string;
  row_number: number;
  validation_errors?: string;
  gmail_thread_id?: string;
  gmail_message_id?: string;
  followup_count?: number;
  followup_status?: string;
  next_followup_at?: string;
  last_followup_at?: string;
  replied_at?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  template_subject?: string;
  template_body?: string;
  resume_filename?: string;
  resume_path?: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  duplicate_count: number;
  gmail_account?: string;
  delay_ms: number;
  max_per_campaign: number;
  created_at: string;
  updated_at: string;
  followup_enabled?: number;
  followup_delay_days?: number;
  max_followups?: number;
  followup_1_subject?: string;
  followup_1_body?: string;
  followup_2_subject?: string;
  followup_2_body?: string;
}

interface CampaignStats {
  total: number;
  ready: number;
  sent: number;
  failed: number;
  skipped: number;
  duplicates: number;
  invalid: number;
  sending: number;
  replied?: number;
}

interface ResumeFile {
  storedFilename: string;
  originalName: string;
  filepath: string;
  size: number;
  uploadedAt: string;
}

type View = 'dashboard' | 'new-campaign' | 'history' | 'campaign-detail';

// ─── Default Templates ──────────────────────────────────────
const DEFAULT_SUBJECT = DEFAULT_SUBJECT_TEMPLATE;
const DEFAULT_BODY = DEFAULT_BODY_TEMPLATE;

// ─── Main App Component ─────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check auth status and load campaigns on mount
  useEffect(() => {
    checkAuthStatus();
    loadCampaigns();

    // Check for OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success') === 'true') {
      checkAuthStatus();
      window.history.replaceState({}, '', '/');
    }
    if (params.get('auth_error')) {
      alert('Authentication failed: ' + params.get('auth_error'));
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setGmailConnected(data.connected);
      setGmailEmail(data.email || '');
    } catch {
      setGmailConnected(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  };

  const connectGmail = async () => {
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to get auth URL:', err);
    }
  };

  const disconnectGmail = async () => {
    if (!confirm('Disconnect your Gmail account?')) return;
    try {
      await fetch('/api/auth/status', { method: 'DELETE' });
      setGmailConnected(false);
      setGmailEmail('');
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const openCampaign = (id: string) => {
    setActiveCampaignId(id);
    setView('campaign-detail');
  };

  const goToDashboard = () => {
    setActiveCampaignId(null);
    setView('dashboard');
    loadCampaigns();
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <MailIcon />
            <span>Outreach CRM</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={goToDashboard}>
            <HomeIcon /> Dashboard
          </div>
          <div className={`nav-item ${view === 'new-campaign' ? 'active' : ''}`} onClick={() => setView('new-campaign')}>
            <PlusIcon /> New Campaign
          </div>
          <div className={`nav-item ${view === 'history' ? 'active' : ''}`} onClick={() => { setView('history'); loadCampaigns(); }}>
            <HistoryIcon /> Campaign History
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="gmail-status" onClick={gmailConnected ? disconnectGmail : connectGmail}>
            <span className={`status-dot ${gmailConnected ? 'connected' : 'disconnected'}`} />
            <span className="gmail-status-email">
              {gmailConnected ? gmailEmail : 'Connect Gmail'}
            </span>
            {gmailConnected && <XIcon style={{ width: 14, height: 14, opacity: 0.5 }} />}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {view === 'dashboard' && (
          <DashboardView
            campaigns={campaigns}
            gmailConnected={gmailConnected}
            gmailEmail={gmailEmail}
            onNewCampaign={() => setView('new-campaign')}
            onOpenCampaign={openCampaign}
            onConnectGmail={connectGmail}
          />
        )}
        {view === 'new-campaign' && (
          <NewCampaignWizard
            gmailConnected={gmailConnected}
            gmailEmail={gmailEmail}
            onComplete={(campaignId) => openCampaign(campaignId)}
            onCancel={goToDashboard}
          />
        )}
        {view === 'history' && (
          <HistoryView campaigns={campaigns} onOpenCampaign={openCampaign} onBack={goToDashboard} onRefresh={loadCampaigns} />
        )}
        {view === 'campaign-detail' && activeCampaignId && (
          <CampaignDetailView campaignId={activeCampaignId} onBack={goToDashboard} gmailEmail={gmailEmail} />
        )}
      </main>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════
function DashboardView({ campaigns, gmailConnected, gmailEmail, onNewCampaign, onOpenCampaign, onConnectGmail }: {
  campaigns: Campaign[];
  gmailConnected: boolean;
  gmailEmail: string;
  onNewCampaign: () => void;
  onOpenCampaign: (id: string) => void;
  onConnectGmail: () => void;
}) {
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);
  const totalCampaigns = campaigns.length;
  const recentCampaigns = campaigns.slice(0, 5);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your HR outreach campaigns</p>
      </div>
      <div className="page-body">
        {!gmailConnected && (
          <div className="alert alert-warning" style={{ marginBottom: 20 }}>
            <AlertCircleIcon />
            <div>
              <strong>Gmail not connected.</strong> Connect your Gmail account to start sending emails.
              <button className="btn btn-sm btn-warning" style={{ marginLeft: 12 }} onClick={onConnectGmail}>Connect Gmail</button>
            </div>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-value">{totalCampaigns}</div>
            <div className="stat-label">Total Campaigns</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{totalSent}</div>
            <div className="stat-label">Emails Sent</div>
          </div>
          <div className="stat-card info">
            <div className="stat-value">{gmailConnected ? '✓' : '✗'}</div>
            <div className="stat-label">Gmail Status</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent Campaigns</h2>
          <button className="btn btn-primary" onClick={onNewCampaign}>
            <PlusIcon /> New Campaign
          </button>
        </div>

        <div className="card">
          {recentCampaigns.length === 0 ? (
            <div className="empty-state">
              <MailIcon />
              <h3>No campaigns yet</h3>
              <p>Create your first campaign to start reaching out to recruiters.</p>
              <button className="btn btn-primary" onClick={onNewCampaign}>
                <PlusIcon /> Create Campaign
              </button>
            </div>
          ) : (
            recentCampaigns.map(c => (
              <div key={c.id} className="history-card" onClick={() => onOpenCampaign(c.id)}>
                <div className="history-card-info">
                  <h4>{c.name}</h4>
                  <p>{new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="history-card-stats">
                  <span><span className={`status-badge ${c.status}`} style={{ textTransform: 'capitalize' }}>{c.status}</span></span>
                  <span style={{ color: 'var(--text-primary)' }}>✓ {c.sent_count || 0}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>✗ {c.failed_count || 0}</span>
                  <span style={{ color: 'var(--text-muted)' }}>⊘ {c.skipped_count || 0}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════
//  NEW CAMPAIGN WIZARD
// ═══════════════════════════════════════════════════════════
function NewCampaignWizard({ gmailConnected, gmailEmail, onComplete, onCancel }: {
  gmailConnected: boolean;
  gmailEmail: string;
  onComplete: (campaignId: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [campaignType, setCampaignType] = useState<'academic' | 'recruiter'>('academic');
  const [campaignName, setCampaignName] = useState(`Winter Research Internship - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
  const [inputMode, setInputMode] = useState<'csv' | 'manual'>('csv');

  // File upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{ totalRows: number; validRows: number; invalidRows: number; duplicates: number; parseErrors: string[] } | null>(null);

  // Manual entry state
  const [manualContacts, setManualContacts] = useState<Array<{
    hr_name: string;
    hr_email: string;
    company_name: string;
    role: string;
    job_url: string;
    notes: string;
  }>>([{ hr_name: '', hr_email: '', company_name: '', role: 'Winter Research Internship', job_url: '', notes: '' }]);

  // Resume / CV state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeData, setResumeData] = useState<{ filename: string; filepath: string } | null>(null);
  const [existingResumes, setExistingResumes] = useState<ResumeFile[]>([]);

  // Template state
  const [subjectTemplate, setSubjectTemplate] = useState(ACADEMIC_WINTER_SUBJECT_TEMPLATE);
  const [bodyTemplate, setBodyTemplate] = useState(ACADEMIC_WINTER_BODY_TEMPLATE);

  // Follow-up state
  const [templateTab, setTemplateTab] = useState<'initial' | 'followup1' | 'followup2'>('initial');
  const [followupEnabled, setFollowupEnabled] = useState(true);
  const [followupDelayDays, setFollowupDelayDays] = useState(5);
  const [followup1Subject, setFollowup1Subject] = useState(ACADEMIC_WINTER_FOLLOWUP_1_SUBJECT);
  const [followup1Body, setFollowup1Body] = useState(ACADEMIC_WINTER_FOLLOWUP_1_BODY);
  const [followup2Subject, setFollowup2Subject] = useState(ACADEMIC_WINTER_FOLLOWUP_2_SUBJECT);
  const [followup2Body, setFollowup2Body] = useState(ACADEMIC_WINTER_FOLLOWUP_2_BODY);

  // Campaign settings
  const [delayMs, setDelayMs] = useState(3000);
  const [maxPerCampaign, setMaxPerCampaign] = useState(50);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const csvInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExistingResumes();
  }, []);

  const loadExistingResumes = async () => {
    try {
      const res = await fetch('/api/resume');
      const data = await res.json();
      const list = data.resumes || [];
      setExistingResumes(list);
      // Auto-select latest uploaded CV/resume if none selected yet
      if (list.length > 0 && !resumeData) {
        setResumeData({ filename: list[0].originalName, filepath: list[0].filepath });
      }
    } catch { /* ignore */ }
  };

  const handleSelectCampaignType = (type: 'academic' | 'recruiter') => {
    setCampaignType(type);
    if (type === 'academic') {
      setCampaignName(`Winter Research Internship - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
      setSubjectTemplate(ACADEMIC_WINTER_SUBJECT_TEMPLATE);
      setBodyTemplate(ACADEMIC_WINTER_BODY_TEMPLATE);
      setFollowup1Subject(ACADEMIC_WINTER_FOLLOWUP_1_SUBJECT);
      setFollowup1Body(ACADEMIC_WINTER_FOLLOWUP_1_BODY);
      setFollowup2Subject(ACADEMIC_WINTER_FOLLOWUP_2_SUBJECT);
      setFollowup2Body(ACADEMIC_WINTER_FOLLOWUP_2_BODY);
      setManualContacts([{ hr_name: '', hr_email: '', company_name: '', role: 'Winter Research Internship', job_url: '', notes: '' }]);
    } else {
      setCampaignName(`Job Application Campaign - ${new Date().toLocaleDateString()}`);
      setSubjectTemplate(DEFAULT_SUBJECT_TEMPLATE);
      setBodyTemplate(DEFAULT_BODY_TEMPLATE);
      setFollowup1Subject(DEFAULT_FOLLOWUP_1_SUBJECT);
      setFollowup1Body(DEFAULT_FOLLOWUP_1_BODY);
      setFollowup2Subject(DEFAULT_FOLLOWUP_2_SUBJECT);
      setFollowup2Body(DEFAULT_FOLLOWUP_2_BODY);
      setManualContacts([{ hr_name: '', hr_email: '', company_name: '', role: '', job_url: '', notes: '' }]);
    }
  };

  // ─── Manual contact helpers ─────────────────────────
  const updateManualContact = (index: number, field: string, value: string) => {
    setManualContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addManualRow = () => {
    setManualContacts(prev => [
      ...prev,
      { hr_name: '', hr_email: '', company_name: '', role: campaignType === 'academic' ? 'Winter Research Internship' : '', job_url: '', notes: '' }
    ]);
  };

  const removeManualRow = (index: number) => {
    if (manualContacts.length <= 1) return;
    setManualContacts(prev => prev.filter((_, i) => i !== index));
  };

  const isManualValid = manualContacts.every(c => c.hr_name.trim() && c.hr_email.trim() && c.company_name.trim());

  // ─── Create campaign helper ─────────────────────────
  const ensureCampaign = async () => {
    if (campaignId) return campaignId;
    const campaignRes = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName,
        template_subject: subjectTemplate,
        template_body: bodyTemplate,
        gmail_account: gmailEmail,
        delay_ms: delayMs,
        max_per_campaign: maxPerCampaign,
        followup_enabled: followupEnabled ? 1 : 0,
        followup_delay_days: followupDelayDays,
        max_followups: 2,
        followup_1_subject: followup1Subject,
        followup_1_body: followup1Body,
        followup_2_subject: followup2Subject,
        followup_2_body: followup2Body,
      }),
    });
    const campaignData = await campaignRes.json();
    if (!campaignData.id) throw new Error('Failed to create campaign');
    setCampaignId(campaignData.id);
    return campaignData.id as string;
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setUploading(true);
    setError('');

    try {
      const currentCampaignId = await ensureCampaign();

      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('campaign_id', currentCampaignId);
      formData.append('subject_template', subjectTemplate);
      formData.append('body_template', bodyTemplate);

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      setUploadResult(uploadData);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!isManualValid) return;
    setUploading(true);
    setError('');

    try {
      const currentCampaignId = await ensureCampaign();

      const res = await fetch('/api/contacts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: currentCampaignId,
          contacts: manualContacts,
          subject_template: subjectTemplate,
          body_template: bodyTemplate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add contacts');

      setUploadResult(data);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add contacts');
    } finally {
      setUploading(false);
    }
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) return;
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);

      const res = await fetch('/api/resume', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Resume upload failed');

      setResumeData({ filename: data.filename, filepath: data.filepath });

      if (campaignId) {
        await fetch('/api/campaigns', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: campaignId,
            resume_filename: data.filename,
            resume_path: data.filepath,
          }),
        });
      }

      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Resume upload failed');
    } finally {
      setUploading(false);
    }
  };

  const selectExistingResume = async (resume: ResumeFile) => {
    setResumeData({ filename: resume.originalName, filepath: resume.filepath });

    if (campaignId) {
      await fetch('/api/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          resume_filename: resume.originalName,
          resume_path: resume.filepath,
        }),
      });
    }

    setStep(3);
  };

  const handleTemplateConfirm = async () => {
    if (campaignId) {
      await fetch('/api/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          template_subject: subjectTemplate,
          template_body: bodyTemplate,
          delay_ms: delayMs,
          max_per_campaign: maxPerCampaign,
          followup_enabled: followupEnabled ? 1 : 0,
          followup_delay_days: followupDelayDays,
          max_followups: 2,
          followup_1_subject: followup1Subject,
          followup_1_body: followup1Body,
          followup_2_subject: followup2Subject,
          followup_2_body: followup2Body,
        }),
      });
    }

    if (campaignId) {
      onComplete(campaignId);
    }
  };

  const steps = [
    { num: 1, label: 'Add Contacts' },
    { num: 2, label: 'Select Resume' },
    { num: 3, label: 'Email Template' },
  ];

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>← Back</button>
          <div>
            <h1 className="page-title">New Campaign</h1>
            <p className="page-subtitle">Set up your HR outreach campaign</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Steps indicator */}
        <div className="steps-header">
          {steps.map(s => (
            <div key={s.num} className={`step-item ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}>
              <div className="step-number">
                {step > s.num ? <CheckCircleIcon style={{ width: 14, height: 14 }} /> : s.num}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircleIcon />
            <div>{error}</div>
          </div>
        )}

        {/* Step 1: Add Contacts (CSV or Manual) */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Add Contacts</h3>
            </div>
            <div className="card-body">
              {/* Campaign Outreach Goal Selector */}
              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'block' }}>
                  Select Outreach Goal
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    onClick={() => handleSelectCampaignType('academic')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 8,
                      border: campaignType === 'academic' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: campaignType === 'academic' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 13.5, color: campaignType === 'academic' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        🎓 Professor (Winter Research Internship)
                      </strong>
                      {campaignType === 'academic' && <span style={{ color: 'var(--accent-primary)', fontSize: 12, fontWeight: 700 }}>✓ Selected</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Target professors & labs. Upload CSV with <code>Professor, Institution, Official Email</code>. Auto-crafts academic research pitches with your CV.
                    </p>
                  </div>

                  <div
                    onClick={() => handleSelectCampaignType('recruiter')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 8,
                      border: campaignType === 'recruiter' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: campaignType === 'recruiter' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 13.5, color: campaignType === 'recruiter' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        💼 Recruiter / HR (Corporate Job & Internship)
                      </strong>
                      {campaignType === 'recruiter' && <span style={{ color: 'var(--accent-primary)', fontSize: 12, fontWeight: 700 }}>✓ Selected</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Target recruiters & engineering managers. Upload CSV with <code>HR Name, HR Email, Company, Role</code>. Tailored for corporate roles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Campaign Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder={campaignType === 'academic' ? 'e.g., Winter 2026 Research Internship Outreach' : 'e.g., Summer 2026 Internship Outreach'}
                />
              </div>

              {/* Mode toggle tabs */}
              <div className="tab-row" style={{ marginTop: 8 }}>
                <div className={`tab-item ${inputMode === 'csv' ? 'active' : ''}`} onClick={() => setInputMode('csv')}>
                  <UploadIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                  Upload CSV / Excel
                </div>
                <div className={`tab-item ${inputMode === 'manual' ? 'active' : ''}`} onClick={() => setInputMode('manual')}>
                  <EditIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                  Add Manually
                </div>
              </div>

              {/* CSV Upload Mode */}
              {inputMode === 'csv' && (
                <>
                  <div className="form-group" style={{ marginTop: 4 }}>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={e => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <div
                      className={`upload-zone ${csvFile ? 'has-file' : ''}`}
                      onClick={() => csvInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('active'); }}
                      onDragLeave={e => e.currentTarget.classList.remove('active')}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('active');
                        const file = e.dataTransfer.files[0];
                        if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                          setCsvFile(file);
                        }
                      }}
                    >
                      {csvFile ? <CheckCircleIcon /> : <UploadIcon />}
                      <h3>{csvFile ? csvFile.name : 'Drop your CSV or Excel file here'}</h3>
                      <p>{csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'or click to browse'}</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                      <div className="form-hint" style={{ marginTop: 0 }}>
                        {campaignType === 'academic' ? (
                          <>
                            <strong>Supported columns:</strong> <code>Professor</code>, <code>Institution</code>, <code>Official Email</code> (Optional: <code>Research Area</code>, <code>Notes</code>)
                          </>
                        ) : (
                          <>
                            <strong>Supported columns:</strong> <code>HR Name</code>, <code>HR Email</code>, <code>Company Name</code>, <code>Role</code> (Optional: <code>Job URL</code>, <code>Notes</code>)
                          </>
                        )}
                      </div>
                      <a
                        href={campaignType === 'academic' ? '/sample_professors.csv' : '/sample_contacts.csv'}
                        download={campaignType === 'academic' ? 'sample_professors.csv' : 'sample_contacts.csv'}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 12, padding: '2px 8px', textDecoration: 'none', color: 'var(--accent-primary)' }}
                      >
                        ⬇ Download Sample {campaignType === 'academic' ? 'Professors' : 'Contacts'} CSV
                      </a>
                    </div>
                  </div>

                  {csvFile && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setCsvFile(null); setUploadResult(null); }}>
                        <XIcon /> Remove
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Manual Entry Mode */}
              {inputMode === 'manual' && (
                <div style={{ marginTop: 4 }}>
                  <div className="table-container" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}>#</th>
                          <th>{campaignType === 'academic' ? 'Professor Name *' : 'HR Name *'}</th>
                          <th>{campaignType === 'academic' ? 'Official Email *' : 'HR Email *'}</th>
                          <th>{campaignType === 'academic' ? 'Institution *' : 'Company *'}</th>
                          <th>{campaignType === 'academic' ? 'Research Area' : 'Role *'}</th>
                          <th>{campaignType === 'academic' ? 'Lab / Profile URL' : 'Job URL'}</th>
                          <th>Notes</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualContacts.map((contact, idx) => (
                          <tr key={idx}>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{idx + 1}</td>
                            <td>
                              <input
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: 12.5 }}
                                placeholder={campaignType === 'academic' ? 'Prof. Andrew Ng' : 'Ankit Sharma'}
                                value={contact.hr_name}
                                onChange={e => updateManualContact(idx, 'hr_name', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: 12.5 }}
                                placeholder={campaignType === 'academic' ? 'andrew@cs.stanford.edu' : 'ankit@company.com'}
                                type="email"
                                value={contact.hr_email}
                                onChange={e => updateManualContact(idx, 'hr_email', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: 12.5 }}
                                placeholder={campaignType === 'academic' ? 'Stanford University' : 'ABC Technologies'}
                                value={contact.company_name}
                                onChange={e => updateManualContact(idx, 'company_name', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: 12.5 }}
                                placeholder={campaignType === 'academic' ? 'Deep Learning & LLMs' : 'AI/ML Intern'}
                                value={contact.role}
                                onChange={e => updateManualContact(idx, 'role', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: 12.5 }}
                                placeholder="https://..."
                                value={contact.job_url}
                                onChange={e => updateManualContact(idx, 'job_url', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: 12.5 }}
                                placeholder="Optional notes"
                                value={contact.notes}
                                onChange={e => updateManualContact(idx, 'notes', e.target.value)}
                              />
                            </td>
                            <td>
                              {manualContacts.length > 1 && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: 4 }}
                                  onClick={() => removeManualRow(idx)}
                                  title="Remove row"
                                >
                                  <XIcon style={{ width: 14, height: 14, color: 'var(--accent-danger)' }} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={addManualRow}>
                    <PlusIcon /> Add Another {campaignType === 'academic' ? 'Professor' : 'Contact'}
                  </button>
                </div>
              )}
            </div>
            <div className="card-footer">
              <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
              {inputMode === 'csv' ? (
                <button className="btn btn-primary" disabled={!csvFile || uploading || !campaignName.trim()} onClick={handleCsvUpload}>
                  {uploading ? <><span className="spinner" /> Processing...</> : <>Upload & Validate</>}
                </button>
              ) : (
                <button className="btn btn-primary" disabled={!isManualValid || uploading || !campaignName.trim()} onClick={handleManualSubmit}>
                  {uploading ? <><span className="spinner" /> Processing...</> : <>Validate & Continue ({manualContacts.length})</>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload results summary (visible at step 2) */}
        {step === 2 && uploadResult && (
          <>
            <div className="alert alert-success" style={{ marginBottom: 20 }}>
              <CheckCircleIcon />
              <div>
                <strong>Contacts parsed successfully.</strong>{' '}
                {uploadResult.validRows} valid, {uploadResult.invalidRows} invalid, {uploadResult.duplicates} duplicates out of {uploadResult.totalRows} total rows.
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Select Resume / CV PDF</h3>
              </div>
              <div className="card-body">
                {resumeData && (
                  <div className="alert alert-success" style={{ marginBottom: 16 }}>
                    <CheckCircleIcon />
                    <div>
                      <strong>Active CV / Resume Attached:</strong> <code>{resumeData.filename}</code>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        This PDF will be automatically attached to every email sent to professors.
                      </div>
                    </div>
                  </div>
                )}

                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={e => setResumeFile(e.target.files?.[0] || null)}
                />

                <div
                  className={`upload-zone ${resumeFile ? 'has-file' : ''}`}
                  onClick={() => resumeInputRef.current?.click()}
                  style={{ marginBottom: 20 }}
                >
                  {resumeFile ? <CheckCircleIcon /> : <FileIcon />}
                  <h3>{resumeFile ? resumeFile.name : 'Upload New CV / Resume PDF'}</h3>
                  <p>{resumeFile ? `${(resumeFile.size / 1024).toFixed(1)} KB` : 'Click to browse or drop an updated CV'}</p>
                </div>

                {existingResumes.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <label className="form-label">Or select from previously uploaded CVs:</label>
                    {existingResumes.map(r => (
                      <div
                        key={r.storedFilename}
                        className="file-badge"
                        style={{
                          display: 'flex',
                          marginBottom: 8,
                          cursor: 'pointer',
                          width: '100%',
                          border: resumeData?.filepath === r.filepath ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          background: resumeData?.filepath === r.filepath ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)'
                        }}
                        onClick={() => selectExistingResume(r)}
                      >
                        <FileIcon />
                        <span style={{ flex: 1, fontWeight: resumeData?.filepath === r.filepath ? 600 : 400 }}>
                          {r.originalName} {resumeData?.filepath === r.filepath && '(Selected)'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {(r.size / 1024).toFixed(0)} KB · {new Date(r.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-footer">
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                {resumeFile ? (
                  <button className="btn btn-primary" disabled={uploading} onClick={handleResumeUpload}>
                    {uploading ? <><span className="spinner" /> Uploading...</> : <>Upload CV & Continue →</>}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={!resumeData}
                    onClick={async () => {
                      if (campaignId && resumeData) {
                        await fetch('/api/campaigns', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            id: campaignId,
                            resume_filename: resumeData.filename,
                            resume_path: resumeData.filepath,
                          }),
                        });
                      }
                      setStep(3);
                    }}
                  >
                    Continue with Selected CV ({resumeData?.filename || 'CV'}) →
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Step 3: Template */}
        {step === 3 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Email Template & Settings</h3>
            </div>
            <div className="card-body">
              {/* Preset Selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Template Preset:</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                    {campaignType === 'academic' ? '🎓 Professor (Winter Research)' : '💼 Recruiter (Job Application)'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${campaignType === 'academic' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleSelectCampaignType('academic')}
                  >
                    🎓 Load Professor Template
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${campaignType === 'recruiter' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleSelectCampaignType('recruiter')}
                  >
                    💼 Load Recruiter Template
                  </button>
                </div>
              </div>

              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <AlertCircleIcon />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {campaignType === 'academic' ? 'Personalized Variables for Professors:' : 'Personalized Variables for Recruiters:'}
                  </div>
                  {campaignType === 'academic' ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <code>{'{{professor_salutation}}'}</code>
                      <code>{'{{professor_name}}'}</code>
                      <code>{'{{institution}}'}</code>
                      <code>{'{{research_area}}'}</code>
                      <code>{'{{user_name}}'}</code>
                      <code>{'{{user_phone}}'}</code>
                      <code>{'{{user_linkedin}}'}</code>
                      <code>{'{{user_github}}'}</code>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <code>{'{{hr_name}}'}</code>
                      <code>{'{{company}}'}</code>
                      <code>{'{{role}}'}</code>
                      <code>{'{{job_url}}'}</code>
                      <code>{'{{job_url_section}}'}</code>
                      <code>{'{{user_name}}'}</code>
                      <code>{'{{user_phone}}'}</code>
                      <code>{'{{user_linkedin}}'}</code>
                      <code>{'{{user_github}}'}</code>
                    </div>
                  )}
                </div>
              </div>

              {resumeData && (
                <div className="file-badge" style={{ marginBottom: 16 }}>
                  <FileIcon /> CV Attached: <strong>{resumeData.filename}</strong>
                </div>
              )}

              {/* Template Tabs: Initial vs Follow-up 1 vs Follow-up 2 */}
              <div className="tab-row" style={{ marginBottom: 16 }}>
                <div
                  className={`tab-item ${templateTab === 'initial' ? 'active' : ''}`}
                  onClick={() => setTemplateTab('initial')}
                >
                  ✉️ Initial Outreach
                </div>
                <div
                  className={`tab-item ${templateTab === 'followup1' ? 'active' : ''}`}
                  onClick={() => setTemplateTab('followup1')}
                >
                  ↻ Follow-up 1 (Day 5)
                </div>
                <div
                  className={`tab-item ${templateTab === 'followup2' ? 'active' : ''}`}
                  onClick={() => setTemplateTab('followup2')}
                >
                  ↻ Follow-up 2 (Day 10)
                </div>
              </div>

              {templateTab === 'initial' && (
                <>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Subject Line Template</label>
                      {campaignType === 'academic' && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          💡 Sounds eager & personal — avoids spam filters
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={subjectTemplate}
                      onChange={e => setSubjectTemplate(e.target.value)}
                    />
                    {campaignType === 'academic' && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
                          High-converting subject line suggestions (click to use):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {[
                            'Prospective Winter Research Intern: Keen interest in your lab at {{institution}} - {{user_name}}',
                            'Winter Research Internship — Eager to contribute to your group at {{institution}} ({{user_name}})',
                            'Winter Research / Keen to collaborate with your research team at {{institution}} - {{user_name}}',
                            'Following your work at {{institution}} — Prospective Winter Research Intern ({{user_name}})',
                          ].map(s => (
                            <div
                              key={s}
                              style={{
                                fontSize: 12,
                                padding: '6px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                border: subjectTemplate === s ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                background: subjectTemplate === s ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                                color: subjectTemplate === s ? 'var(--accent-primary)' : 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                              onClick={() => {
                                setSubjectTemplate(s);
                                setFollowup1Subject(`Re: ${s}`);
                                setFollowup2Subject(`Re: ${s}`);
                              }}
                            >
                              <span>{s}</span>
                              {subjectTemplate === s && <span style={{ fontSize: 11, fontWeight: 600 }}>Active</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Email Body (Crisp, High-Impact & Eager)</label>
                    <textarea
                      className="form-textarea"
                      rows={15}
                      value={bodyTemplate}
                      onChange={e => setBodyTemplate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {templateTab === 'followup1' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Follow-up 1 Subject (Threads in Gmail)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={followup1Subject}
                      onChange={e => setFollowup1Subject(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up 1 Body (Sent after 5 days if no reply)</label>
                    <textarea
                      className="form-textarea"
                      rows={14}
                      value={followup1Body}
                      onChange={e => setFollowup1Body(e.target.value)}
                    />
                  </div>
                </>
              )}

              {templateTab === 'followup2' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Follow-up 2 Subject (Final touchpoint)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={followup2Subject}
                      onChange={e => setFollowup2Subject(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up 2 Body (Sent 5 days after Follow-up 1 if no reply)</label>
                    <textarea
                      className="form-textarea"
                      rows={14}
                      value={followup2Body}
                      onChange={e => setFollowup2Body(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div style={{ marginTop: 24, borderTop: '1px solid var(--border-primary)', paddingTop: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Automated Follow-ups & Campaign Settings</h4>
                
                <div style={{ marginBottom: 16, background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <label className="checkbox-wrapper" style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={followupEnabled}
                      onChange={e => setFollowupEnabled(e.target.checked)}
                    />
                    Enable 2-Stage Automated Follow-ups (5-Day Cadence)
                  </label>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 24px', lineHeight: 1.4 }}>
                    Follow-up 1 is scheduled 5 days after email send. Follow-up 2 is scheduled 5 days later.
                    <br />
                    <strong style={{ color: '#ffffff' }}>Automatic Stop:</strong> If the recruiter replies or emails you, all follow-ups for that contact are permanently stopped!
                  </p>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Follow-up Cadence (Days)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={followupDelayDays}
                      onChange={e => setFollowupDelayDays(parseInt(e.target.value) || 5)}
                      min={1}
                      max={30}
                    />
                    <div className="form-hint">Default: 5 days between outreach stages</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Delay Between Sends (ms)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={delayMs}
                      onChange={e => setDelayMs(parseInt(e.target.value) || 3000)}
                      min={1000}
                      max={30000}
                    />
                    <div className="form-hint">{(delayMs / 1000).toFixed(1)} seconds between emails</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Emails Per Batch</label>
                    <input
                      type="number"
                      className="form-input"
                      value={maxPerCampaign}
                      onChange={e => setMaxPerCampaign(parseInt(e.target.value) || 50)}
                      min={1}
                      max={200}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-footer">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" onClick={handleTemplateConfirm}>
                Review Emails →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════
//  CAMPAIGN DETAIL VIEW (Review + Send)
// ═══════════════════════════════════════════════════════════
function CampaignDetailView({ campaignId, onBack, gmailEmail }: {
  campaignId: string;
  onBack: () => void;
  gmailEmail: string;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);
  const [previewTab, setPreviewTab] = useState<'initial' | 'followup1' | 'followup2'>('initial');
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [sendingFollowups, setSendingFollowups] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [campaignStatus, setCampaignStatus] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [campRes, contactsRes] = await Promise.all([
        fetch(`/api/campaigns?id=${campaignId}`),
        fetch(`/api/contacts?campaign_id=${campaignId}`),
      ]);
      const campData = await campRes.json();
      const contactsData = await contactsRes.json();

      setCampaign(campData.campaign);
      setStats(campData.stats);
      setContacts(contactsData.contacts || []);
      setCampaignStatus(campData.campaign?.status || '');
    } catch (err) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-check inbox replies on initial load if campaign has sent emails
  const checkedRepliesRef = useRef(false);
  useEffect(() => {
    if (!checkedRepliesRef.current && campaignId) {
      checkedRepliesRef.current = true;
      fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_replies', campaign_id: campaignId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.newly_replied > 0) {
            loadData();
          }
        })
        .catch(() => {});
    }
  }, [campaignId, loadData]);

  // Poll when sending
  useEffect(() => {
    if (sending) {
      pollRef.current = setInterval(loadData, 2000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sending, loadData]);

  const toggleContactSelection = async (contact: Contact) => {
    const newSelected = contact.is_selected ? 0 : 1;
    await fetch('/api/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, is_selected: newSelected }),
    });
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_selected: newSelected } : c));
  };

  const toggleSelectAll = async () => {
    const allSelected = contacts.every(c => c.is_selected);
    const newVal = allSelected ? 0 : 1;
    for (const c of contacts) {
      if (c.status !== 'sent' && c.status !== 'invalid') {
        await fetch('/api/contacts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: c.id, is_selected: newVal }),
        });
      }
    }
    setContacts(prev => prev.map(c => (c.status !== 'sent' && c.status !== 'invalid') ? { ...c, is_selected: newVal } : c));
  };

  const skipContact = async (contact: Contact) => {
    await fetch('/api/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, status: 'skipped', is_selected: 0 }),
    });
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: 'skipped', is_selected: 0 } : c));
  };

  const overrideDuplicate = async (contact: Contact) => {
    await fetch('/api/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, status: 'ready', is_duplicate: 0, is_selected: 1 }),
    });
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: 'ready', is_duplicate: 0, is_selected: 1 } : c));
  };

  const retryContact = async (contact: Contact) => {
    await fetch('/api/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, status: 'ready', is_selected: 1, error_message: '' }),
    });
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: 'ready', is_selected: 1, error_message: undefined } : c));
  };

  const retryAllFailed = async () => {
    const list = contacts.filter(c => c.status === 'failed' || c.status === 'skipped');
    for (const c of list) {
      await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status: 'ready', is_selected: 1, error_message: '' }),
      });
    }
    setContacts(prev => prev.map(c => (c.status === 'failed' || c.status === 'skipped') ? { ...c, status: 'ready', is_selected: 1, error_message: undefined } : c));
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_replies', campaign_id: campaignId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Inbox checked!\n• ${data.newly_replied} new reply detected.\nFollow-ups have been automatically stopped for any contact who replied.`);
        loadData();
      } else {
        alert(data.error || 'Failed to check replies');
      }
    } catch {
      alert('Failed to check inbox replies');
    } finally {
      setCheckingReplies(false);
    }
  };

  const handleProcessDueFollowups = async () => {
    setSendingFollowups(true);
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_due', campaign_id: campaignId }),
      });
      const data = await res.json();
      if (data.success) {
        const { sent, replied_skipped, failed } = data.results;
        alert(`Follow-up cycle completed:\n• ${sent} follow-ups sent\n• ${replied_skipped} skipped (recipient replied!)\n• ${failed} failed`);
        loadData();
      } else {
        alert(data.error || 'Failed to process follow-ups');
      }
    } catch {
      alert('Error running follow-ups');
    } finally {
      setSendingFollowups(false);
    }
  };

  const handleSendSingleFollowup = async (contact: Contact) => {
    const nextStep = (contact.followup_count || 0) + 1;
    if (!confirm(`Send Follow-up ${nextStep} to ${contact.hr_name} (${contact.hr_email}) now?`)) return;
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_single', contact_id: contact.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Follow-up ${data.followup_sent} sent successfully in thread!`);
        loadData();
      } else {
        alert(data.error || 'Failed to send follow-up');
        loadData();
      }
    } catch {
      alert('Error sending follow-up');
    }
  };

  const handleStopFollowup = async (contact: Contact) => {
    if (!confirm(`Stop all automated follow-ups for ${contact.hr_name}?`)) return;
    try {
      await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_followup', contact_id: contact.id }),
      });
      loadData();
    } catch {
      alert('Error stopping follow-up');
    }
  };

  const selectedToSend = contacts.filter(c => c.is_selected && c.status !== 'sent' && c.status !== 'sending' && c.status !== 'invalid');
  const canSend = selectedToSend.length > 0 && !sending;

  const handleSend = async () => {
    setShowConfirm(false);
    setSending(true);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          contact_ids: selectedToSend.map(c => c.id),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSendProgress(data.results);
      } else {
        alert('Send failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Send error:', err);
      alert('Failed to send emails');
    } finally {
      setSending(false);
      loadData();
    }
  };

  const handlePause = async () => {
    await fetch('/api/send', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, action: 'pause' }),
    });
    setCampaignStatus('paused');
  };

  const handleResume = async () => {
    await fetch('/api/send', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, action: 'resume' }),
    });
    setCampaignStatus('sending');
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this campaign? Emails already sent will not be affected.')) return;
    await fetch('/api/send', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, action: 'cancel' }),
    });
    setCampaignStatus('cancelled');
    setSending(false);
    loadData();
  };

  if (loading) {
    return <div className="spinner-overlay"><span className="spinner" /> Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="empty-state"><h3>Campaign not found</h3><button className="btn btn-ghost" onClick={onBack}>Go Back</button></div>;
  }

  const sentCount = contacts.filter(c => c.status === 'sent').length;
  const failedCount = contacts.filter(c => c.status === 'failed').length;
  const skipCount = contacts.filter(c => c.status === 'skipped').length;
  const dupCount = contacts.filter(c => c.status === 'duplicate').length;
  const invalidCount = contacts.filter(c => c.status === 'invalid').length;
  const readyCount = contacts.filter(c => c.status === 'ready' || c.status === 'draft').length;
  const sendingCount = contacts.filter(c => c.status === 'sending').length;

  const repliedCount = contacts.filter(c => c.followup_status === 'replied').length;
  const nowMs = Date.now();
  const dueFollowupCount = contacts.filter(c => {
    if (c.status !== 'sent' || c.followup_status === 'replied' || c.followup_status === 'stopped' || (c.followup_count || 0) >= 2) {
      return false;
    }
    if (c.next_followup_at) {
      return new Date(c.next_followup_at).getTime() <= nowMs;
    }
    if (c.sent_at) {
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const baseTime = new Date(c.last_followup_at || c.sent_at).getTime();
      return (nowMs - baseTime) >= fiveDaysMs;
    }
    return false;
  }).length;

  const scheduledCount = contacts.filter(c =>
    c.status === 'sent' &&
    c.followup_status === 'scheduled' &&
    (c.followup_count || 0) < 2 &&
    c.next_followup_at &&
    new Date(c.next_followup_at).getTime() > nowMs
  ).length;
  const followup1Count = contacts.filter(c => (c.followup_count || 0) >= 1).length;
  const followup2Count = contacts.filter(c => (c.followup_count || 0) >= 2).length;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
            <div>
              <h1 className="page-title">{campaign.name}</h1>
              <p className="page-subtitle">
                <span className={`status-badge ${campaign.status}`}>{campaign.status}</span>
                {' · '}{contacts.length} contacts
                {campaign.resume_filename && <> · <FileIcon style={{ width: 12, height: 12, display: 'inline' }} /> {campaign.resume_filename}</>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {sentCount > 0 && (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCheckReplies}
                  disabled={checkingReplies}
                  title="Check Gmail for replies from contacts"
                >
                  {checkingReplies ? <><span className="spinner" /> Checking...</> : <>💬 Check Replies</>}
                </button>
                {dueFollowupCount > 0 && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleProcessDueFollowups}
                    disabled={sendingFollowups}
                  >
                    {sendingFollowups ? <><span className="spinner" /> Sending...</> : <>↻ Send Due Follow-ups ({dueFollowupCount})</>}
                  </button>
                )}
              </>
            )}
            {sending && (
              <>
                {campaignStatus === 'paused' ? (
                  <button className="btn btn-ghost btn-sm" onClick={handleResume}><PlayIcon /> Resume</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={handlePause}><PauseIcon /> Pause</button>
                )}
                <button className="btn btn-danger btn-sm" onClick={handleCancel}><SquareIcon /> Cancel</button>
              </>
            )}
            {!sending && canSend && (
              <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>
                <SendIcon /> Send Selected ({selectedToSend.length})
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={loadData}><RefreshIcon /></button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-value">{contacts.length}</div><div className="stat-label">Total</div></div>
          <div className="stat-card"><div className="stat-value">{readyCount}</div><div className="stat-label">Ready</div></div>
          <div className="stat-card"><div className="stat-value">{sentCount}</div><div className="stat-label">Sent</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: failedCount > 0 ? '#f43f5e' : '#ffffff' }}>{failedCount}</div><div className="stat-label">Failed</div></div>
          <div className="stat-card"><div className="stat-value">{skipCount}</div><div className="stat-label">Skipped</div></div>
          <div className="stat-card"><div className="stat-value">{dupCount}</div><div className="stat-label">Duplicates</div></div>
        </div>

        {/* 5-Day Automated Follow-up Pipeline Strip */}
        {sentCount > 0 && (
          <div className="card" style={{ marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🔄 5-Day Automated Follow-up Cadence</span>
                  <span className="tag" style={{ background: '#18181b', color: '#ffffff', borderColor: '#3f3f46' }}>2 Follow-ups Max</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Follow-ups are automatically cancelled if the recipient replies or sends an email.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{repliedCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>💬 Replied (Stopped)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: dueFollowupCount > 0 ? '#ffffff' : 'var(--text-secondary)' }}>{dueFollowupCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>⏳ Due Now</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{followup1Count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Stage 1 Sent</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{followup2Count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Stage 2 Sent</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sending progress */}
        {sending && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span className="spinner" />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {campaignStatus === 'paused' ? 'Campaign Paused' : 'Sending emails...'}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${((sentCount + failedCount + skipCount) / contacts.length) * 100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {sentCount + failedCount + skipCount} of {contacts.length} processed · {sendingCount} sending
              </div>
            </div>
          </div>
        )}

        {/* Due Follow-ups Alert Banner */}
        {dueFollowupCount > 0 && !sending && (
          <div className="card" style={{ marginBottom: 20, borderColor: '#ffffff', background: '#121215' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <span>⏳</span> {dueFollowupCount} Follow-up{dueFollowupCount > 1 ? 's' : ''} Due Today (5 Days Elapsed)
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  5 days have passed since your initial outreach without a reply. Gmail inbox was auto-checked to ensure recruiters who replied aren&apos;t messaged.
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleProcessDueFollowups}
                disabled={sendingFollowups}
              >
                {sendingFollowups ? <><span className="spinner" /> Sending...</> : <>↻ Send Due Follow-ups ({dueFollowupCount})</>}
              </button>
            </div>
          </div>
        )}

        {/* Error Alert Banner if any failed contacts */}
        {contacts.some(c => c.status === 'failed' || (c.error_message && c.status !== 'sent')) && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ maxWidth: '75%' }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <span>⚠️</span> Sending Issue Detected
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                  {contacts.find(c => c.error_message?.includes('Gmail API has not been used')) ? (
                    <>
                      <strong>Gmail API is disabled in your Google Cloud project.</strong> Google requires you to enable the Gmail API service before emails can be sent.
                    </>
                  ) : (
                    contacts.find(c => c.error_message)?.error_message || 'Some emails could not be sent. Check details below.'
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {contacts.some(c => c.error_message?.includes('Gmail API has not been used')) && (
                  <a
                    href="https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=563331225192"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Enable Gmail API ↗
                  </a>
                )}
                <button className="btn btn-warning btn-sm" onClick={retryAllFailed}>
                  ↻ Retry Failed ({contacts.filter(c => c.status === 'failed' || c.status === 'skipped').length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contacts table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Contacts & Generated Emails</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="checkbox-wrapper" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={contacts.length > 0 && contacts.filter(c => c.status !== 'sent' && c.status !== 'invalid').every(c => c.is_selected)} onChange={toggleSelectAll} />
                Select All
              </label>
            </div>
          </div>
          <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Row</th>
                  <th>Name / Professor</th>
                  <th>Official Email</th>
                  <th>Institution / Company</th>
                  <th>Research Area / Role</th>
                  <th>Subject</th>
                  <th>CV Attached</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(contact => {
                  let validationErrors: string[] = [];
                  try { validationErrors = contact.validation_errors ? JSON.parse(contact.validation_errors) : []; } catch { /* ignore */ }

                  const isDue = contact.status === 'sent' &&
                    contact.followup_status !== 'replied' &&
                    contact.followup_status !== 'stopped' &&
                    (contact.followup_count || 0) < 2 &&
                    contact.next_followup_at &&
                    new Date(contact.next_followup_at) <= new Date();

                  const daysUntilNext = contact.next_followup_at
                    ? Math.max(1, Math.ceil((new Date(contact.next_followup_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : 0;

                  return (
                    <tr
                      key={contact.id}
                      className={contact.status === 'invalid' ? 'row-invalid' : contact.status === 'duplicate' ? 'row-duplicate' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={!!contact.is_selected}
                          disabled={contact.status === 'sent' || contact.status === 'invalid'}
                          onChange={() => toggleContactSelection(contact)}
                        />
                      </td>
                      <td style={{ color: 'var(--text-tertiary)' }}>{contact.row_number}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{contact.hr_name}</td>
                      <td><span className="truncate" style={{ maxWidth: 180 }}>{contact.hr_email}</span></td>
                      <td>{contact.company_name}</td>
                      <td>{contact.role}</td>
                      <td><span className="truncate" style={{ maxWidth: 200 }}>{contact.edited_subject || contact.generated_subject || '—'}</span></td>
                      <td>
                        {campaign.resume_filename ? (
                          <span className="tag"><FileIcon style={{ width: 12, height: 12 }} /> ✓</span>
                        ) : (
                          <span className="tag" style={{ color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${contact.status}`}>{contact.status}</span>
                        {contact.error_message && (
                          <div style={{ fontSize: 11, color: '#f43f5e', marginTop: 4, maxWidth: 280, wordBreak: 'break-word', lineHeight: 1.3 }}>
                            {contact.error_message.includes('Gmail API has not been used') ? (
                              <>
                                <span>Gmail API disabled in project.</span>{' '}
                                <a
                                  href="https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=563331225192"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#ffffff', textDecoration: 'underline' }}
                                >
                                  Enable API ↗
                                </a>
                              </>
                            ) : (
                              contact.error_message
                            )}
                          </div>
                        )}
                        {validationErrors.length > 0 && (
                          <div style={{ fontSize: 10, color: '#f43f5e', marginTop: 4 }}>
                            {validationErrors.join('; ')}
                          </div>
                        )}
                        {contact.duplicate_reason && (
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {contact.duplicate_reason}
                          </div>
                        )}
                      </td>
                      <td>
                        {(() => {
                          if (contact.followup_status === 'replied') {
                            return (
                              <span
                                className="status-badge replied"
                                title={contact.replied_at ? `Recruiter replied on ${new Date(contact.replied_at).toLocaleString()}` : 'Recruiter replied'}
                              >
                                💬 Replied
                              </span>
                            );
                          }
                          if (contact.followup_status === 'stopped') {
                            return <span className="status-badge stopped" title="Automated follow-ups stopped">⏹ Stopped</span>;
                          }
                          if ((contact.followup_count || 0) >= 2) {
                            return <span className="status-badge sent" title="Both follow-ups sent">✓ 2/2 Sent</span>;
                          }
                          if (contact.status === 'sent') {
                            if (!contact.sent_at) {
                              return <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Sent</span>;
                            }

                            const stageNum = (contact.followup_count || 0) + 1;
                            const baseDateStr = contact.last_followup_at || contact.sent_at;
                            const baseDate = new Date(baseDateStr);
                            const now = Date.now();

                            const targetDate = contact.next_followup_at
                              ? new Date(contact.next_followup_at)
                              : new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000);

                            const diffMs = targetDate.getTime() - now;
                            const daysSinceSend = Math.floor((now - new Date(contact.sent_at).getTime()) / (1000 * 60 * 60 * 24));

                            if (diffMs <= 0) {
                              return (
                                <span
                                  className="status-badge followup_due"
                                  title={`Initial email sent on ${new Date(contact.sent_at).toLocaleString()} (${daysSinceSend}d ago). Due date: ${targetDate.toLocaleDateString()}.`}
                                >
                                  ⏳ Stage {stageNum} Due ({daysSinceSend}d ago)
                                </span>
                              );
                            } else {
                              const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
                              const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                              const timeLabel = totalDays > 1 ? `in ${totalDays}d` : `in ${totalHours}h`;

                              return (
                                <span
                                  className="status-badge scheduled"
                                  title={`Initial email sent on ${new Date(contact.sent_at).toLocaleString()} (${daysSinceSend}d ago). Follow-up ${stageNum} scheduled for ${targetDate.toLocaleString()} (exactly 5 days from send).`}
                                >
                                  ↻ Stage {stageNum} {timeLabel}
                                </span>
                              );
                            }
                          }
                          return <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>;
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button className="btn btn-ghost btn-sm" title="Preview" onClick={() => { setPreviewContact(contact); setPreviewTab('initial'); }}>
                            <EyeIcon />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Edit"
                            disabled={contact.status === 'sent'}
                            onClick={() => setEditingContact({ ...contact })}
                          >
                            <EditIcon />
                          </button>
                          {contact.status === 'duplicate' && (
                            <button className="btn btn-ghost btn-sm" title="Override duplicate" onClick={() => overrideDuplicate(contact)} style={{ color: '#ffffff' }}>
                              ↻
                            </button>
                          )}
                          {(contact.status === 'failed' || contact.status === 'skipped') && (
                            <button
                              className="btn btn-ghost btn-sm"
                              title="Reset to ready & retry"
                              onClick={() => retryContact(contact)}
                              style={{ color: '#ffffff', fontWeight: 600 }}
                            >
                              ↻
                            </button>
                          )}
                          {/* Follow-up controls for sent contacts */}
                          {contact.status === 'sent' && contact.followup_status !== 'replied' && (contact.followup_count || 0) < 2 && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                title={`Send Follow-up ${(contact.followup_count || 0) + 1} now`}
                                onClick={() => handleSendSingleFollowup(contact)}
                                style={{ color: '#ffffff', fontSize: 12, padding: '2px 6px' }}
                              >
                                ↻ {(contact.followup_count || 0) + 1}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Stop automated follow-ups for this contact"
                                onClick={() => handleStopFollowup(contact)}
                                style={{ color: 'var(--text-tertiary)', fontSize: 11, padding: '2px 6px' }}
                              >
                                ⏹
                              </button>
                            </>
                          )}
                          {contact.status !== 'sent' && contact.status !== 'skipped' && contact.status !== 'failed' && (
                            <button className="btn btn-ghost btn-sm" title="Skip" onClick={() => skipContact(contact)} style={{ color: 'var(--text-tertiary)' }}>
                              ⊘
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewContact && (
        <div className="modal-overlay" onClick={() => { setPreviewContact(null); setPreviewTab('initial'); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="modal-header">
              <h3 className="modal-title">Email & Follow-up Preview</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setPreviewContact(null); setPreviewTab('initial'); }}><XIcon /></button>
            </div>
            <div className="modal-body">
              {/* Preview Tabs */}
              <div className="tab-row" style={{ marginBottom: 16 }}>
                <div
                  className={`tab-item ${previewTab === 'initial' ? 'active' : ''}`}
                  onClick={() => setPreviewTab('initial')}
                >
                  ✉️ Initial Email
                </div>
                <div
                  className={`tab-item ${previewTab === 'followup1' ? 'active' : ''}`}
                  onClick={() => setPreviewTab('followup1')}
                >
                  ↻ Follow-up 1 (Day 5)
                </div>
                <div
                  className={`tab-item ${previewTab === 'followup2' ? 'active' : ''}`}
                  onClick={() => setPreviewTab('followup2')}
                >
                  ↻ Follow-up 2 (Day 10)
                </div>
              </div>

              <div className="email-preview">
                <div className="email-preview-subject">
                  {previewTab === 'initial'
                    ? (previewContact.edited_subject || previewContact.generated_subject)
                    : previewTab === 'followup1'
                      ? (campaign.followup_1_subject || DEFAULT_FOLLOWUP_1_SUBJECT)
                          .replace(/\{\{role\}\}/g, previewContact.role)
                          .replace(/\{\{company\}\}/g, previewContact.company_name)
                      : (campaign.followup_2_subject || DEFAULT_FOLLOWUP_2_SUBJECT)
                          .replace(/\{\{role\}\}/g, previewContact.role)
                          .replace(/\{\{company\}\}/g, previewContact.company_name)
                  }
                </div>
                <div className="email-preview-meta">
                  To: {previewContact.hr_email} · From: {gmailEmail}
                  {campaign.resume_filename && <> · 📎 {campaign.resume_filename}</>}
                  {previewTab !== 'initial' && <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>· In-thread follow-up</span>}
                </div>
                <div className="email-preview-body">
                  {previewTab === 'initial'
                    ? (previewContact.edited_body || previewContact.generated_body)
                    : previewTab === 'followup1'
                      ? (campaign.followup_1_body || DEFAULT_FOLLOWUP_1_BODY)
                          .replace(/\{\{hr_name\}\}/g, previewContact.hr_name)
                          .replace(/\{\{company\}\}/g, previewContact.company_name)
                          .replace(/\{\{role\}\}/g, previewContact.role)
                          .replace(/\{\{user_name\}\}/g, 'Paras Gupta')
                          .replace(/\{\{user_phone\}\}/g, '7428065794')
                          .replace(/\{\{user_linkedin\}\}/g, '')
                          .replace(/\{\{user_github\}\}/g, '')
                      : (campaign.followup_2_body || DEFAULT_FOLLOWUP_2_BODY)
                          .replace(/\{\{hr_name\}\}/g, previewContact.hr_name)
                          .replace(/\{\{company\}\}/g, previewContact.company_name)
                          .replace(/\{\{role\}\}/g, previewContact.role)
                          .replace(/\{\{user_name\}\}/g, 'Paras Gupta')
                          .replace(/\{\{user_phone\}\}/g, '7428065794')
                          .replace(/\{\{user_linkedin\}\}/g, '')
                          .replace(/\{\{user_github\}\}/g, '')
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingContact && (
        <EditContactModal
          contact={editingContact}
          onSave={async (updated) => {
            await fetch('/api/contacts', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: updated.id,
                edited_subject: updated.edited_subject,
                edited_body: updated.edited_body,
                hr_email: updated.hr_email,
                hr_name: updated.hr_name,
                role: updated.role,
                company_name: updated.company_name,
              }),
            });
            setEditingContact(null);
            loadData();
          }}
          onCancel={() => setEditingContact(null)}
        />
      )}

      {/* Send Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-body">
              <div className="confirm-box">
                <SendIcon style={{ width: 40, height: 40, color: '#ffffff', margin: '0 auto 16px' }} />
                <h3>Confirm Send</h3>
                <p>You are about to send <strong>{selectedToSend.length}</strong> emails.</p>
                <div className="confirm-details">
                  <div><strong>From:</strong> {gmailEmail}</div>
                  <div><strong>Emails:</strong> {selectedToSend.length} recipients</div>
                  <div><strong>Attachment:</strong> {campaign.resume_filename || 'None'}</div>
                  <div><strong>Delay:</strong> {(campaign.delay_ms / 1000).toFixed(1)}s between emails</div>
                </div>
                <div className="confirm-actions">
                  <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
                  <button className="btn btn-primary btn-lg" onClick={handleSend}>
                    <SendIcon /> Confirm & Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ─── Edit Contact Modal ──────────────────────────────────
function EditContactModal({ contact, onSave, onCancel }: {
  contact: Contact;
  onSave: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const [edited, setEdited] = useState<Contact>({ ...contact });

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Email for {contact.hr_name}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}><XIcon /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name / Professor</label>
              <input
                className="form-input"
                value={edited.hr_name}
                onChange={e => setEdited(p => ({ ...p, hr_name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Official / Contact Email</label>
              <input
                className="form-input"
                value={edited.hr_email}
                onChange={e => setEdited(p => ({ ...p, hr_email: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Institution / Company</label>
              <input
                className="form-input"
                value={edited.company_name}
                onChange={e => setEdited(p => ({ ...p, company_name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Research Area / Role</label>
              <input
                className="form-input"
                value={edited.role}
                onChange={e => setEdited(p => ({ ...p, role: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input
              className="form-input"
              value={edited.edited_subject || edited.generated_subject || ''}
              onChange={e => setEdited(p => ({ ...p, edited_subject: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Body</label>
            <textarea
              className="form-textarea"
              rows={14}
              value={edited.edited_body || edited.generated_body || ''}
              onChange={e => setEdited(p => ({ ...p, edited_body: e.target.value }))}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(edited)}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  CAMPAIGN HISTORY VIEW
// ═══════════════════════════════════════════════════════════
function HistoryView({ campaigns, onOpenCampaign, onBack, onRefresh }: {
  campaigns: Campaign[];
  onOpenCampaign: (id: string) => void;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Campaign History</h1>
            <p className="page-subtitle">All your past outreach campaigns</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh}><RefreshIcon /> Refresh</button>
        </div>
      </div>

      <div className="page-body">
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <HistoryIcon />
            <h3>No campaigns yet</h3>
            <p>Your campaign history will appear here after you create and run campaigns.</p>
          </div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Contacts</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Skipped</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id} onClick={() => onOpenCampaign(c.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</td>
                    <td>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td><span className={`status-badge ${c.status}`}>{c.status}</span></td>
                    <td>{c.total_contacts || 0}</td>
                    <td style={{ color: '#ffffff' }}>{c.sent_count || 0}</td>
                    <td style={{ color: c.failed_count ? '#f43f5e' : 'var(--text-tertiary)' }}>{c.failed_count || 0}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.skipped_count || 0}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(e, c.id)} title="Delete campaign">
                        <TrashIcon style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
