import { useState, type FormEvent } from 'react';
import { Link, navigate, useLocation } from '../lib/router';
import { api, errorText, ApiError } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';
import { Logo, Field, useToast } from '../components/ui';
import { IBag, IKids } from '../components/Icons';

function Shell({ title, sub, children }: { title: string; sub: string; children: any }) {
  return (
    <div className="page-enter min-h-screen">
      <div className="wrap flex h-16 items-center"><Link to="/" aria-label="Basta home"><Logo /></Link></div>
      <main className="wrap grid max-w-[1000px] gap-10 pb-16 pt-6 md:grid-cols-[1fr_1.1fr]">
        <div className="md:pt-8"><h1 className="text-[40px] font-extrabold sm:text-[52px]">{title}</h1><p className="mt-2 text-[17px] text-ink-soft">{sub}</p></div>
        <div className="sticker p-6 shadow-press"><div className="relative">{children}</div></div>
      </main>
    </div>
  );
}
export function Login() {
  const { refresh } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ email: '', password: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api('/auth/login', { body: f }); await refresh(); navigate(homeFor(r.user.role)); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const demo = async (as: string) => { try { const r = await api('/auth/demo', { body: { as } }); await refresh(); navigate(homeFor(r.user.role)); } catch (e) { toast(errorText(e), 'err'); } };
  return (
    <Shell title="Welcome back" sub="School office, teachers and parents all sign in here.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" id="email"><input id="email" className="field" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" id="password"><input id="password" className="field" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {error && <p className="font-bold text-absent" role="alert">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-4 text-[15px]">New here? <Link to="/register" className="font-bold underline">Create an account</Link></p>
      <div className="sticker-line my-5" />
      <p className="text-[14px] font-bold">Just looking? Open the demo school as</p>
      <div className="mt-2 flex flex-wrap gap-2">{[['office', 'Office'], ['teacher', 'Teacher'], ['parent', 'Parent']].map(([a, t]) => <button key={a} className="btn btn-plain btn-sm" onClick={() => demo(a)}>{t}</button>)}</div>
    </Shell>
  );
}
export function Register() {
  const { refresh } = useAuth(); const { search } = useLocation();
  const initial = new URLSearchParams(search).get('as') === 'parent' ? 'parent' : 'school';
  const [kind, setKind] = useState<'school' | 'parent'>(initial as any);
  const [f, setF] = useState({ name: '', email: '', password: '', school_name: '', family_code: '', phone: '', website: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [field, setField] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!agree) { setError('Please accept the Terms and Privacy Policy.'); return; }
    setBusy(true); setError(null); setField(null);
    try { const r = await api('/auth/register', { body: { ...f, kind } }); await refresh(); navigate(homeFor(r.user.role)); }
    catch (e) { setError(errorText(e)); if (e instanceof ApiError) setField(e.field || null); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Shell title={kind === 'school' ? 'Pack a bag for your school' : 'Follow your child at school'} sub={kind === 'school' ? 'Create the office account. You can add teachers and students right after.' : 'Use the 8-character family code your school gave you. You can add more children later.'}>
      <div role="radiogroup" aria-label="Account type" className="mb-5 grid grid-cols-2 gap-2">
        {([['school', 'I run a school', IBag], ['parent', 'I am a parent', IKids]] as const).map(([k, t, Ic]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`flex items-center gap-2 rounded-key border-2 border-ink px-3 py-2.5 font-display font-bold ${kind === k ? 'bg-ink text-chalk' : 'bg-card'}`}><Ic size={20} />{t}</button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {kind === 'school' && <Field label="School name" id="school_name" error={field === 'school_name' ? error : null}><input id="school_name" className="field" value={f.school_name} onChange={set('school_name')} placeholder="Shree Saraswati English School" /></Field>}
        <Field label="Your name" id="name" error={field === 'name' ? error : null}><input id="name" className="field" autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Email" id="remail" error={field === 'email' ? error : null}><input id="remail" className="field" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" id="rpw" hint="8 or more characters, with a letter and a number." error={field === 'password' ? error : null}><input id="rpw" className="field" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        {kind === 'parent' && <Field label="Family code (optional now)" id="fc" hint="Printed by the school, like K7QM2XPA." error={field === 'family_code' ? 'That code does not match an active student. Check it with the school.' : null}><input id="fc" className="field uppercase tracking-[0.2em]" maxLength={9} value={f.family_code} onChange={set('family_code')} /></Field>}
        <Field label="Mobile (optional)" id="phone" error={field === 'phone' ? error : null}><input id="phone" className="field" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="98XXXXXXXX" /></Field>
        <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden="true" />
        <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#233D4D]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I accept the <Link to="/terms" className="underline">Terms of Service</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</span></label>
        {error && !field && <p className="font-bold text-absent" role="alert">{error}</p>}
        {error && field && <p className="sr-only" role="alert">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : kind === 'school' ? 'Create school account' : 'Create parent account'}</button>
      </form>
      <p className="mt-4 text-[15px]">Already have an account? <Link to="/login" className="font-bold underline">Sign in</Link></p>
    </Shell>
  );
}
