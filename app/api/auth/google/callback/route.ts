import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/gmail';
import { saveOAuthTokens } from '@/lib/db';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?auth_error=no_code', request.url)
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // Get user's email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    saveOAuthTokens({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date?.toString(),
      gmail_address: userInfo.email || undefined,
    });

    return NextResponse.redirect(new URL('/?auth_success=true', request.url));
  } catch (err: unknown) {
    console.error('OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
