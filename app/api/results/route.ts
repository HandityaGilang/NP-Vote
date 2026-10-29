import { db, json } from '@/lib/supabase';
import { presentationValues } from '@/lib/presentation';

export const dynamic = 'force-dynamic';

const TOP = 3;

/**
 * Public, read-only results feed used by /hasil.
 * Returns only aggregate counts: no voter information is exposed.
 *
 * Each row carries the real total (`actualVotes`) plus the number shown on the
 * page (`displayValue`). Ranking, totals and percentages always come from the
 * real votes; the presentation values only exist once voting is closed.
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
    const open = settings.data?.open === true;

    const ranked = (list.data ?? [])
      .map((item) => {
        const row = rows.find((entry) => Number(entry.candidate) === Number(item.id));
        return {
          id: Number(item.id),
          name: String(item.name),
          photo: String(item.photo ?? ''),
          actualVotes: Number(row?.total ?? 0),
        };
      })
      .filter((item) => item.actualVotes > 0)
      .sort((a, b) => b.actualVotes - a.actualVotes || a.id - b.id)
      .slice(0, TOP);

    const shown = open
      ? ranked.map((item) => item.actualVotes)
      : presentationValues(ranked.map((item) => item.actualVotes));

    const top = ranked.map((item, index) => ({
      ...item,
      displayValue: shown[index] ?? item.actualVotes,
      pct: total ? (item.actualVotes / total) * 100 : 0,
    }));

    return json({ open, total, top });
  } catch {
    return json({ error: 'Gagal memuat hasil.' }, 500);
  }
}
