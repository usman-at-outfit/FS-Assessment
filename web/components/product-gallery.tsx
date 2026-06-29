'use client';

import { useState } from 'react';

interface Props {
  urls: string[];
  name: string;
}

/** Product image gallery: main view + thumbnail strip (shown only when 2+ images). */
export function ProductGallery({ urls, name }: Props) {
  const [active, setActive] = useState(0);
  // Guard: if somehow called with an empty array, show a gradient placeholder
  if (urls.length === 0) {
    return (
      <div style={{ height: '420px', borderRadius: '12px', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)' }} />
    );
  }
  const current = urls[Math.min(active, urls.length - 1)];

  return (
    <div>
      {/* Main image */}
      <div style={{ height: '420px', borderRadius: '12px', overflow: 'hidden', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Thumbnail strip (only shown for multiple images) */}
      {urls.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(i)}
              style={{
                width: '62px', height: '62px', borderRadius: '8px', overflow: 'hidden', padding: 0, border: 'none', cursor: 'pointer',
                outline: i === active ? '2px solid #43432B' : '2px solid transparent',
                outlineOffset: '2px',
                background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)',
                flexShrink: 0,
                transition: 'outline-color 0.15s',
              }}
              aria-label={`View image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${name} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
