import { randomUUID } from 'node:crypto';
import { candidateCount } from '@/app/config';
import { adminSession, db, json, sameOrigin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Testing helper for the dashboard: adds or removes one vote for a contestant so
 * the results page can be checked without waiting for real voters.
 *
 * "+1" inserts a row with a random browser id; "-1" deletes one existing row for
 * that contestant. These are ordinary rows: they count everywhere and are wiped
 * by "Hapus semua suara" on /admin.
 */
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

  const payload = body as { id?: unknown; delta?: unknown } | null;
  const id = Number(payload?.id);
  const delta = Number(payload?.delta);
  if (!Number.isInteger(id) || id < 1 || id > candidateCount) {
    return json({ error: 'Peserta tidak valid.' }, 400);
  }
  if (delta !== 1 && delta !== -1) return json({ error: 'Data tidak valid.' }, 400);

  const client = db();

  if (delta === 1) {
    const { error } = await client.from('votes').insert({ browser: randomUUID(), candidate: id });
    if (error) return json({ error: 'Gagal menambah suara.' }, 500, session.cookies);
    return json({ ok: true, id, delta }, 200, session.cookies);
  }

  // Remove exactly one row: pick a browser id first, then delete that row.
  const found = await client.from('votes').select('browser').eq('candidate', id).limit(1).maybeSingle();
  if (found.error) return json({ error: 'Gagal menghapus suara.' }, 500, session.cookies);

  const target = found.data as { browser: string } | null;
  if (!target) return json({ error: 'Belum ada suara untuk peserta ini.' }, 409, session.cookies);

  const { error } = await client.from('votes').delete().eq('browser', target.browser);
  if (error) return json({ error: 'Gagal menghapus suara.' }, 500, session.cookies);

  return json({ ok: true, id, delta }, 200, session.cookies);
}
