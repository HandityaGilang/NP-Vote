"use client";

import { useCallback, useEffect, useState } from 'react';

type Candidate = { id: number; name: string; photo: string };
type EventData = {
  title: string;
  help: string;
  candidates: Candidate[];
  count: number;
  open: boolean;
  voted: number | null;
};

export default function Vote() {
  const [event, setEvent] = useState<EventData | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/event', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEvent(data);
      setError('');
    } catch (e) {
      setError((e as Error).message || 'Halaman belum dapat dimuat. Periksa internet lalu coba lagi.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('step-title')?.focus();
  }, [selected, event?.voted]);

  async function send() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: selected.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEvent((current) => (current ? { ...current, voted: data.voted } : current));
      setSelected(null);
    } catch (e) {
      setError((e as Error).message || 'Gagal mengirim. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const chosen = event?.candidates.find((c) => c.id === event.voted);

  return (
    <>
      <header className="top">
        <a href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mark" src="/NP.png" alt="NP" />
          <span>Vote</span>
        </a>
        <span className="tag">Setiap pilihan berarti</span>
      </header>
      <main className="voter">
        {!event ? (
          <section className="notice">
            <h1>Menyiapkan halaman…</h1>
            {error && (
              <>
                <p role="alert">{error}</p>
                <button onClick={load}>Coba lagi</button>
              </>
            )}
          </section>
        ) : chosen ? (
          <section className="success">
            <div className="check">✓</div>
            <p className="eyebrow">TERIMA KASIH</p>
            <h1 id="step-title" tabIndex={-1}>
              Pilihan Anda
              <br />
              sudah masuk.
            </h1>
            <p>Anda telah memilih:</p>
            <Card c={chosen} />
            <p>Anda boleh menutup halaman ini.</p>
          </section>
        ) : selected ? (
          <>
            <button
              className="textbutton"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setError('');
              }}
            >
              ← Kembali ke daftar
            </button>
            <p className="eyebrow">LANGKAH 2 DARI 2</p>
            <h1 id="step-title" tabIndex={-1}>
              Periksa pilihan Anda
            </h1>
            <p>Pastikan nomor dan nama sudah benar.</p>
            <Card c={selected} />
            <p className="hint">Pilihan yang sudah dikirim tidak dapat diubah.</p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy} onClick={send}>
              {busy ? 'Sedang mengirim…' : 'Ya, kirim pilihan saya'}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setError('');
              }}
            >
              Kembali untuk mengganti
            </button>
          </>
        ) : (
          <>
            <div className="eventline">
              <span className={'status ' + (event.open ? 'live' : '')}>
                {event.open ? '● Voting dibuka' : 'Voting belum dibuka'}
              </span>
              <span>{event.count} peserta</span>
            </div>
            <p className="eyebrow">{event.title}</p>
            <h1 id="step-title" tabIndex={-1}>
              Siapa pilihan
              <br />
              favorit Anda?
            </h1>
            <p className="intro">
              Pilih satu peserta. Geser layar ke atas untuk melihat peserta lainnya.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {!event.open && (
              <aside className="notice">
                Anda dapat melihat peserta. Pemilihan tersedia setelah panitia membuka voting.
              </aside>
            )}
            <div className="cards">
              {event.candidates.map((c) => (
                <Card key={c.id} c={c}>
                  <button className="primary" disabled={!event.open} onClick={() => setSelected(c)}>
                    Pilih peserta {String(c.id).padStart(2, '0')}{' '}
                    <span aria-hidden="true">→</span>
                  </button>
                </Card>
              ))}
            </div>
          </>
        )}
        {event && (
          <footer>
            <strong>Butuh bantuan?</strong>
            <p>{event.help}</p>
            <small>Satu browser hanya dapat memberikan satu suara.</small>
          </footer>
        )}
      </main>
      <div className="bottom">NPVote · Voting mudah untuk semua</div>
    </>
  );
}

function Card({ c, children }: { c: Candidate; children?: React.ReactNode }) {
  return (
    <article className="candidate">
      <div className="candidate-info">
        {c.photo ? (
          <img
            src={c.photo}
            alt={'Foto ' + c.name}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="portrait" aria-label="Foto belum tersedia">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="34" r="18" />
              <path d="M15 93a35 35 0 0 1 70 0" />
            </svg>
          </div>
        )}
        <div>
          <span className="number">{String(c.id).padStart(2, '0')}</span>
          <h2>{c.name}</h2>
        </div>
      </div>
      {children}
    </article>
  );
}
