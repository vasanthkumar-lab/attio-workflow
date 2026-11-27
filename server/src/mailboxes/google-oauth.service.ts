import { Injectable, Logger } from '@nestjs/common';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Send only, plus the address so we know which mailbox was connected. Reading replies
 * would need gmail.readonly, which sits in Google's *restricted* tier and requires a
 * third-party security assessment before you can serve external users at scale -
 * a different conversation from shipping this.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface GoogleTokens {
  accessToken: string;
  /** Absent when Google decides it already gave you one; see consentUrl(). */
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  private readonly clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  private readonly redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${process.env.BASE_URL?.trim() || 'http://localhost:3000'}/mailboxes/google/callback`;

  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Step 2: where to send the salesperson's browser. */
  consentUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      // Without offline + consent Google returns no refresh token on a repeat
      // authorisation, and the connection silently dies when the access token expires.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  /** Step 7: swap the one-time code for tokens. */
  async exchangeCode(code: string): Promise<GoogleTokens> {
    return this.token({
      code,
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
  }

  async refresh(refreshToken: string): Promise<GoogleTokens> {
    return this.token({
      refresh_token: refreshToken,
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      grant_type: 'refresh_token',
    });
  }

  /** Which mailbox we just got access to. */
  async mailboxEmail(accessToken: string): Promise<string> {
    const res = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`could not read the Google profile (${res.status})`);
    const body = (await res.json()) as { email?: string };
    if (!body.email) throw new Error('Google did not return an email address');
    return body.email.toLowerCase();
  }

  private async token(form: Record<string, string>): Promise<GoogleTokens> {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await res.json().catch(() => ({}))) as TokenResponse;

    if (!res.ok || body.error || !body.access_token) {
      // invalid_grant on refresh means the user revoked access or changed their
      // password. The caller turns that into REAUTH_REQUIRED rather than retrying.
      const detail = body.error_description ?? body.error ?? `HTTP ${res.status}`;
      this.logger.warn(`Google token request failed: ${detail}`);
      throw new Error(detail);
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
      scopes: body.scope ? body.scope.split(' ') : GOOGLE_SCOPES,
    };
  }
}
