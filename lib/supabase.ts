import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';

const ADMIN_COOKIE = 'np_admin';
const ADMIN_MAX_AGE = 60 * 60 * 24 * 30;
const BROWSER_COOKIE = 'np_browser';
const BROWSER_MAX_AGE = 60 * 60 * 24 * 365;

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

/** Stable session token derived from the admin password. */
function adminToken(password: string): string {
  return createHash('sha256').update(`npvote-admin:${password}`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function adminCookie(token: string): string {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_MAX_AGE}`;
}

export function clearedCookies(): string[] {
  return [`${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`];
}

export type AdminSession = { cookies: string[] };

/**
 * Checks the browser's admin cookie against a token derived from the
 * server-side ADMIN_PASSWORD. Returns null when the cookie is missing or wrong.
 */
export function adminSession(request: Request): AdminSession | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const value = cookie(request, ADMIN_COOKIE);
  return value && safeEqual(value, adminToken(password)) ? { cookies: [] } : null;
}

/** Compares the submitted password with ADMIN_PASSWORD and returns the cookie. */
export function adminLogin(password: string): { cookies: string[] } | { error: string } {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { error: 'Kata sandi admin belum dikonfigurasi di server.' };
  if (!safeEqual(password, expected)) return { error: 'Kata sandi salah.' };
  return { cookies: [adminCookie(adminToken(expected))] };
}
