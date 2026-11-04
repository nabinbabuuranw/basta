// Scroll reveal that also reverses when the element leaves the viewport (scrolling back up hides it again).
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: any }) {
  const ref = useRef<HTMLElement>(null); const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const style: CSSProperties = { transitionDelay: on ? delay + 'ms' : '0ms' };
  return <Tag ref={ref} style={style} className={`reveal ${on ? 'is-on' : ''} ${className}`}>{children}</Tag>;
}
