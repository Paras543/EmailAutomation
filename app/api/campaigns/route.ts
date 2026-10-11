import { NextRequest, NextResponse } from 'next/server';
import { createCampaign, getAllCampaigns, getCampaign, updateCampaign, deleteCampaign, getCampaignStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  try {
    if (id) {
      const campaign = getCampaign(id);
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      const stats = getCampaignStats(id);
      return NextResponse.json({ campaign, stats });
    }

    const campaigns = getAllCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error: unknown) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = createCampaign({
      name: body.name || `Campaign ${new Date().toLocaleDateString()}`,
      template_subject: body.template_subject,
      template_body: body.template_body,
      resume_filename: body.resume_filename,
      resume_path: body.resume_path,
      gmail_account: body.gmail_account,
      delay_ms: body.delay_ms,
      max_per_campaign: body.max_per_campaign,
      followup_enabled: body.followup_enabled,
      followup_delay_days: body.followup_delay_days,
      max_followups: body.max_followups,
      followup_1_subject: body.followup_1_subject,
      followup_1_body: body.followup_1_body,
      followup_2_subject: body.followup_2_subject,
      followup_2_body: body.followup_2_body,
    });
    return NextResponse.json({ id, success: true });
  } catch (error: unknown) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }
    updateCampaign(id, data);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }
    deleteCampaign(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
