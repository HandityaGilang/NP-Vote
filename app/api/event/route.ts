import { event } from '@/app/config';
import { browserCookie, browserId, db, json } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const client = db();
    const [settings, list] = await Promise.all([
      client.from('settings').select('open').eq('id', 'event').maybeSingle(),
      client.from('contestants').select('id, name, photo').order('id'),
    ]);
    if (settings.error || list.error) return json({ error: 'Gagal memuat data peserta.' }, 500);

    const candidates = (list.data ?? []).map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      photo: String(row.photo ?? ''),
    }));

    const id = browserId(request);
    const cookies: string[] = [];
    let voted: number | null = null;

    if (id) {
      const record = await client.from('votes').select('candidate').eq('browser', id).maybeSingle();
      if (record.error) return json({ error: 'Gagal memuat status suara.' }, 500);
      voted = record.data?.candidate ?? null;
    } else {
      cookies.push(browserCookie(crypto.randomUUID()));
    }

    return json(
      {
        title: event.title,
        help: event.help,
        candidates,
        count: candidates.length,
        open: settings.data?.open === true,
        voted,
      },
      200,
      cookies,
    );
  } catch {
    return json({ error: 'Layanan belum siap. Periksa internet lalu coba lagi.' }, 500);
  }
}
