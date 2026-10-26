import { adminSession, db, json, sameOrigin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await adminSession(request);
  if (!session) return json({ error: 'Akses admin ditolak.' }, 401);

  try {
    const client = db();
    const [settings, tally, list] = await Promise.all([
      client.from('settings').select('open, updated_at').eq('id', 'event').maybeSingle(),
      client.from('vote_tally').select('candidate, total'),
      client.from('contestants').select('id, name, photo').order('id'),
    ]);
    if (settings.error || tally.error || list.error) {
      return json({ error: 'Gagal memuat data.' }, 500, session.cookies);
    }

    const rows: { candidate: number; total: number | string }[] = tally.data ?? [];
    const counts = (list.data ?? []).map((item) => {
      const row = rows.find((entry) => Number(entry.candidate) === Number(item.id));
      return {
        id: Number(item.id),
        name: String(item.name),
        photo: String(item.photo ?? ''),
        total: Number(row?.total ?? 0),
      };
    });

    return json(
      {
        open: settings.data?.open === true,
        updated: new Date().toISOString(),
        total: counts.reduce((sum, item) => sum + item.total, 0),
        counts,
      },
      200,
      session.cookies,
    );
  } catch {
    return json({ error: 'Gagal memuat data.' }, 500, session.cookies);
  }
}

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

  const open = (body as { open?: unknown } | null)?.open;
  if (typeof open !== 'boolean') return json({ error: 'Data tidak valid.' }, 400);

  const { error } = await db()
    .from('settings')
    .upsert({ id: 'event', open, updated_at: new Date().toISOString() });
  if (error) return json({ error: 'Gagal menyimpan status voting.' }, 500, session.cookies);

  return json({ ok: true, open }, 200, session.cookies);
}
