'use client';

/**
 * ImageUploader — multi-file image upload component.
 *
 * Usage:
 *   <ImageUploader token={adminToken} value={urls} onChange={setUrls} />
 *
 * Props:
 *   token    — admin JWT (required for POST /uploads)
 *   value    — controlled array of image URLs (existing + newly uploaded)
 *   onChange — called with updated URL array when images are added or removed
 *   max      — max number of images (default 10)
 */

import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — must match server

interface Props {
  token:    string;
  value:    string[];
  onChange: (urls: string[]) => void;
  max?:     number;
}

export function ImageUploader({ token, value, onChange, max = 10 }: Props) {
  const inputRef     = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false); // synchronous guard against rapid double-clicks
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (uploadingRef.current) return; // guard against rapid double-clicks
    const remaining = max - value.length;
    if (remaining <= 0) return;

    const toUpload = Array.from(files).slice(0, remaining);

    // Client-side size check (server enforces 5 MB too, but avoids a wasted round-trip)
    const oversized = toUpload.find(f => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(`"${oversized.name}" exceeds 5 MB. Please choose a smaller image.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    setError('');

    try {
      const fd = new FormData();
      toUpload.forEach(f => fd.append('files', f));
      const results = await api.withToken(token).upload<{ url: string }[]>('/uploads', fd);
      onChange([...value, ...results.map(r => r.url)]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Upload failed — try again.';
      setError(msg);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeUrl(url: string) {
    onChange(value.filter(u => u !== url));
  }

  const canAdd = value.length < max;

  return (
    <div>
      {/* Preview grid */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          {value.map((url, i) => (
            <div key={`${url}-${i}`} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(58,58,44,0.16)', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Image ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {i === 0 && (
                <span style={{ position: 'absolute', bottom: '3px', left: '3px', fontSize: '9px', fontFamily: "'Space Mono', monospace", background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '1px 5px', borderRadius: '3px', letterSpacing: '0.05em' }}>PRIMARY</span>
              )}
              <button
                type="button"
                onClick={() => removeUrl(url)}
                style={{ position: 'absolute', top: '3px', right: '3px', width: '18px', height: '18px', borderRadius: '999px', background: 'rgba(168,46,34,0.9)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                aria-label="Remove image"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {canAdd && (
        <label
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '6px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: uploading ? '#F5F5F0' : '#FFFFFF',
            color: uploading ? '#8A8676' : '#3A3A2C',
            border: '1px solid rgba(58,58,44,0.20)',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
            disabled={uploading}
          />
          {uploading ? 'Uploading…' : `+ Add image${max > 1 ? 's' : ''}`}
        </label>
      )}

      {!canAdd && (
        <span style={{ fontSize: '12px', color: '#8A8676' }}>Max {max} images reached. Remove one to add more.</span>
      )}

      {error && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#A82E22' }}>{error}</div>
      )}
    </div>
  );
}
