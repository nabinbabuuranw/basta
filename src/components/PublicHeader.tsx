import { useEffect, useState } from 'react';
import { Link, useLocation } from '../lib/router';
import { useAuth, homeFor } from '../lib/auth';
import { Logo } from './ui';
import { IMenu, IClose } from './Icons';

const LINKS = [['/#day', 'How it works'], ['/#who', 'Who it is for'], ['/#results', 'Report cards'], ['/#price', 'Price'], ['/#faq', 'Questions']];
export function PublicHeader() {
  const { user } = useAuth(); const { path } = useLocation();
  const [p, setP] = useState(0); const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => { const h = document.documentElement; setP(Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight))); };
    on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  return (
    <header className="no-print sticky top-0 z-50 border-b-2 border-ink bg-chalk/95 backdrop-blur-[2px]">
      <div className="wrap relative z-50 flex h-[64px] items-center justify-between gap-4">
        <Link to="/" aria-label="Basta home"><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map(([to, t]) => <a key={to} href={to} className="rounded-key px-3 py-2 font-display text-[16px] font-semibold hover:bg-sunk">{t}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          {user ? <Link to={homeFor(user.role)} className="btn btn-ink btn-sm">Open my {user.role === 'parent' ? 'family page' : user.role === 'admin' ? 'admin' : 'school'}</Link> : (
            <><Link to="/login" className="btn btn-plain btn-sm hidden sm:inline-flex">Sign in</Link><Link to="/register" className="btn btn-primary btn-sm">Start free</Link></>
          )}
          <button className="btn btn-plain btn-sm !px-2 lg:hidden" aria-expanded={open} aria-controls="mnav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <IClose /> : <IMenu />}</button>
        </div>
      </div>
      {/* the satchel strap: a stitched line that fills as you read */}
      <div className="absolute inset-x-0 -bottom-[2px] h-[4px] origin-left bg-pumpkin" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />
      {open && (
        <div id="mnav" className="fixed inset-x-0 bottom-0 top-[64px] z-40 bg-ink/40 lg:hidden" onClick={() => setOpen(false)}>
          <nav className="pop-in absolute inset-x-3 bottom-3 rounded-[18px] border-2 border-ink bg-card p-3 shadow-press" aria-label="Mobile" onClick={(e) => e.stopPropagation()}>
            {LINKS.map(([to, t], i) => <a key={to} href={to} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-line px-3 py-3.5 font-display text-[22px] font-bold last:border-0"><span>{t}</span><span className="text-[14px] text-ink-soft">0{i + 1}</span></a>)}
            {!user && <Link to="/login" className="btn btn-plain mt-2 w-full">Sign in</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}
export function Footer() {
  return (
    <footer className="no-print mt-16 border-t-2 border-ink bg-ink text-chalk">
      <div className="wrap grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="font-display text-[56px] font-extrabold leading-none tracking-tight text-sun md:text-[88px]">basta<span className="text-pumpkin">.</span></div>
          <p className="mt-3 max-w-sm text-chalk/80">Fees, roll call, notices and report cards for small private schools in Nepal. Built in Nepal, free up to 60 students.</p>
        </div>
        <div className="space-y-2 text-[15px]">
          <div className="font-display text-[14px] font-bold uppercase tracking-widest text-sun">Product</div>
          <a className="block hover:underline" href="/#day">How it works</a><a className="block hover:underline" href="/#price">Price</a><Link className="block hover:underline" to="/login">Sign in</Link><Link className="block hover:underline" to="/register">Create a school</Link>
        </div>
        <div className="space-y-2 text-[15px]">
          <div className="font-display text-[14px] font-bold uppercase tracking-widest text-sun">The small print</div>
          <Link className="block hover:underline" to="/terms">Terms of Service</Link><Link className="block hover:underline" to="/privacy">Privacy Policy</Link>
          <a className="block hover:underline" href="https://github.com/nabinbabuuranw/basta" rel="noopener">Source code (MIT)</a>
        </div>
      </div>
      <div className="border-t border-chalk/15"><div className="wrap py-4 text-[13px] text-chalk/70">© 2026 Basta, a Day 4 project of Nabin Babu Uranw's 100 platforms. Not affiliated with any government education body.</div></div>
    </footer>
  );
}
