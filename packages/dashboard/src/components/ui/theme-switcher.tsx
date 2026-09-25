import { motion } from 'motion/react';
import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { useId } from 'react';
import { useTheme, type ThemeMode } from '@/theme';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

const MODES: Array<{ id: ThemeMode; label: string; Icon: typeof Sun }> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Desktop },
];

/**
 * Theme switcher.
 *
 *  - `inline`: a full-width three-way segment with a sliding indicator, for
 *    the expanded sidebar footer.
 *  - `menu`: one icon button opening the same choices, for tight spots
 *    (collapsed rail, mobile top bar).
 */
export function ThemeSwitcher({ variant = 'inline' }: { variant?: 'inline' | 'menu' }) {
  const { mode, setMode, resolved } = useTheme();
  const layoutId = useId();

  if (variant === 'menu') {
    const Current = resolved === 'light' ? Sun : Moon;
    return (
      <DropdownMenu>
        <Tooltip content="Theme" side="right">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Change theme">
              <Current size={16} />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent side="right" align="end" className="min-w-40">
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
            {MODES.map(({ id, label, Icon }) => (
              <DropdownMenuRadioItem key={id} value={id}>
                <Icon size={15} /> {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color mode"
      className="grid h-8 grid-cols-3 gap-0.5 rounded-md bg-surface-2 p-0.75"
    >
      {MODES.map(({ id, label, Icon }) => {
        const on = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setMode(id)}
            className={cn(
              'relative flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-sm text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:outline-none',
              on ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
            )}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                className="absolute inset-0 rounded-sm bg-surface-1 shadow-(--elevation-card)"
              />
            )}
            <Icon size={14} className="relative" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
