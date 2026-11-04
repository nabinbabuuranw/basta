import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, navigate, useLocation } from '../lib/router';
import { api, errorText } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, homeFor } from '../lib/auth';
import { rs, bsDate, ago } from '../lib/format';
import { Logo, Field, SkeletonRows, Skeleton, Empty, ErrorBox, DemoBanner, useToast } from '../components/ui';
import { IOut, IPlus, IPrint, IPin, IReport, IBell, ICoin, IRoll } from '../components/Icons';
import { PAY_LABEL, bsYmOf, addBsMonths, ktmTodayIso } from '../../shared/school';
import { adToBs } from '../../shared/nepali-date.js';

export default function Family() {
  const { user, loading, logout } = useAuth(); const { path } = useLocation(); const toast = useToast();
  const kids = useApi<any>(user?.role === 'parent' ? '/family' : null);
  useEffect(() => { if (!loading && (!user || user.role !== 'parent')) navigate(user ? homeFor(user.role) : '/login', { replace: true }); }, [user, loading]);
  const id = Number(path.split('/')[2]) || kids.data?.children[0]?.id;
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const link = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api('/family/link', { body: { code } }); toast(`${r.student.name} added`); setCode(''); setAdding(false); await kids.reload(true); navigate(`/family/${r.student.id}`); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); } };
  if (loading || !user || user.role !== 'parent') return <div className="wrap py-10"><SkeletonRows n={5} /></div>;
  const demo = kids.data?.children.some((c: any) => c.is_demo);
  return (
    <div className="min-h-screen pb-16">
      <DemoBanner show={!!demo} />
      <header className="wrap flex items-center justify-between gap-3 py-5">
        <Link to="/" aria-label="Basta home"><Logo small /></Link>
        <div className="flex items-center gap-2"><span className="hidden text-[14px] text-ink-soft sm:inline">{user.name}</span><button className="btn btn-plain btn-sm" onClick={async () => { await logout(); navigate('/'); }}><IOut size={18} /> Sign out</button></div>
      </header>
      <main className="wrap max-w-[860px]">
        {kids.error ? <ErrorBox text={kids.error} retry={kids.reload} /> : !kids.data ? <><Skeleton className="h-40" /><div className="mt-4"><SkeletonRows n={4} /></div></> : (
          <>
            {kids.data.children.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Children">
                {kids.data.children.map((c: any) => <Link key={c.id} to={`/family/${c.id}`} role="tab" aria-selected={c.id === id} className={`relative rounded-pill border-2 border-ink px-4 py-1.5 font-display font-bold ${c.id === id ? 'bg-ink text-chalk' : 'bg-card'}`}>{c.name.split(' ')[0]}{c.unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-pumpkin px-1 text-[11px] text-ink">{c.unread}</span>}</Link>)}
                <button className="btn btn-plain btn-sm" onClick={() => setAdding(!adding)}><IPlus size={18} /> Add a child</button>
              </div>
            )}
            {(adding || kids.data.children.length === 0) && (
              <form onSubmit={link} className="sticker mb-6 p-5"><div className="relative">
                <h1 className="text-[28px] font-extrabold">{kids.data.children.length ? 'Add another child' : 'Link your child'}</h1>
                <p className="text-ink-soft">Type the 8-character family code the school gave you.</p>
                <div className="mt-3 flex flex-wrap items-end gap-2"><Field label="Family code" id="fcode" error={err}><input id="fcode" className="field num !w-56 uppercase tracking-[0.25em]" maxLength={9} value={code} onChange={(e) => setCode(e.target.value)} /></Field><button className="btn btn-primary" disabled={busy || code.trim().length < 8}>{busy ? 'Linking…' : 'Link'}</button></div>
              </div></form>
            )}
            {id ? <Child id={id} key={id} onRead={() => kids.reload(true)} /> : null}
          </>
        )}
      </main>
    </div>
  );
}
function Child({ id, onRead }: { id: number; onRead: () => void }) {
  const toast = useToast(); const cur = bsYmOf(ktmTodayIso())!; const [month, setMonth] = useState(cur);
  const { data, error, reload } = useApi<any>(`/family/${id}?month=${month}`);
  const [tab, setTab] = useState<'att' | 'fees' | 'notices' | 'results'>('att');
  const read = async (n: any) => { if (n.read) return; try { await api(`/notices/${n.id}/read`, { method: 'POST' }); reload(true); onRead(); } catch (e) { toast(errorText(e), 'err'); } };
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <><Skeleton className="h-40" /><div className="mt-4"><SkeletonRows n={4} /></div></>;
  const c = data.child; const today = data.attendance.find((a: any) => a.day === ktmTodayIso());
  const unread = data.notices.filter((n: any) => !n.read).length;
  const tabs = [['att', 'Attendance', IRoll], ['fees', 'Fees', ICoin], ['notices', `Notices${unread ? ` (${unread})` : ''}`, IBell], ['results', 'Results', IReport]] as const;
  return (
    <div className="page-enter">
      <section className="sticker p-5 shadow-press"><div className="relative grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div><div className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">{c.school}</div><h1 className="mt-1 text-[34px] font-extrabold leading-tight">{c.name}</h1>
          <div className="mt-1 flex flex-wrap gap-2 text-[15px]"><span className="chip bg-sunk">{c.class_name}</span><span className="chip bg-sunk">Roll {c.roll ?? '-'}</span></div></div>
        <div className="grid grid-cols-2 gap-2 sm:w-72">
          <div className={`rounded-key border-2 border-ink p-3 ${today?.status === 'A' ? 'bg-pumpkin-soft' : today?.status === 'P' ? 'bg-sage-soft' : 'bg-sunk'}`}><div className="text-[12px] font-bold uppercase text-ink-soft">Today</div><div className="font-display text-[20px] font-bold">{today ? (today.status === 'P' ? 'Present' : today.status === 'A' ? 'Absent' : 'On leave') : 'Not marked'}</div></div>
          <div className={`rounded-key border-2 border-ink p-3 ${data.balance.due > 0 ? 'bg-sun-soft' : 'bg-sage-soft'}`}><div className="text-[12px] font-bold uppercase text-ink-soft">Fees due</div><div className="num font-display text-[20px] font-bold">{rs(Math.max(0, data.balance.due))}</div></div>
        </div>
      </div></section>
      <nav className="mt-5 grid grid-cols-4 gap-1.5 rounded-tag border-2 border-ink bg-sunk p-1.5" role="tablist" aria-label="Sections">
        {tabs.map(([k, t, Ic]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k as any)} className={`flex flex-col items-center gap-0.5 rounded-key px-1 py-2 font-display text-[13px] font-bold sm:flex-row sm:justify-center sm:gap-2 sm:text-[15px] ${tab === k ? 'bg-card shadow-pressSm' : ''}`}><Ic size={19} />{t}</button>)}
      </nav>
      <div key={tab} className="fade-up mt-5">
        {tab === 'att' && <MonthCalendar data={data} month={month} setMonth={setMonth} cur={cur} />}
        {tab === 'fees' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2 text-center">{[['Billed', data.balance.charged], ['Paid', data.balance.paid], [data.balance.due >= 0 ? 'Due' : 'Advance', Math.abs(data.balance.due)]].map(([l, v]) => <div key={l as string} className="tag p-3"><div className="text-[12px] font-bold uppercase text-ink-soft">{l}</div><div className="num font-display text-[18px] font-bold sm:text-[22px]">{rs(v as number)}</div></div>)}</div>
            <div><h2 className="text-[22px] font-bold">Receipts</h2>{data.payments.length === 0 ? <p className="text-ink-soft">No payments recorded yet.</p> : <ul className="mt-2 divide-y divide-line rounded-key border-2 border-ink bg-card">{data.payments.map((p: any) => <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5"><span><b className="num">{p.receipt_no}</b><span className="block text-[13px] text-ink-soft">{bsDate(p.paid_on)} · {PAY_LABEL[p.method]}</span></span><span className="flex items-center gap-2"><b className="num">{rs(p.amount)}</b><Link to={`/receipt/${p.id}`} className="btn btn-plain btn-sm !px-2" aria-label="View receipt"><IPrint size={18} /></Link></span></li>)}</ul>}</div>
            <div><h2 className="text-[22px] font-bold">What was billed</h2>{data.charges.length === 0 ? <p className="text-ink-soft">Nothing billed yet.</p> : <ul className="mt-2 divide-y divide-line rounded-key border-2 border-ink bg-card">{data.charges.map((x: any) => <li key={x.id} className="flex justify-between gap-2 px-3 py-2"><span>{x.description}</span><b className="num">{rs(x.amount)}</b></li>)}</ul>}</div>
            <p className="text-[13px] text-ink-soft">Pay at the school office as usual. Basta shows what the school has recorded; it does not take payments online.</p>
          </div>)}
        {tab === 'notices' && (data.notices.length === 0 ? <Empty title="No notices from the school yet" /> : (
          <ul className="space-y-3">{data.notices.map((n: any) => (
            <li key={n.id}><details className={`tag group p-4 ${n.read ? '' : 'bg-sun-soft'}`} onToggle={(e) => (e.target as HTMLDetailsElement).open && read(n)}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3"><span><span className="flex items-center gap-2 font-display text-[19px] font-bold">{n.pinned ? <IPin size={16} /> : null}{n.title}</span><span className="text-[13px] text-ink-soft">{n.class_name || 'Whole school'} · {ago(n.created_at)}</span></span>{!n.read && <span className="chip bg-pumpkin">New</span>}</summary>
              <p className="mt-2 whitespace-pre-line">{n.body}</p></details></li>))}</ul>))}
        {tab === 'results' && (data.exams.length === 0 ? <Empty title="No published results yet">Report cards appear here once the school publishes them.</Empty> : (
          <ul className="space-y-2">{data.exams.map((e: any) => <li key={e.id}><Link to={`/report/${e.id}/${c.id}`} className="flex items-center justify-between gap-3 rounded-key border-2 border-ink bg-card px-4 py-3 hover:bg-sunk"><span><b className="font-display text-[19px]">{e.name}</b><span className="block text-[13px] text-ink-soft">Held {bsDate(e.held_on)}</span></span><span className="btn btn-primary btn-sm">Open report card</span></Link></li>)}</ul>))}
      </div>
    </div>
  );
}
function MonthCalendar({ data, month, setMonth, cur }: any) {
  const days = useMemo(() => { const out: { iso: string; d: number; wd: number }[] = []; for (let t = Date.parse(data.start + 'T00:00:00Z'); t <= Date.parse(data.end + 'T00:00:00Z'); t += 86400000) { const iso = new Date(t).toISOString().slice(0, 10); const b = adToBs(iso); out.push({ iso, d: b.day, wd: new Date(t).getUTCDay() }); } return out; }, [data.start, data.end]);
  const map = new Map<string, string>(data.attendance.map((a: any) => [a.day, a.status]));
  const p = data.attendance.filter((a: any) => a.status === 'P').length, total = data.attendance.length;
  const lead = days[0]?.wd || 0;
  return (
    <div className="tag p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-bold">{data.label}</h2>
        <div className="flex gap-1.5"><button className="btn btn-plain btn-sm" onClick={() => setMonth(addBsMonths(month, -1))}>Previous</button><button className="btn btn-plain btn-sm" disabled={month >= cur} onClick={() => setMonth(addBsMonths(month, 1))}>Next</button></div>
      </div>
      <p className="mt-1 text-ink-soft">{total ? <><b className="text-ink">{p} of {total}</b> school days present ({Math.round((p / total) * 100)}%)</> : 'No roll call recorded this month.'}</p>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[12px] font-bold text-ink-soft">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => <div key={'x' + i} />)}
        {days.map((d, i) => { const s = map.get(d.iso); const future = d.iso > ktmTodayIso(); return (
          <div key={d.iso} className={`pop-in grid aspect-square place-items-center rounded-[10px] border-2 text-[14px] font-bold ${s === 'P' ? 'border-ink bg-sage' : s === 'A' ? 'border-ink bg-absent text-chalk' : s === 'L' ? 'border-ink bg-sun' : d.wd === 6 ? 'border-transparent bg-sunk text-ink-soft' : future ? 'border-dashed border-line text-ink-soft' : 'border-line bg-card'}`} style={{ animationDelay: `${i * 12}ms` }} title={s ? (s === 'P' ? 'Present' : s === 'A' ? 'Absent' : 'Leave') : ''}>{d.d}</div>); })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[13px] font-bold"><span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border-2 border-ink bg-sage" />Present</span><span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border-2 border-ink bg-absent" />Absent</span><span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border-2 border-ink bg-sun" />Leave</span><span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-sunk" />Saturday</span></div>
    </div>
  );
}
