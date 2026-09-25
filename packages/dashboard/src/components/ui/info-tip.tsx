import type { ReactNode } from 'react';
import { Info } from '@phosphor-icons/react';
import { Tooltip } from './tooltip';

/** A small ⓘ that explains a metric on hover/focus. */
export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label="More info"
        className="inline-grid cursor-help place-items-center rounded-full text-ink-faint transition-colors hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:outline-none"
      >
        <Info size={13} />
      </button>
    </Tooltip>
  );
}
