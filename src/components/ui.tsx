import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IClose, IBag } from './Icons';

type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const TCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random(); setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <TCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`pop-in pointer-events-auto max-w-md rounded-key border-2 border-ink px-4 py-2.5 font-bold shadow-pressSm ${t.tone === 'ok' ? 'bg-sage-soft' : 'bg-pumpkin-soft text-absent'}`}>{t.text}</div>
        ))}
      </div>
    </TCtx.Provider>
  );
}
export const useToast = () => useContext(TCtx);

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`grid place-items-center rounded-[10px] border-2 border-ink bg-pumpkin ${small ? 'h-8 w-8' : 'h-9 w-9'}`}><IBag size={small ? 18 : 20} /></span>
      <span className="font-display text-[22px] font-extrabold leading-none tracking-tight">Basta<span className="ml-1 align-top text-[13px] font-bold text-pumpkin-ink">बस्ता</span></span>
    </span>
  );
}
export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string | null; children: ReactNode; id?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[13px] text-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-[13px] font-bold text-absent" role="alert">{error}</p>}
    </div>
  );
}
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} aria-hidden="true" />; }
export function SkeletonRows({ n = 5 }: { n?: number }) {
  return <div className="space-y-2.5" aria-busy="true" aria-label="Loading">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>;
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="sticker fade-up px-6 py-10 text-center">
      <svg width="64" height="52" viewBox="0 0 64 52" className="mx-auto mb-3" aria-hidden="true"><rect x="8" y="10" width="48" height="38" rx="10" fill="#FDEBB6" stroke="#233D4D" strokeWidth="2.5" /><path d="M22 10V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v3" fill="none" stroke="#233D4D" strokeWidth="2.5" /><rect x="18" y="22" width="28" height="12" rx="4" fill="#FFFCF5" stroke="#233D4D" strokeWidth="2" /></svg>
      <h3 className="text-[22px] font-bold">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="rounded-key border-2 border-absent bg-pumpkin-soft px-4 py-3 text-absent" role="alert">
      <b>{text}</b> {retry && <button className="ml-2 underline" onClick={() => retry()}>Try again</button>}
    </div>
  );
}
export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 30);
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`pop-in max-h-[92vh] w-full overflow-y-auto rounded-t-[18px] border-2 border-ink bg-card p-5 shadow-press sm:rounded-[18px] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-[24px] font-bold">{title}</h2>
          <button className="btn btn-plain btn-sm !px-2" onClick={onClose} aria-label="Close"><IClose size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function Tally({ n, max = 25 }: { n: number; max?: number }) {
  const shown = Math.min(n, max); const fives = Math.floor(shown / 5), rest = shown % 5;
  return (
    <span className="tally" aria-label={`${n}`}>
      {Array.from({ length: fives }, (_, i) => <span key={i} className="five">{[0, 1, 2, 3].map((j) => <i key={j} />)}</span>)}
      {rest > 0 && <span className="inline-flex">{Array.from({ length: rest }, (_, j) => <i key={j} />)}</span>}
      {n > max && <b className="ml-1 text-[13px]">+{n - max}</b>}
    </span>
  );
}
export function DemoBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return <div className="no-print border-b-2 border-ink bg-sun px-4 py-1.5 text-center text-[14px] font-bold">Demo school with made-up students. Data resets every few hours. Nothing here is a real person.</div>;
}
export function Stat({ label, value, sub, tone = 'card' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'card' | 'sun' | 'sage' | 'pumpkin' }) {
  const bg = { card: 'bg-card', sun: 'bg-sun-soft', sage: 'bg-sage-soft', pumpkin: 'bg-pumpkin-soft' }[tone];
  return (
    <div className={`tag ${bg} p-4`}>
      <div className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="num mt-1 font-display text-[30px] font-extrabold leading-none">{value}</div>
      {sub && <div className="mt-1.5 text-[14px] text-ink-soft">{sub}</div>}
    </div>
  );
}
