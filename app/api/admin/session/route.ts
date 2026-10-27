import { adminLogin, clearedCookies, json, sameOrigin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Data tidak valid.' }, 400);
  }

  const { password } = (body ?? {}) as { password?: unknown };
  if (typeof password !== 'string' || password.length < 1 || password.length > 200) {
    return json({ error: 'Kata sandi tidak valid.' }, 400);
  }

  const result = adminLogin(password);
  if ('error' in result) return json({ error: result.error }, 401);
  return json({ ok: true }, 200, result.cookies);
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);
  return json({ ok: true }, 200, clearedCookies());
}
