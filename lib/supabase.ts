import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const ADMIN_COOKIE = 'np_admin';
const ADMIN_REFRESH_COOKIE = 'np_admin_refresh';
const BROWSER_COOKIE = 'np_browser';
const BROWSER_MAX_AGE = 60 * 60 * 24 * 365;
const ADMIN_REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}.`);
  return value;
}

/** Server-only Supabase client. Uses the service role key, never the anon key. */
export function db(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function json(data: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return Response.json(data, { status, headers });
}

/**
 * Rejects cross-site requests. Browsers always send Origin on POST, so a
 * mismatching value means the request did not come from our own pages.
 * Requests without Origin (curl, server-to-server) are allowed.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function cookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the voting cookie, accepting only well-formed UUIDs. */
export function browserId(request: Request): string | undefined {
  const value = cookie(request, BROWSER_COOKIE);
  return value && UUID.test(value) ? value.toLowerCase() : undefined;
}

export function browserCookie(id: string): string {
  return `${BROWSER_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${BROWSER_MAX_AGE}`;
}

function sessionCookies(session: Session): string[] {
  const accessAge = Math.max(Number(session.expires_in) || 3600, 60);
  return [
    `${ADMIN_COOKIE}=${session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${accessAge}`,
    `${ADMIN_REFRESH_COOKIE}=${session.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_REFRESH_MAX_AGE}`,
  ];
}

export function clearedCookies(): string[] {
  const clear = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  return [`${ADMIN_COOKIE}=; ${clear}`, `${ADMIN_REFRESH_COOKIE}=; ${clear}`];
}

export type AdminSession = { email: string; cookies: string[] };

function allowedAdmin(): string | undefined {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return value || undefined;
}

/**
 * Verifies the Supabase session cookie and matches it against ADMIN_EMAIL.
 * Returns null for anonymous users, unknown accounts and expired sessions.
 */
export async function adminSession(request: Request): Promise<AdminSession | null> {
  const allowed = allowedAdmin();
  if (!allowed) return null;

  const client = db();
  const access = cookie(request, ADMIN_COOKIE);
  const refresh = cookie(request, ADMIN_REFRESH_COOKIE);
  const cookies: string[] = [];
  let email: string | undefined;

  if (access) {
    const { data } = await client.auth.getUser(access);
    email = data.user?.email?.toLowerCase();
  }

  if (!email && refresh) {
    const { data } = await client.auth.refreshSession({ refresh_token: refresh });
    if (data.session && data.user?.email) {
      email = data.user.email.toLowerCase();
      cookies.push(...sessionCookies(data.session));
    }
  }

  if (email !== allowed) return null;
  return { email, cookies };
}

/** Signs an admin in with email/password and returns the cookies to set. */
export async function signIn(
  email: string,
  password: string,
): Promise<{ cookies: string[] } | { error: string }> {
  const allowed = allowedAdmin();
  if (!allowed) return { error: 'Akun admin belum dikonfigurasi di server.' };

  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return { error: 'Email atau kata sandi salah.' };
  }
  if ((data.user.email ?? '').toLowerCase() !== allowed) {
    return { error: 'Akun ini tidak diizinkan sebagai admin.' };
  }
  return { cookies: sessionCookies(data.session) };
}
