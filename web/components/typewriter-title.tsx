'use client';
import { useState, useEffect } from 'react';

const FULL_TEXT = 'Everyday essentials,\nkinder to the planet';
const TYPE_SPEED = 55;
const ERASE_SPEED = 28;
const PAUSE_MS = 3000;

export function TypewriterTitle({ style }: { style?: React.CSSProperties }) {
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'erasing'>('typing');

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (displayed.length < FULL_TEXT.length) {
        t = setTimeout(() => setDisplayed(FULL_TEXT.slice(0, displayed.length + 1)), TYPE_SPEED);
      } else {
        setPhase('pausing');
      }
    } else if (phase === 'pausing') {
      t = setTimeout(() => setPhase('erasing'), PAUSE_MS);
    } else {
      if (displayed.length > 0) {
        t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), ERASE_SPEED);
      } else {
        setPhase('typing');
      }
    }

    return () => clearTimeout(t);
  }, [displayed, phase]);

  const lines = displayed.split('\n');

  return (
    <h1 style={style}>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
      <span style={{
        display: 'inline-block',
        width: '3px',
        height: '0.82em',
        background: '#FFFFFF',
        marginLeft: '3px',
        verticalAlign: 'text-bottom',
        animation: 'tw-blink 0.7s step-end infinite',
      }} />
      <style>{`@keyframes tw-blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </h1>
  );
}
