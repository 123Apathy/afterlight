import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { photoThumbUrl, type Photo } from '../lib/api';
import { colors } from '../constants/theme';

// Full-screen photo scrubber: a drag-driven 3D cylinder of the memorial's
// photos (technique harvested from a motionsites carousel reference,
// rebuilt from scratch -- no auto-spin, no back faces, finite list with
// snap-to-nearest). Opened from the header counter; dragging rolls the
// cylinder, tapping the centred photo jumps the deck to it.
//
// ponytail: web-only (perspective/preserve-3d have no RN-native equivalent;
// the shipped product is web). On native this renders nothing and the
// counter simply isn't pressable there.
type Props = {
  photos: Photo[];
  index: number;
  onPick: (index: number) => void;
  onClose: () => void;
};

const GAP = 26;
const MAX_VISIBLE = 3.2;

export default function PhotoScrubber({ photos, index, onPick, onClose }: Props) {
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const readoutRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const progress = useRef(index);
  const target = useRef(index);
  const drag = useRef({ active: false, startY: 0, startTarget: 0, moved: 0 });

  const count = photos.length;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const cardW = Math.min(340, Math.max(200, Math.round(vw * 0.42)));
  const cardH = Math.round(cardW / 1.5);
  const spacing = cardH + GAP;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = () => {
      // Damped follow gives the roll its weight; reduced-motion goes direct.
      progress.current += reduceMotion
        ? target.current - progress.current
        : (target.current - progress.current) * 0.16;

      for (let i = 0; i < count; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const offset = i - progress.current;
        const abs = Math.abs(offset);
        if (abs > MAX_VISIBLE) {
          card.style.visibility = 'hidden';
          continue;
        }
        card.style.visibility = 'visible';
        const y = offset * spacing * (1 - 0.06 * Math.min(abs, 2));
        const rot = Math.max(-78, Math.min(78, -offset * 42));
        const z = 340 - abs * 150;
        const fade = abs > 2.4 ? Math.max(0, 1 - (abs - 2.4) / 0.8) : 1;
        card.style.transform = `translateY(${y.toFixed(2)}px) translateZ(${z.toFixed(2)}px) rotateX(${rot.toFixed(2)}deg)`;
        card.style.opacity = fade.toFixed(3);
        card.style.zIndex = String(Math.round(z));
        // Gold rim + lift on whichever photo currently holds the centre.
        card.style.boxShadow =
          abs < 0.5
            ? `0 0 0 2px ${colors.goldWarm}, 0 24px 60px rgba(0,0,0,0.6)`
            : '0 16px 40px rgba(0,0,0,0.5)';
      }

      if (readoutRef.current) {
        const shown = Math.max(0, Math.min(count - 1, Math.round(progress.current)));
        readoutRef.current.textContent = `${String(shown + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener('keydown', onKey);
    };
  }, [count, spacing, onClose]);

  if (Platform.OS !== 'web' || count === 0) return null;

  const clamp = (v: number) => Math.max(0, Math.min(count - 1, v));

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { active: true, startY: e.clientY, startTarget: target.current, moved: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dy = drag.current.startY - e.clientY;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dy));
    // Rubber-band 0.4 past each end so the edges feel soft, not walled.
    const raw = drag.current.startTarget + dy / spacing;
    target.current = Math.max(-0.4, Math.min(count - 0.6, raw));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    target.current = clamp(Math.round(target.current));
    if (drag.current.moved < 6) {
      // A tap, not a drag: a tapped photo jumps to it; the backdrop closes.
      // Hit-test the release point rather than e.target -- pointer capture
      // makes the overlay the event target, which silently ate every pick.
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const el = hit && (hit as HTMLElement).closest('[data-scrub-idx]');
      if (el) onPick(clamp(Number(el.getAttribute('data-scrub-idx'))));
      else onClose();
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    target.current = clamp(target.current + (e.deltaY > 0 ? 1 : -1));
  };

  const D = React.createElement;
  return D(
    'div',
    {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onWheel,
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(10, 8, 7, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        touchAction: 'none',
        cursor: 'grab',
        overflow: 'hidden',
        userSelect: 'none',
      },
    },
    // Live counter readout, same Courier language as the header counter.
    D('div', {
      ref: (el: HTMLDivElement) => { readoutRef.current = el; },
      style: {
        position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'Courier New', fontSize: 18, fontWeight: 600, letterSpacing: 2,
        color: 'rgba(255,255,255,0.85)',
      },
    }),
    // Close.
    D('div', {
      'data-scrub-close': '1',
      onPointerUp: (e: React.PointerEvent) => { e.stopPropagation(); onClose(); },
      style: {
        position: 'absolute', top: 18, right: 18, width: 44, height: 44, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.8)', fontFamily: 'Poppins_400Regular', fontSize: 22,
        cursor: 'pointer',
      },
    }, '×'),
    // Perspective camera space.
    D(
      'div',
      {
        style: {
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          perspective: '1350px', pointerEvents: 'none',
        },
      },
      D(
        'div',
        { style: { position: 'relative', width: cardW, height: cardH, transformStyle: 'preserve-3d' } },
        ...photos.map((photo, i) =>
          D(
            'div',
            {
              key: photo.id,
              'data-scrub-idx': String(i),
              ref: (el: HTMLDivElement) => { cardRefs.current[i] = el; },
              style: {
                position: 'absolute', inset: 0, borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.15)',
                overflow: 'hidden', background: '#1A1613',
                visibility: 'hidden', pointerEvents: 'auto', cursor: 'pointer',
              },
            },
            D('img', {
              src: photoThumbUrl(photo),
              draggable: false,
              style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
            }),
            D('div', {
              style: {
                position: 'absolute', left: 10, bottom: 8,
                fontFamily: 'Courier New', fontSize: 12, fontWeight: 600, letterSpacing: 1,
                color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 3px rgba(0,0,0,0.7)',
              },
            }, String(i + 1).padStart(2, '0'))
          )
        )
      )
    ),
    // Hint.
    D('div', {
      style: {
        position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'Poppins_400Regular', fontSize: 13,
        color: 'rgba(255,255,255,0.55)',
      },
    }, 'Drag to browse · tap a photo to open it')
  );
}
