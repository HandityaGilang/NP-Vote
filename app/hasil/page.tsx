'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Row = {
  id: number;
  name: string;
  photo: string;
  actualVotes: number;
  displayValue: number;
  pct: number;
};
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
  const top = data?.top ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="stage">
      <header className="stagehead">
        <a className="stagebrand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="stagebrandmark" src="/NP.png" alt="NP" />
          <span>Vote</span>
        </a>
        <span className={'stagestatus' + (data?.open ? ' open' : '')}>
          {data == null ? 'Memuat…' : data.open ? 'Peringkat sementara' : 'Hasil akhir'}
        </span>
      </header>

      <main className="stagebody">
        <h1 className="stagetitle">PESERTA FAVORIT</h1>
        <p className="stagesub">Top 5 Favorit</p>
        {closed && (
          <p className="stagelead">{`${total.toLocaleString('id-ID')} suara · voting telah ditutup`}</p>
        )}

        {error && (
          <p role="alert" className="stagealert">
            {error}
          </p>
        )}

        {data == null ? (
          <p className="stagenotice">Memuat hasil…</p>
        ) : top.length === 0 || total === 0 ? (
          <p className="stagenotice">Belum ada suara masuk.</p>
        ) : (
          <section className="podium">
            {top.map((c, index) => {
              const rank = index + 1;
              const winner = rank === 1;
              return (
                <article
                  className={'podiumcard rank' + rank}
                  key={c.id}
                  aria-label={'Peringkat ' + rank + ': ' + c.name}
                  style={{ animationDelay: index * 140 + 'ms' }}
                >
                  {winner && <Crown />}
                  <figure className="podiumfig">
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
                      <div className="podiumphoto portrait" aria-label="Foto belum tersedia">
                        <svg viewBox="0 0 100 100" aria-hidden="true">
                          <circle cx="50" cy="34" r="18" />
                          <path d="M15 93a35 35 0 0 1 70 0" />
                        </svg>
                      </div>
                    )}
                    <span className="rankbadge">{rank}</span>
                    <span className="number">No. {String(c.id).padStart(2, '0')}</span>
                  </figure>
                  <h2 className="podname">
                    {winner && <Laurel className="laurel l" />}
                    <span className="podnametext">{c.name}</span>
                    {winner && <Laurel className="laurel r" />}
                  </h2>
                  {closed ? (
                    <>
                      <strong className="pct">{c.pct.toFixed(1)}%</strong>
                      <div className="track">
                        <div style={{ width: c.pct + '%' }} />
                      </div>
                      <small>{c.displayValue.toLocaleString('id-ID')} suara</small>
                    </>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}
      </main>

      {closed && data != null && data.total > 0 && <Confetti />}
    </div>
  );
}

/** Small gold crown drawn above the winner's card. */
function Crown() {
  return (
    <svg className="crown" viewBox="0 0 64 44" aria-hidden="true">
      <rect x="4" y="36" width="56" height="6" rx="3" />
      <path d="M6 34V13l13 11L32 5l13 19 13-11v21z" />
      <circle cx="32" cy="4" r="3.4" />
    </svg>
  );
}

/** Small laurel sprig; the right-hand copy is mirrored in CSS. */
function Laurel({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 26 62" aria-hidden="true">
      <path
        d="M22 60C11 52 5 39 5 27 5 17 8 8 15 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <g fill="currentColor">
        <ellipse cx="19" cy="11" rx="6.4" ry="3" transform="rotate(-44 19 11)" />
        <ellipse cx="13" cy="21" rx="6.4" ry="3" transform="rotate(-26 13 21)" />
        <ellipse cx="10" cy="32" rx="6.4" ry="3" transform="rotate(-8 10 32)" />
        <ellipse cx="11" cy="43" rx="6.4" ry="3" transform="rotate(12 11 43)" />
        <ellipse cx="16" cy="53" rx="6.4" ry="3" transform="rotate(30 16 53)" />
      </g>
    </svg>
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

    // Sparse, matte pieces in the podium's own palette.
    const colors = ['#edb82e', '#e0a700', '#b9c3d1', '#c07a45', '#f2e6c4'];
    const pieces = Array.from({ length: 72 }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height,
      size: 5 + Math.random() * 6,
      vx: -1.1 + Math.random() * 2.2,
      vy: 1.4 + Math.random() * 2.2,
      angle: Math.random() * Math.PI,
      spin: -0.12 + Math.random() * 0.24,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

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
        context.globalAlpha = 0.85;
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      }
      // Keeps falling pieces forever, so the celebration never stops.
      raf = requestAnimationFrame(draw);
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
