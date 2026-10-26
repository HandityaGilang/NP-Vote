import { db, json } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TOP = 3;

/**
 * Public, read-only results feed used by /hasil.
 * Returns only aggregate counts: no voter information is exposed.
 */
export async function GET() {
  try {
    const client = db();
    const [settings, list, tally] = await Promise.all([
      client.from('settings').select('open').eq('id', 'event').maybeSingle(),
      client.from('contestants').select('id, name, photo').order('id'),
      client.from('vote_tally').select('candidate, total'),
    ]);
    if (settings.error || list.error || tally.error) return json({ error: 'Gagal memuat hasil.' }, 500);

    const rows: { candidate: number; total: number | string }[] = tally.data ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);

    const top = (list.data ?? [])
      .map((item) => {
        const row = rows.find((entry) => Number(entry.candidate) === Number(item.id));
        return {
          id: Number(item.id),
          name: String(item.name),
          photo: String(item.photo ?? ''),
          total: Number(row?.total ?? 0),
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.id - b.id)
      .slice(0, TOP)
      .map((item) => ({ ...item, pct: total ? (item.total / total) * 100 : 0 }));

    return json({ open: settings.data?.open === true, total, top });
  } catch {
    return json({ error: 'Gagal memuat hasil.' }, 500);
  }
}
