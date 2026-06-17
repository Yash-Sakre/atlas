import { useId } from 'react';

/**
 * Atlas brand mark: a central hub linked to six satellite nodes — one per
 * reusable asset kind (component, hook, util, context, store, route) — colored
 * with the dashboard's asset hues. Encodes what Atlas does: discover and
 * connect the reusable assets in a codebase via its dependency graph.
 */
export default function AtlasMark({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const tile = `tile-${id}`;
  const sheen = `sheen-${id}`;
  const hub = `hub-${id}`;

  const nodes: Array<[number, number, string]> = [
    [256, 106, '#7fc4ff'], // component
    [386, 181, '#c0a8ff'], // hook
    [386, 331, '#7be3a8'], // utility
    [256, 406, '#ffce85'], // context
    [126, 331, '#ffb27d'], // store
    [126, 181, '#e6a3ff'], // route
  ];

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Atlas" fill="none">
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b1713" />
          <stop offset="1" stopColor="#0a0908" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.82" cy="0.06" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={hub} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d7d2" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill={`url(#${tile})`} />
      <rect width="512" height="512" rx="116" fill={`url(#${sheen})`} />
      <rect x="1" y="1" width="510" height="510" rx="115" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="2" />

      <polygon
        points="256,106 386,181 386,331 256,406 126,331 126,181"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.10"
        strokeWidth="3"
      />

      <g stroke="#ffffff" strokeOpacity="0.26" strokeWidth="6" strokeLinecap="round">
        {nodes.map(([x, y], i) => (
          <line key={i} x1="256" y1="256" x2={x} y2={y} />
        ))}
      </g>

      {nodes.map(([x, y, color], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="34" fill={color} fillOpacity="0.22" />
          <circle cx={x} cy={y} r="22" fill={color} />
        </g>
      ))}

      <circle cx="256" cy="256" r="44" fill="#0a0908" fillOpacity="0.55" />
      <circle cx="256" cy="256" r="34" fill={`url(#${hub})`} />
      <circle cx="256" cy="256" r="34" fill="none" stroke="#0a0908" strokeOpacity="0.12" strokeWidth="2" />
    </svg>
  );
}
