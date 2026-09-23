'use client';

import { useState } from 'react';

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function CommandBox({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div className="inline-flex h-12.5 max-w-full min-w-0 items-center gap-3 rounded-full border border-black/8 bg-neutral-100 pr-1.5 pl-5 font-mono text-[15px] dark:border-white/8 dark:bg-stone-900">
      <span className="text-neutral-400 select-none dark:text-neutral-600">$</span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-neutral-900 [scrollbar-width:none] dark:text-neutral-50">
        {command}
      </code>
      <button
        className="grid size-9 flex-none cursor-pointer place-items-center rounded-full bg-white text-neutral-500 transition hover:text-neutral-900 active:scale-92 dark:bg-stone-950 dark:text-neutral-400 dark:hover:text-neutral-50 [&_svg]:size-3.75"
        onClick={copy}
        aria-label="Copy command"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
