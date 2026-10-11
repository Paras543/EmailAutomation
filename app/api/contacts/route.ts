import { NextRequest, NextResponse } from 'next/server';
import { getContactsByCampaign, updateContact } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const campaignId = searchParams.get('campaign_id');

  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
  }

  try {
    const contacts = getContactsByCampaign(campaignId);
    return NextResponse.json({ contacts });
  } catch (error: unknown) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: 'Contact ID required' }, { status: 400 });
    }
    updateContact(id, data);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating contact:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}
