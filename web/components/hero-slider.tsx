'use client';

import { useState, useEffect, useCallback } from 'react';

const INTERVAL_MS = 3000;

export function HeroSlider({ images }: { images: string[] }) {
  const [active,  setActive]  = useState(0);
  const [paused,  setPaused]  = useState(false);

  const next = useCallback(() => {
    setActive(i => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, [images.length, paused, next]);

  if (images.length === 0) return null;

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides — crossfade */}
      {images.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url + i}
          src={url}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: i === active ? 1 : 0,
            transition: 'opacity 0.9s ease',
            zIndex: i === active ? 1 : 0,
          }}
        />
      ))}

      {/* Dots + arrows — only when multiple slides */}
      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Prev */}
          <button
            onClick={() => setActive(i => (i - 1 + images.length) % images.length)}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.22)', color: '#FFF', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
            aria-label="Previous"
          >
            ‹
          </button>

          {/* Dots */}
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === active ? '20px' : '7px',
                height: '7px',
                borderRadius: '999px',
                border: 'none',
                background: i === active ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.25s, background 0.25s',
              }}
            />
          ))}

          {/* Next */}
          <button
            onClick={() => setActive(i => (i + 1) % images.length)}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.22)', color: '#FFF', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
