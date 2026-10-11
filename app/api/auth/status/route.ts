import { NextResponse } from 'next/server';
import { getOAuthTokens, deleteOAuthTokens } from '@/lib/db';

export async function GET() {
  try {
    const tokens = getOAuthTokens();
    if (tokens && tokens.gmail_address) {
      return NextResponse.json({
        connected: true,
        email: tokens.gmail_address,
      });
    }
    return NextResponse.json({ connected: false });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  try {
    deleteOAuthTokens();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error disconnecting Gmail:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail' },
      { status: 500 }
    );
  }
}
