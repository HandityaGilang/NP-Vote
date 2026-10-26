import { adminSession, db, json, sameOrigin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Deletes every vote and reopens the event for testing.
 * Because votes are keyed by the `np_browser` cookie, clearing the rows lets
 * every device that still holds its cookie vote again.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);

  const session = await adminSession(request);
  if (!session) return json({ error: 'Akses admin ditolak.' }, 401);

  const client = db();
  // `browser` is the primary key, so it is never null: this matches every row.
  const { data, error } = await client.from('votes').delete().not('browser', 'is', null).select('browser');
  if (error) return json({ error: 'Gagal menghapus suara.' }, 500, session.cookies);

  return json({ ok: true, deleted: data?.length ?? 0 }, 200, session.cookies);
}
