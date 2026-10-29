'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Count = { id: number; name: string; photo: string; total: number };
type Stats = { open: boolean; updated: string; total: number; counts: Count[] };
type Mode = 'loading' | 'login' | 'ready';

export default function Admin() {
  const [mode, setMode] = useState<Mode>('loading');
  const [stats, setStats] = useState<Stats | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<number | null>(null);
  const seeded = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin', { cache: 'no-store' });
      if (response.status === 401) {
        setMode('login');
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat data.');
      setStats(data);
      setMode('ready');
      setError('');
    } catch (e) {
      setError((e as Error).message || 'Gagal memuat data.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'ready') return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [mode, load]);

  // Fill the name fields once, so the 15 second refresh does not overwrite typing.
  useEffect(() => {
    if (!stats || seeded.current) return;
    seeded.current = true;
    setDrafts(Object.fromEntries(stats.counts.map((c) => [c.id, c.name])));
  }, [stats]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login gagal.');
      setPassword('');
      await load();
    } catch (e) {
      setError((e as Error).message || 'Login gagal.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setStats(null);
    setMode('login');
  }

  async function setOpen(open: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setNotice(open ? 'Voting dibuka.' : 'Voting ditutup.');
      await load();
    } catch (e) {
      setError((e as Error).message || 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus suara.');
      setNotice(data.deleted + ' suara dihapus. Semua perangkat dapat memilih lagi.');
      await load();
    } catch (e) {
      setError((e as Error).message || 'Gagal menghapus suara.');
    } finally {
      setBusy(false);
    }
  }

  async function adjust(id: number, delta: 1 | -1) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, delta }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengubah suara.');
      setNotice(
        (delta === 1 ? 'Suara ditambahkan ke ' : 'Suara dihapus dari ') +
          'peserta ' +
          String(id).padStart(2, '0') +
          '.',
      );
      await load();
    } catch (e) {
      setError((e as Error).message || 'Gagal mengubah suara.');
    } finally {
      setBusy(false);
    }
  }

  async function saveName(id: number) {
    const name = (drafts[id] ?? '').trim();
    if (!name || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/contestants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan nama.');
      setDrafts((current) => ({ ...current, [id]: data.name }));
      setStats((current) =>
        current
          ? { ...current, counts: current.counts.map((c) => (c.id === id ? { ...c, name: data.name } : c)) }
          : current,
      );
      setNotice('Nama peserta ' + String(id).padStart(2, '0') + ' disimpan.');
    } catch (e) {
      setError((e as Error).message || 'Gagal menyimpan nama.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(id: number, file: File) {
    if (uploading !== null) return;
    setUploading(id);
    setError('');
    setNotice('');
    try {
      const { blob, width, height } = await compress(file);
      const form = new FormData();
      form.append('id', String(id));
      form.append('photo', blob, 'foto.jpg');
      const response = await fetch('/api/admin/photo', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengunggah foto.');
      setStats((current) =>
        current
          ? { ...current, counts: current.counts.map((c) => (c.id === id ? { ...c, photo: data.photo } : c)) }
          : current,
      );
      const label = 'Peserta ' + String(id).padStart(2, '0');
      setNotice(
        Math.max(width, height) < 1200
          ? `Foto ${label} diperbarui. Sumbernya hanya ${width}×${height} px sehingga tetap terlihat kabur — unggah foto asli minimal 900×1200 px.`
          : 'Foto ' + label + ' diperbarui.',
      );
    } catch (e) {
      setError((e as Error).message || 'Gagal mengunggah foto.');
    } finally {
      setUploading(null);
    }
  }

  function exportCsv() {
    if (!stats) return;
    const escape = (value: unknown) => '"' + String(value).replaceAll('"', '""') + '"';
    const rows = [
      ['Nomor', 'Nama', 'Suara'],
      ...stats.counts.map((c) => [c.id, /^[=+@-]/.test(c.name) ? "'" + c.name : c.name, c.total]),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hasil-npvote.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  if (mode === 'loading') {
    return (
      <Shell>
        <section className="notice">
          <h1>Memeriksa akses…</h1>
          {error && <p role="alert">{error}</p>}
          <button onClick={load}>Coba lagi</button>
        </section>
      </Shell>
    );
  }

  if (mode === 'login') {
    return (
      <Shell>
        <section className="panel login">
          <p className="eyebrow">RUANG PANITIA</p>
          <h1>Masuk admin</h1>
          <p className="hint">Masukkan kata sandi panitia untuk membuka dan menutup voting.</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form onSubmit={login}>
            <label>
              Kata sandi panitia
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? 'Memeriksa…' : 'Masuk'}
            </button>
          </form>
        </section>
      </Shell>
    );
  }

  const sorted = stats ? [...stats.counts].sort((a, b) => b.total - a.total || a.id - b.id) : [];

  return (
    <Shell>
      <div className="adminheading">
        <div>
          <p className="eyebrow">RUANG PANITIA</p>
          <h1>Dashboard voting</h1>
        </div>
        <div className="actions">
          <a className="secondary link" href="/" target="_blank" rel="noreferrer">
            Halaman voting ↗
          </a>
          <a className="secondary link" href="/hasil" target="_blank" rel="noreferrer">
            Halaman hasil ↗
          </a>
          <button className="secondary" onClick={logout}>
            Keluar
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}

      <div className="stats">
        <section>
          <span>Total suara masuk</span>
          <strong>{stats?.total.toLocaleString('id-ID') ?? 0}</strong>
          <small>Suara tersimpan di database</small>
        </section>
        <section>
          <span>Peserta lomba</span>
          <strong>{stats?.counts.length ?? 0}</strong>
          <small>Satu pilihan per browser</small>
        </section>
        <section>
          <span>Status voting</span>
          <strong className="statstatus">{stats?.open ? 'Dibuka' : 'Ditutup'}</strong>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              const next = !stats?.open;
              const question = next
                ? 'Buka voting sekarang? Pastikan data peserta sudah benar.'
                : 'Tutup voting sekarang?';
              if (confirm(question)) setOpen(next);
            }}
          >
            {stats?.open ? 'Tutup voting' : 'Buka voting'}
          </button>
        </section>
      </div>

      <section className="panel">
        <div className="adminheading">
          <div>
            <h2>Perolehan suara</h2>
            <p className="hint">
              Diperbarui tiap 15 detik
              {stats ? ' · ' + new Date(stats.updated).toLocaleTimeString('id-ID') : ''}
            </p>
          </div>
          <button className="secondary" onClick={exportCsv}>
            Unduh CSV
          </button>
        </div>
        {sorted.map((c, index) => (
          <div className="result" key={c.id}>
            <div className="resultlabel">
              <span>
                <b className="badge">{String(c.id).padStart(2, '0')}</b> {c.name}{' '}
                {index === 0 && (stats?.total ?? 0) > 0 && <small>• Teratas</small>}
              </span>
              <strong>
                {c.total} <small>suara</small>
              </strong>
            </div>
            <div className="track">
              <div style={{ width: (stats?.total ? (c.total / stats.total) * 100 : 0) + '%' }} />
            </div>
            <small>{stats?.total ? ((c.total / stats.total) * 100).toFixed(1) : 0}% dari total suara</small>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Data peserta</h2>
        <p className="hint">
          Ubah nama dan foto peserta. Gunakan foto asli berukuran minimal 900×1200 px (potret) agar hasilnya
          tajam. Foto dikecilkan otomatis di perangkat ini saat diunggah (JPEG, maks 3 MB).
        </p>
        <div className="editgrid">
          {(stats?.counts ?? []).map((c) => (
            <fieldset key={c.id}>
              <legend>Peserta {String(c.id).padStart(2, '0')}</legend>
              <div className="editrow">
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={c.photo} alt={'Foto ' + c.name} />
                ) : (
                  <span className="thumb placeholder">Belum ada foto</span>
                )}
                <div className="editfields">
                  <label>
                    Nama peserta
                    <input
                      value={drafts[c.id] ?? ''}
                      maxLength={40}
                      onChange={(e) => setDrafts((current) => ({ ...current, [c.id]: e.target.value }))}
                    />
                  </label>
                  <button
                    className="secondary"
                    disabled={busy || (drafts[c.id] ?? '').trim() === c.name}
                    onClick={() => saveName(c.id)}
                  >
                    Simpan nama
                  </button>
                  <label className="filelabel">
                    {uploading === c.id ? 'Mengunggah…' : 'Ganti foto (JPG/PNG)'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) uploadPhoto(c.id, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="panel danger">
        <h2>Alat pengujian</h2>
        <p className="hint">
          Gunakan hanya saat latihan. Tombol − dan + menambah atau menghapus satu suara peserta agar halaman
          hasil dapat diuji tanpa menunggu pemilih; suara ini tercatat seperti suara asli. Tombol di bawah
          menghapus semua suara agar setiap perangkat dapat memilih lagi (nama dan foto peserta tidak
          terhapus).
        </p>
        <div className="debuggrid">
          {(stats?.counts ?? []).map((c) => (
            <div className="debugrow" key={c.id}>
              <span>
                <b className="badge">{String(c.id).padStart(2, '0')}</b> {c.name}
              </span>
              <div className="debugbuttons">
                <button
                  className="secondary mini"
                  aria-label={'Kurangi satu suara peserta ' + String(c.id).padStart(2, '0')}
                  disabled={busy || c.total === 0}
                  onClick={() => adjust(c.id, -1)}
                >
                  −
                </button>
                <strong>{c.total}</strong>
                <button
                  className="secondary mini"
                  aria-label={'Tambah satu suara peserta ' + String(c.id).padStart(2, '0')}
                  disabled={busy}
                  onClick={() => adjust(c.id, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          className="danger"
          disabled={busy || (stats?.total ?? 0) === 0}
          onClick={() => {
            if (confirm('Hapus SEMUA suara? Tindakan ini tidak dapat dibatalkan.')) reset();
          }}
        >
          Hapus semua suara
        </button>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="top">
        <a className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mark" src="/NP.png" alt="NP" />
          <span>Vote</span>
        </a>
        <span className="tag">Dashboard admin</span>
      </header>
      <main className="admin">{children}</main>
    </>
  );
}

/**
 * Longest edge kept when saving. A 3:4 portrait therefore stores up to
 * 1200x1600 px, which covers the voting card (about 470 CSS px wide, i.e.
 * ~1400 device px on a 3x phone) without the browser enlarging anything.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.88;

/**
 * Shrink a photo in the browser before upload. Photos are never enlarged, and a
 * JPEG that already fits the budget is passed through untouched so it is not
 * compressed a second time. Returns the source pixel size so the caller can
 * warn when the original is too small to ever look sharp.
 */
async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);

  if (file.type === 'image/jpeg' && longest <= MAX_EDGE && file.size <= 2 * 1024 * 1024) {
    bitmap.close();
    return { blob: file, width, height };
  }

  const scale = Math.min(1, MAX_EDGE / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Peramban ini tidak dapat mengolah foto.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Gagal memproses foto.');
  return { blob, width, height };
}
