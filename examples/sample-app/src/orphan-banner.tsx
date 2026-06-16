import React from 'react';

export interface PromoBannerProps {
  message: string;
  dismissible?: boolean;
}

/**
 * PromoBanner — DELIBERATELY UNUSED component (no other module imports or
 * renders it) so dead-code / orphan detection has something to find.
 */
export function PromoBanner({ message, dismissible = true }: PromoBannerProps) {
  return (
    <div className="promo-banner">
      <span>{message}</span>
      {dismissible && <button aria-label="dismiss">×</button>}
    </div>
  );
}
