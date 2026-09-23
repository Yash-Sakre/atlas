'use client';

import { useId } from 'react';

/**
 * Atlas brand mark: an "A" folded from two panels, like a map. The panel in
 * shade carries the brand gradient.
 *
 * - `variant="tile"` (default): the glyph in white on a glossy black square
 *   with a polished, light-catching border — the app icon.
 * - `variant="glyph"`: the bare glyph; the lit panel and crossbar use
 *   `currentColor` so it follows the surrounding text in either theme.
 *
 * public/atlas-mark.svg is the tile as a static file — keep them in step.
 */
type Props = { size?: number; variant?: 'glyph' | 'tile' };

// Shared flat edge at the apex is the fold.
const SHADE = 'M25 6h11.5L19.5 58H5.5z';
const LIT = 'M25 6h14l20 52H45z';
const BAR = 'M22.5 40h18.2l-3 8.4H19.6z';

export default function AtlasMark({ size = 28, variant = 'tile' }: Props) {
  const id = useId().replace(/:/g, '');
  const grad = `atlas-grad-${id}`;
  const fill = `atlas-fill-${id}`;
  const rim = `atlas-rim-${id}`;
  const glare = `atlas-glare-${id}`;
  const isTile = variant === 'tile';
  const ink = isTile ? '#ffffff' : 'currentColor';

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Atlas" fill="none">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#4ea8ff" />
          <stop offset="0.55" stopColor="#a58bff" />
          <stop offset="1" stopColor="#ff7aa8" />
        </linearGradient>
        {isTile && (
          <>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1c1c1e" />
              <stop offset="1" stopColor="#000000" />
            </linearGradient>
            {/* polished rim: bright on the top-left and bottom-right corners, dark between */}
            <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.28" />
              <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="0.8" stopColor="#c9c3ff" stopOpacity="0.3" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.8" />
            </linearGradient>
            <radialGradient id={glare} cx="0.2" cy="0" r="0.75">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </>
        )}
      </defs>

      {isTile && (
        <>
          <rect width="64" height="64" rx="14" fill={`url(#${fill})`} />
          <rect width="64" height="64" rx="14" fill={`url(#${glare})`} />
          <rect x="1.25" y="1.25" width="61.5" height="61.5" rx="12.75" stroke={`url(#${rim})`} strokeWidth="2.5" />
        </>
      )}

      <g transform={isTile ? 'translate(13 13) scale(0.6)' : undefined}>
        <path d={SHADE} fill={`url(#${grad})`} />
        <path d={LIT} fill={ink} />
        <path d={BAR} fill={ink} />
      </g>
    </svg>
  );
}
