import { candidateCount } from '@/app/config';
import { adminSession, db, json, sameOrigin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Renames one contestant. The number (id) is fixed and cannot be changed. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);

  const session = await adminSession(request);
  if (!session) return json({ error: 'Akses admin ditolak.' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Data tidak valid.' }, 400);
  }

  const { id, name } = (body ?? {}) as { id?: unknown; name?: unknown };
  const number = Number(id);
  if (!Number.isInteger(number) || number < 1 || number > candidateCount) {
    return json({ error: 'Peserta tidak valid.' }, 400);
  }
  if (typeof name !== 'string') return json({ error: 'Nama peserta tidak valid.' }, 400);

  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!clean) return json({ error: 'Nama peserta tidak boleh kosong.' }, 400);

  const { error } = await db()
    .from('contestants')
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq('id', number);
  if (error) return json({ error: 'Gagal menyimpan nama.' }, 500, session.cookies);

  return json({ ok: true, id: number, name: clean }, 200, session.cookies);
}
