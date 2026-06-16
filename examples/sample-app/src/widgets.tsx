import React from 'react';

export interface ButtonProps {
  /** Visual style of the button. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Size token. */
  size?: 'sm' | 'md' | 'lg';
  /** Show a loading spinner and block interaction. */
  loading?: boolean;
  /** Disable the button. */
  disabled?: boolean;
  /** Click handler. */
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * Primary action button used across the app.
 *
 * Supports variants, sizes, and a loading state. Prefer this over a raw
 * `<button>` so styling and a11y stay consistent.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? 'Loading…' : children}
    </button>
  );
}

Button.defaultProps = {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
};
