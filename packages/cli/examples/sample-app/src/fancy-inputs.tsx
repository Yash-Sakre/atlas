import React from 'react';

export interface TextInputProps {
  value: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

/**
 * TextInput — forwards its ref to the underlying DOM input so parent
 * components can focus it imperatively.
 */
export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ value, placeholder, onChange }, ref) => {
    return (
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  },
);

TextInput.displayName = 'TextInput';

export interface BadgeProps {
  label: string;
  tone?: 'info' | 'warn' | 'error';
}

/**
 * Badge — memoized so it only re-renders when its props change.
 */
export const Badge = React.memo(function Badge({ label, tone = 'info' }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
});
