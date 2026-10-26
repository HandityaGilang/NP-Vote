import { candidateCount } from '@/app/config';
import { adminSession, db, json, sameOrigin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Matches the bucket's file_size_limit in npvote_contestants.sql. */
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Replaces one contestant photo. The browser compresses the image to a JPEG
 * before sending, so only image/jpeg is accepted and the object is overwritten.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Permintaan tidak valid.' }, 403);

  const session = await adminSession(request);
  if (!session) return json({ error: 'Akses admin ditolak.' }, 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Data tidak valid.' }, 400);
  }

  const number = Number(form.get('id'));
  if (!Number.isInteger(number) || number < 1 || number > candidateCount) {
    return json({ error: 'Peserta tidak valid.' }, 400);
  }

  const photo = form.get('photo');
  if (!(photo instanceof File)) return json({ error: 'Foto tidak ditemukan.' }, 400);
  if (photo.type !== 'image/jpeg') return json({ error: 'Foto harus berupa gambar JPG.' }, 400);
  if (photo.size === 0 || photo.size > MAX_BYTES) return json({ error: 'Ukuran foto terlalu besar.' }, 400);

  const client = db();
  const path = `peserta-${String(number).padStart(2, '0')}.jpg`;
  const body = Buffer.from(await photo.arrayBuffer());

  const uploaded = await client.storage
    .from('photos')
    .upload(path, body, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
  if (uploaded.error) return json({ error: 'Gagal mengunggah foto.' }, 500, session.cookies);

  // The cache-buster makes browsers reload the photo after a replacement.
  const url = `${client.storage.from('photos').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const saved = await client
    .from('contestants')
    .update({ photo: url, updated_at: new Date().toISOString() })
    .eq('id', number);
  if (saved.error) return json({ error: 'Gagal menyimpan foto.' }, 500, session.cookies);

  return json({ ok: true, id: number, photo: url, bytes: body.length }, 200, session.cookies);
}
