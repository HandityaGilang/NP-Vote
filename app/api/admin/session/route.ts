import { clearedCookies, json, sameOrigin, signIn } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Data tidak valid.' }, 400);
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.trim().length < 3 ||
    email.length > 200 ||
    !email.includes('@') ||
    password.length < 1 ||
    password.length > 200
  ) {
    return json({ error: 'Email atau kata sandi tidak valid.' }, 400);
  }

  try {
    const result = await signIn(email.trim(), password);
    if ('error' in result) return json({ error: result.error }, 401);
    return json({ ok: true }, 200, result.cookies);
  } catch {
    return json({ error: 'Login gagal. Coba lagi.' }, 500);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);
  return json({ ok: true }, 200, clearedCookies());
}
