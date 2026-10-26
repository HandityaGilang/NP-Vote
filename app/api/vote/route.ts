import { candidateCount } from '@/app/config';
import { browserId, db, json, sameOrigin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);

  const id = browserId(request);
  if (!id) return json({ error: 'Aktifkan cookie, lalu muat ulang halaman.' }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Data tidak valid.' }, 400);
  }

  const candidate = Number((body as { candidate?: unknown } | null)?.candidate);
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > candidateCount) {
    return json({ error: 'Peserta tidak valid.' }, 400);
  }

  try {
    // Single atomic call: checks the open flag and keeps the first vote.
    const { data, error } = await db().rpc('cast_vote', { p_browser: id, p_candidate: candidate });
    if (error) return json({ error: 'Gagal menyimpan suara. Coba lagi.' }, 500);

    const result = (data ?? {}) as { status?: string; candidate?: unknown };
    if (result.status === 'voted') {
      const stored = Number(result.candidate);
      if (Number.isInteger(stored)) return json({ voted: stored });
    }
    if (result.status === 'closed') return json({ error: 'Voting sedang ditutup.' }, 409);
    return json({ error: 'Suara tidak dapat disimpan.' }, 400);
  } catch {
    return json({ error: 'Gagal menyimpan suara. Coba lagi.' }, 500);
  }
}
