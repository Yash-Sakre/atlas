import { useEffect, useRef, useState } from 'react';

const LINES: string[] = [
  '<span class="c-prompt">$</span> <span class="c-cmd">npx codebase-atlas serve</span>',
  '<span class="c-dim">Scanning project… (509 files)</span>',
  '<span class="c-ok">✓</span> Components <span class="c-tag">9</span>   <span class="c-ok">✓</span> Hooks <span class="c-tag">3</span>   <span class="c-ok">✓</span> Utils <span class="c-tag">4</span>',
  '<span class="c-ok">✓</span> Contexts <span class="c-tag">2</span>   <span class="c-ok">✓</span> Routes <span class="c-tag">2</span>',
  '<span class="c-warn">⚠</span> 3 unused exports · 2 orphan files',
  '<span class="c-dim">Most used:</span> Button <span class="c-tag">5×</span> · TextInput <span class="c-tag">3×</span>',
  '<span class="c-ok">→</span> Dashboard ready at <span class="c-link">http://localhost:4321</span>',
];

/** macOS-style terminal that reveals its output line-by-line on first view. */
export default function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(LINES.length);
      return;
    }
    const el = ref.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout>;
    const reveal = (i: number) => {
      if (i > LINES.length) return;
      setShown(i);
      timer = setTimeout(() => reveal(i + 1), i === 1 ? 500 : 340);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal(1);
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="terminal hero-term">
      <div className="term-chrome">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span className="title">Terminal — atlas</span>
      </div>
      <div className="term-tabs">
        <span className="term-tab">atlas</span>
        <span className="term-plus">+</span>
      </div>
      <div className="term-body mono" ref={ref}>
        {LINES.map((line, i) => (
          <div
            key={i}
            className={`ln ${i < shown ? 'show' : ''}`}
            dangerouslySetInnerHTML={{ __html: line }}
          />
        ))}
        <div className={`ln ${shown >= LINES.length ? 'show' : ''}`}>
          <span className="c-prompt">$</span> <span className="cursor" />
        </div>
      </div>
    </div>
  );
}
