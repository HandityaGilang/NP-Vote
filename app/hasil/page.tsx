'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Row = { id: number; name: string; photo: string; total: number; pct: number };
type Result = { open: boolean; total: number; top: Row[] };

export default function Results() {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/results', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
      setError('');
    } catch (e) {
      setError((e as Error).message || 'Gagal memuat hasil.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const closed = data != null && !data.open;
  const leader = data?.top[0];

  return (
    <>
      <header className="top">
        <a className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mark" src="/NP.png" alt="NP" />
          <span>Vote</span>
        </a>
        <span className="tag">{closed ? 'Hasil akhir' : 'Hasil sementara'}</span>
      </header>
      <main className="results">
        <p className="eyebrow">HASIL VOTING</p>
        <h1>Top 3 peserta</h1>
        <div className="eventline">
          <span className={'status ' + (data?.open ? 'live' : '')}>
            {data?.open ? '● Voting masih dibuka' : 'Voting ditutup'}
          </span>
          <span>{(data?.total ?? 0).toLocaleString('id-ID')} suara</span>
        </div>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {!data ? (
          <p className="notice">Memuat hasil…</p>
        ) : data.total === 0 || data.top.length === 0 ? (
          <p className="notice">Belum ada suara masuk.</p>
        ) : (
          <>
            {closed && leader && (
              <p className="winner" role="status">
                Pemenang: <b>{leader.name}</b> dengan {leader.pct.toFixed(1)}% suara
              </p>
            )}
            <section className="podium">
              {data.top.map((c, index) => (
                <article
                  className={'podiumcard rank' + (index + 1)}
                  key={c.id}
                  style={{ animationDelay: index * 140 + 'ms' }}
                >
                  <span className="medal">{index + 1}</span>
                  {c.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="podiumphoto"
                      src={c.photo}
                      alt={'Foto ' + c.name}
                      onError={(e) => {
                        e.currentTarget.style.visibility = 'hidden';
                      }}
                    />
                  ) : (
                    <div className="portrait podiumphoto" aria-label="Foto belum tersedia">
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <circle cx="50" cy="34" r="18" />
                        <path d="M15 93a35 35 0 0 1 70 0" />
                      </svg>
                    </div>
                  )}
                  <span className="number">{String(c.id).padStart(2, '0')}</span>
                  <h2>{c.name}</h2>
                  {closed ? (
                    <>
                      <strong className="pct">{c.pct.toFixed(1)}%</strong>
                      <div className="track">
                        <div style={{ width: c.pct + '%' }} />
                      </div>
                      <small>{c.total.toLocaleString('id-ID')} suara</small>
                    </>
                  ) : (
                    <>
                      <strong className="count">
                        {c.total.toLocaleString('id-ID')} <small>suara</small>
                      </strong>
                      <div className="track">
                        <div style={{ width: (leader ? (c.total / leader.total) * 100 : 0) + '%' }} />
                      </div>
                    </>
                  )}
                </article>
              ))}
            </section>
            <p className="hint">
              {closed
                ? 'Voting sudah ditutup. Hasil ini tidak berubah lagi.'
                : 'Diperbarui tiap 5 detik. Persentase ditampilkan setelah voting ditutup.'}
            </p>
          </>
        )}

        <footer>
          <small>Halaman ini untuk panitia dan penonton.</small>
        </footer>
      </main>
      {closed && data != null && data.total > 0 && <Confetti />}
      <div className="bottom">NPVote · Voting mudah untuk semua</div>
    </>
  );
}

/** Lightweight canvas confetti. No dependencies, skipped for reduced motion. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    resize();

    const colors = ['#174bc7', '#e0a700', '#93a0b4', '#b8713f', '#168052', '#edb82e'];
    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height,
      size: 6 + Math.random() * 8,
      vx: -1.4 + Math.random() * 2.8,
      vy: 1.8 + Math.random() * 3,
      angle: Math.random() * Math.PI,
      spin: -0.14 + Math.random() * 0.28,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    let raf = 0;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        if (piece.y > height + 24) {
          piece.y = -24;
          piece.x = Math.random() * width;
        }
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      }
      frame += 1;
      if (frame < 60 * 8) raf = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    };
    raf = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas className="confetti" ref={ref} aria-hidden="true" />;
}
