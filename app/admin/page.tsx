'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Count = { id: number; name: string; photo: string; total: number };
type Stats = { open: boolean; updated: string; total: number; counts: Count[] };
type Mode = 'loading' | 'login' | 'ready';

export default function Admin() {
  const [mode, setMode] = useState<Mode>('loading');
  const [stats, setStats] = useState<Stats | null>(null);
  const [email, setEmail] = useState('');
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
        body: JSON.stringify({ email, password }),
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
      const blob = await compress(file);
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
      setNotice('Foto peserta ' + String(id).padStart(2, '0') + ' diperbarui.');
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
          <p className="hint">Hanya akun panitia yang dapat membuka dan menutup voting.</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form onSubmit={login}>
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Kata sandi
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
          Ubah nama dan foto peserta. Foto dikecilkan otomatis di perangkat ini sebelum diunggah (JPEG, maks
          3 MB).
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
          Menghapus semua suara agar setiap perangkat dapat memilih lagi. Nama dan foto peserta tidak
          terhapus. Gunakan hanya saat latihan.
        </p>
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

/** Shrink a photo in the browser so uploads stay small and cheap to store. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 900;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Peramban ini tidak dapat mengolah foto.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Gagal memproses foto.');
  return blob;
}
