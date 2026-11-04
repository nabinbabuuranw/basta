import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, navigate, useLocation } from '../lib/router';
import { api, errorText } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, homeFor } from '../lib/auth';
import { rs, bsDate, ago, initials, waLink } from '../lib/format';
import { Logo, Field, SkeletonRows, Skeleton, Empty, ErrorBox, Modal, Tally, DemoBanner, Stat, useToast } from '../components/ui';
import { IHome, IKids, IRoll, ICoin, IBell, IReport, ICog, IOut, IPlus, ISearch, IChat, IBack, IPrint, IPin } from '../components/Icons';
import { ktmTodayIso, dueReminder, PAY_METHODS, PAY_LABEL, CHARGE_LABEL, parseNpr, FREE_STUDENT_LIMIT } from '../../shared/school';
import { Fees, Notices, Results, Settings } from './Office2';

export interface SchoolInfo { school: any; role: 'owner' | 'teacher'; classes: any[]; students: number; limit: number }
const TABS = [
  { to: '/app', label: 'Today', icon: IHome, owner: false },
  { to: '/app/students', label: 'Students', icon: IKids, owner: false },
  { to: '/app/attendance', label: 'Roll call', icon: IRoll, owner: false },
  { to: '/app/fees', label: 'Fees', icon: ICoin, owner: true },
  { to: '/app/notices', label: 'Notices', icon: IBell, owner: false },
  { to: '/app/results', label: 'Results', icon: IReport, owner: false },
  { to: '/app/settings', label: 'School', icon: ICog, owner: false },
];
export default function Office() {
  const { user, loading, logout } = useAuth(); const { path } = useLocation();
  const info = useApi<SchoolInfo>(user?.role === 'staff' ? '/school' : null);
  useEffect(() => { if (!loading && (!user || user.role !== 'staff')) navigate(user ? homeFor(user.role) : '/login', { replace: true }); }, [user, loading]);
  if (loading || !user || user.role !== 'staff') return <div className="wrap py-10"><SkeletonRows n={6} /></div>;
  const owner = info.data?.role === 'owner';
  const tabs = TABS.filter((t) => owner || !t.owner);
  const seg = path.split('/')[2] || '';
  const active = '/app' + (seg ? '/' + seg : '');
  let body: ReactNode;
  if (info.error) body = <ErrorBox text={info.error} retry={() => info.reload()} />;
  else if (!info.data) body = <SkeletonRows n={7} />;
  else {
    const d = info.data; const reload = () => info.reload(true);
    const id = Number(path.split('/')[3]);
    switch (seg) {
      case 'students': body = id ? <StudentDetail id={id} info={d} reload={reload} /> : <Students info={d} reload={reload} />; break;
      case 'attendance': body = <Attendance info={d} />; break;
      case 'fees': body = owner ? <Fees info={d} /> : <Empty title="Fees are for the office account" />; break;
      case 'notices': body = <Notices info={d} />; break;
      case 'results': body = <Results info={d} />; break;
      case 'settings': body = <Settings info={d} reload={reload} />; break;
      default: body = <Today info={d} />;
    }
  }
  return (
    <div className="min-h-screen pb-16">
      <DemoBanner show={!!info.data?.school.is_demo} />
      <header className="no-print wrap flex flex-wrap items-center justify-between gap-3 pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" aria-label="Basta home"><Logo small /></Link>
          <span className="hidden h-8 w-[2px] bg-ink/20 sm:block" />
          <div className="min-w-0"><div className="truncate font-display text-[20px] font-bold leading-tight">{info.data?.school.name || <Skeleton className="h-6 w-48" />}</div>
            <div className="text-[13px] text-ink-soft">{user.name} · {owner ? 'School office' : 'Teacher'}</div></div>
        </div>
        <button className="btn btn-plain btn-sm" onClick={async () => { await logout(); navigate('/'); }}><IOut size={18} /> Sign out</button>
      </header>
      <div className="wrap">
        <nav className="binder no-print" aria-label="School sections">
          {tabs.map((t) => <Link key={t.to} to={t.to} aria-current={active === t.to ? 'page' : undefined}><t.icon size={19} />{t.label}</Link>)}
        </nav>
        <main key={active} className="binder-panel page-enter p-4 sm:p-6 print-sheet">{body}</main>
      </div>
    </div>
  );
}
export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[30px] font-extrabold sm:text-[36px]">{title}</h1>{sub && <p className="text-ink-soft">{sub}</p>}</div>
      {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function Today({ info }: { info: SchoolInfo }) {
  const { data, error, reload } = useApi<any>('/dashboard');
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-64 md:col-span-2" /><Skeleton className="h-64" /></div>;
  const owner = info.role === 'owner';
  const marked = data.classes.filter((c: any) => c.marked > 0).length;
  const max = Math.max(1, ...(data.trend || []).map((t: any) => Math.max(t.billed, t.collected)));
  return (
    <div>
      <PageHead title="Today" sub={<>{bsDate(data.today)} · {data.students} active students{data.school.plan === 'free' && <> of {data.limit} on Free</>}</>}>
        <Link to="/app/attendance" className="btn btn-primary btn-sm"><IRoll size={18} /> Take roll call</Link>
        <Link to="/app/notices" className="btn btn-plain btn-sm"><IBell size={18} /> Post a notice</Link>
      </PageHead>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Roll call done" value={`${marked}/${data.classes.length}`} sub={marked === data.classes.length ? 'Every class is marked' : 'classes marked today'} tone="sun" />
        {owner ? <Stat label={`Collected in ${data.label}`} value={rs(data.collected_month)} sub="receipts issued this month" tone="sage" /> : <Stat label="Absent today" value={data.classes.reduce((s: number, c: any) => s + c.absent, 0)} sub="across all classes" tone="sage" />}
        {owner ? <Stat label="Still owed" value={rs(data.outstanding)} sub={`by ${data.owing} students`} tone="pumpkin" /> : <Stat label="Notices" value={data.notices.length} sub="latest shown below" tone="pumpkin" />}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="tag p-4">
          <h2 className="text-[22px] font-bold">Classes today</h2>
          <ul className="mt-3 divide-y divide-line">
            {data.classes.length === 0 && <li className="py-3 text-ink-soft">No classes yet. {owner && <Link className="underline" to="/app/settings">Add classes</Link>}</li>}
            {data.classes.map((c: any) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><div className="font-display text-[18px] font-bold">{c.name}</div><div className="text-[14px] text-ink-soft">{c.total} students</div></div>
                {c.marked > 0 ? <div className="flex items-center gap-3"><Tally n={c.marked - c.absent} max={20} /><span className="chip bg-sage-soft">{c.absent ? `${c.absent} absent` : 'all present'}</span></div>
                  : <Link to={`/app/attendance?class=${c.id}`} className="btn btn-plain btn-sm">Mark now</Link>}
              </li>
            ))}
          </ul>
        </section>
        <section className="tag p-4">
          <div className="flex items-center justify-between"><h2 className="text-[22px] font-bold">Latest notices</h2><Link to="/app/notices" className="text-[14px] font-bold underline">All</Link></div>
          <ul className="mt-3 space-y-2">
            {data.notices.length === 0 && <li className="text-ink-soft">Nothing posted yet.</li>}
            {data.notices.map((n: any) => <li key={n.id} className="rounded-key bg-sunk px-3 py-2"><div className="flex items-center gap-2 font-bold">{n.pinned ? <IPin size={16} /> : null}{n.title}</div><div className="text-[13px] text-ink-soft">{ago(n.created_at)} · opened by {n.reads} guardian{n.reads === 1 ? '' : 's'}</div></li>)}
          </ul>
        </section>
      </div>
      {owner && data.trend && (
        <section className="tag mt-6 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[22px] font-bold">Billed and collected, last 6 months</h2>
            <div className="flex gap-3 text-[13px] font-bold"><span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-ink bg-sun" />Billed</span><span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-ink bg-teal" />Collected</span></div></div>
          <div className="mt-4 grid h-48 grid-cols-6 items-end gap-3" role="img" aria-label="Bar chart of fees billed and collected per month">
            {data.trend.map((t: any, i: number) => (
              <div key={t.month} className="flex h-full flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-1">
                  <div className="bar-grow w-1/3 rounded-t-[6px] border-2 border-ink bg-sun" style={{ height: `${(t.billed / max) * 100}%`, animationDelay: `${i * 60}ms` }} title={`Billed ${rs(t.billed)}`} />
                  <div className="bar-grow w-1/3 rounded-t-[6px] border-2 border-ink bg-teal" style={{ height: `${(t.collected / max) * 100}%`, animationDelay: `${i * 60 + 30}ms` }} title={`Collected ${rs(t.collected)}`} />
                </div>
                <div className="mt-1.5 truncate text-center text-[12px] font-bold">{t.label.split(' ')[0]}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ClassPicker({ classes, value, onChange, all = false, id = 'cls' }: { classes: any[]; value: string; onChange: (v: string) => void; all?: boolean; id?: string }) {
  return (
    <select id={id} className="field !w-auto min-w-[160px]" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Class">
      {all && <option value="">All classes</option>}
      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

function Students({ info, reload }: { info: SchoolInfo; reload: () => void }) {
  const owner = info.role === 'owner'; const { search } = useLocation();
  const [cls, setCls] = useState(new URLSearchParams(search).get('class') || ''); const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  useEffect(() => { const t = setTimeout(() => setQq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const list = useApi<any>(`/students?${new URLSearchParams({ ...(cls ? { class: cls } : {}), ...(qq ? { q: qq } : {}) })}`);
  const [add, setAdd] = useState(false); const [bulk, setBulk] = useState(false);
  const done = () => { list.reload(true); reload(); };
  return (
    <div>
      <PageHead title="Students" sub={`${info.students} active${info.school.plan === 'free' ? ` · Free plan holds ${FREE_STUDENT_LIMIT}` : ''}`}>
        {owner && <><button className="btn btn-primary btn-sm" onClick={() => setAdd(true)} disabled={!info.classes.length}><IPlus size={18} /> Add student</button><button className="btn btn-plain btn-sm" onClick={() => setBulk(true)} disabled={!info.classes.length}>Paste a list</button></>}
      </PageHead>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <ClassPicker classes={info.classes} value={cls} onChange={setCls} all />
        <label className="relative min-w-[220px] flex-1"><span className="sr-only">Search students</span><ISearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" /><input className="field !pl-10" placeholder="Search name, guardian or phone" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      {!info.classes.length ? <Empty title="Add a class first" action={owner ? <Link to="/app/settings" className="btn btn-primary btn-sm">Add classes</Link> : null}>Students belong to classes like “Grade 3”.</Empty>
        : list.error ? <ErrorBox text={list.error} retry={list.reload} /> : !list.data ? <SkeletonRows n={8} /> : list.data.students.length === 0 ? <Empty title={qq ? 'No student matches that search' : 'No students in this class yet'}>{owner && !qq && 'Add them one by one, or paste a list from Excel.'}</Empty> : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="table-x"><thead><tr><th>Roll</th><th>Name</th><th>Class</th><th>Guardian</th>{owner && <th className="text-right">Due</th>}<th>Parent app</th></tr></thead>
              <tbody>{list.data.students.map((s: any) => (
                <tr key={s.id} className="cursor-pointer" onClick={() => navigate(`/app/students/${s.id}`)}>
                  <td className="num">{s.roll ?? '-'}</td><td><Link to={`/app/students/${s.id}`} className="font-bold hover:underline" onClick={(e) => e.stopPropagation()}>{s.name}</Link></td><td>{s.class_name}</td>
                  <td>{s.guardian_name || '-'}<div className="text-[13px] text-ink-soft">{s.guardian_phone}</div></td>
                  {owner && <td className={`num text-right font-bold ${s.due > 0 ? 'text-absent' : 'text-sage-ink'}`}>{s.due > 0 ? rs(s.due) : 'Clear'}</td>}
                  <td>{s.linked ? <span className="chip bg-sage-soft">Linked</span> : <span className="chip bg-sunk">Not yet</span>}</td>
                </tr>))}</tbody></table>
          </div>
          <ul className="grid gap-2 md:hidden">{list.data.students.map((s: any) => (
            <li key={s.id}><Link to={`/app/students/${s.id}`} className="flex items-center gap-3 rounded-key border-2 border-ink bg-card p-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-ink bg-sun font-display font-bold">{initials(s.name)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-bold">{s.name}</span><span className="block text-[13px] text-ink-soft">{s.class_name} · Roll {s.roll ?? '-'}</span></span>
              {owner && <span className={`num text-[14px] font-bold ${s.due > 0 ? 'text-absent' : 'text-sage-ink'}`}>{s.due > 0 ? rs(s.due) : 'Clear'}</span>}
            </Link></li>))}</ul>
        </>
      )}
      <AddStudent open={add} onClose={() => setAdd(false)} classes={info.classes} defaultClass={cls} done={done} />
      <BulkStudents open={bulk} onClose={() => setBulk(false)} classes={info.classes} defaultClass={cls} done={done} />
    </div>
  );
}
function StudentForm({ init, classes, onSubmit, busy, error, submitLabel }: { init: any; classes: any[]; onSubmit: (v: any) => void; busy: boolean; error: string | null; submitLabel: string }) {
  const [f, setF] = useState(init);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} noValidate>
      <Field label="Full name" id="sn"><input id="sn" className="field" value={f.name} onChange={set('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class" id="sc"><select id="sc" className="field" value={f.class_id} onChange={set('class_id')}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Roll no." id="sr"><input id="sr" className="field" inputMode="numeric" value={f.roll ?? ''} onChange={set('roll')} /></Field>
      </div>
      <Field label="Gender" id="sg"><select id="sg" className="field" value={f.gender} onChange={set('gender')}><option value="">Prefer not to say</option><option value="girl">Girl</option><option value="boy">Boy</option><option value="other">Other</option></select></Field>
      <Field label="Guardian name" id="gn"><input id="gn" className="field" value={f.guardian_name} onChange={set('guardian_name')} /></Field>
      <Field label="Guardian mobile" id="gp" hint="Used for WhatsApp reminders."><input id="gp" className="field" inputMode="tel" placeholder="98XXXXXXXX" value={f.guardian_phone} onChange={set('guardian_phone')} /></Field>
      {error && <p className="font-bold text-absent" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  );
}
function AddStudent({ open, onClose, classes, defaultClass, done }: any) {
  const toast = useToast(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [made, setMade] = useState<any>(null);
  const submit = async (v: any) => {
    setBusy(true); setError(null);
    try { const r = await api('/students', { body: { ...v, roll: v.roll === '' ? null : v.roll } }); setMade({ ...r, name: v.name }); toast('Student added'); done(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => { setMade(null); onClose(); }} title={made ? 'Added to the bag' : 'Add a student'}>
      {made ? (
        <div className="text-center"><p>Give this family code to {made.name}’s guardian so they can open the parent app.</p>
          <div className="sticker mx-auto my-4 w-fit px-6 py-3"><span className="relative font-display text-[34px] font-extrabold tracking-[0.2em]">{made.family_code}</span></div>
          <div className="flex justify-center gap-2"><button className="btn btn-plain btn-sm" onClick={() => setMade(null)}>Add another</button><Link to={`/app/students/${made.id}`} className="btn btn-primary btn-sm">Open profile</Link></div></div>
      ) : <StudentForm key={String(open)} init={{ name: '', class_id: defaultClass || classes[0]?.id, roll: '', gender: '', guardian_name: '', guardian_phone: '' }} classes={classes} onSubmit={submit} busy={busy} error={error} submitLabel="Add student" />}
    </Modal>
  );
}
function BulkStudents({ open, onClose, classes, defaultClass, done }: any) {
  const toast = useToast(); const [cls, setCls] = useState(defaultClass || classes[0]?.id); const [rows, setRows] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) setCls(defaultClass || classes[0]?.id); }, [open]);
  const n = rows.split('\n').filter((l) => l.trim()).length;
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api('/students/bulk', { body: { class_id: cls, rows } }); toast(`${r.added} students added`); setRows(''); done(); onClose(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title="Paste a class list" wide>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Class" id="bc"><ClassPicker id="bc" classes={classes} value={String(cls)} onChange={setCls} /></Field>
        <Field label="One student per line" id="br" hint="Name, roll, guardian name, guardian mobile. Copy straight from Excel (tabs) or type with commas. Up to 120 lines."><textarea id="br" className="field min-h-[180px] font-mono text-[14px]" value={rows} onChange={(e) => setRows(e.target.value)} placeholder={'Ram Thapa, 1, Gopal Thapa, 9811111111\nGita Rai, 2, Maya Rai, 9822222222'} /></Field>
        {error && <p className="font-bold text-absent" role="alert">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !n}>{busy ? 'Adding…' : `Add ${n || ''} student${n === 1 ? '' : 's'}`}</button>
      </form>
    </Modal>
  );
}
function StudentDetail({ id, info, reload }: { id: number; info: SchoolInfo; reload: () => void }) {
  const owner = info.role === 'owner'; const toast = useToast();
  const { data, error, reload: again } = useApi<any>(`/students/${id}`);
  const [edit, setEdit] = useState(false); const [pay, setPay] = useState(false); const [charge, setCharge] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  if (error) return <ErrorBox text={error} retry={again} />;
  if (!data) return <SkeletonRows n={6} />;
  const s = data.student; const att: Record<string, number> = Object.fromEntries(data.attendance.map((a: any) => [a.status, a.n]));
  const totalAtt = (att.P || 0) + (att.A || 0) + (att.L || 0);
  const save = async (v: any) => { setBusy(true); setErr(null); try { await api(`/students/${id}`, { method: 'PUT', body: { ...v, roll: v.roll === '' ? null : v.roll } }); toast('Saved'); setEdit(false); again(true); reload(); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); } };
  const newCode = async () => { if (!confirm('Make a new family code? The old one stops working for new sign-ups.')) return; try { await api(`/students/${id}/code`, { method: 'POST' }); again(true); toast('New code made'); } catch (e) { toast(errorText(e), 'err'); } };
  const voidPay = async (p: any) => { const reason = prompt(`Cancel receipt ${p.receipt_no}? Type the reason:`); if (!reason) return; try { await api(`/payments/${p.id}/void`, { body: { reason } }); toast('Receipt cancelled'); again(true); } catch (e) { toast(errorText(e), 'err'); } };
  const voidCharge = async (c: any) => { if (!confirm(`Remove “${c.description}”?`)) return; try { await api(`/charges/${c.id}/void`, { method: 'POST' }); toast('Charge removed'); again(true); } catch (e) { toast(errorText(e), 'err'); } };
  const toggleActive = async () => { try { await api(`/students/${id}`, { method: 'PUT', body: { ...s, active: s.active ? 0 : 1 } }); again(true); reload(); toast(s.active ? 'Marked as left school' : 'Back in school'); } catch (e) { toast(errorText(e), 'err'); } };
  return (
    <div>
      <Link to="/app/students" className="no-print mb-3 inline-flex items-center gap-1 text-[15px] font-bold"><IBack size={18} /> All students</Link>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <div className="sticker p-5">
            <div className="relative">
              <div className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Name label</div>
              <div className="mt-1 font-display text-[28px] font-extrabold leading-tight">{s.name}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[15px]">
                <div><span className="text-[13px] text-ink-soft">Class</span><div className="sticker-line font-bold">{s.class_name}</div></div>
                <div><span className="text-[13px] text-ink-soft">Roll</span><div className="sticker-line font-bold">{s.roll ?? '-'}</div></div>
                <div className="col-span-2"><span className="text-[13px] text-ink-soft">Guardian</span><div className="sticker-line font-bold">{s.guardian_name || '-'} {s.guardian_phone && <span className="font-normal">· {s.guardian_phone}</span>}</div></div>
              </div>
              {!s.active && <div className="chip mt-3 bg-sunk">Left school</div>}
            </div>
          </div>
          {owner && <div className="tag p-4"><div className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">Family code for the parent app</div>
            <div className="num mt-1 font-display text-[28px] font-extrabold tracking-[0.18em]">{s.family_code}</div>
            <div className="mt-1 text-[14px] text-ink-soft">{data.guardians.length ? `Linked: ${data.guardians.map((g: any) => g.name).join(', ')}` : 'No guardian has linked yet.'}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.guardian_phone && <a className="btn btn-plain btn-sm" target="_blank" rel="noopener" href={waLink(s.guardian_phone, `Namaste! ${info.school.name} uses Basta. Open ${location.origin}/register?as=parent and enter family code ${s.family_code} to see ${s.name}'s attendance, fees and results.`)}><IChat size={18} /> Send on WhatsApp</a>}
              <button className="btn btn-plain btn-sm" onClick={newCode}>New code</button></div></div>}
          <div className="tag p-4"><div className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">Attendance (all time)</div>
            {totalAtt ? <><div className="mt-2 flex items-center gap-3"><div className="num font-display text-[30px] font-extrabold">{Math.round(((att.P || 0) / totalAtt) * 100)}%</div><Tally n={att.P || 0} max={20} /></div>
              <div className="text-[14px] text-ink-soft">{att.P || 0} present · {att.A || 0} absent · {att.L || 0} leave</div></> : <p className="mt-1 text-ink-soft">No roll call yet.</p>}
          </div>
          {owner && <div className="flex flex-wrap gap-2"><button className="btn btn-plain btn-sm" onClick={() => setEdit(true)}>Edit details</button><button className="btn btn-plain btn-sm" onClick={toggleActive}>{s.active ? 'Mark as left' : 'Bring back'}</button></div>}
        </aside>
        <section>
          {owner ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Billed" value={rs(data.balance.charged)} />
                <Stat label="Paid" value={rs(data.balance.paid)} tone="sage" />
                <Stat label={data.balance.due >= 0 ? 'Due now' : 'Advance'} value={rs(Math.abs(data.balance.due))} tone={data.balance.due > 0 ? 'pumpkin' : 'card'} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => setPay(true)}><ICoin size={18} /> Record payment</button>
                <button className="btn btn-plain btn-sm" onClick={() => setCharge(true)}><IPlus size={18} /> Add a charge</button>
                {data.balance.due > 0 && s.guardian_phone && <a className="btn btn-plain btn-sm" target="_blank" rel="noopener" href={waLink(s.guardian_phone, dueReminder({ school: info.school.name, student: s.name, className: s.class_name, amount: data.balance.due, lang: 'ne' }))}><IChat size={18} /> Reminder (नेपाली)</a>}
              </div>
              <h2 className="mt-6 text-[22px] font-bold">Receipts</h2>
              {data.payments.length === 0 ? <p className="mt-2 text-ink-soft">No payments recorded.</p> : (
                <ul className="mt-2 divide-y divide-line rounded-key border-2 border-ink bg-card">{data.payments.map((p: any) => (
                  <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${p.voided ? 'opacity-60' : ''}`}>
                    <div><b className="num">{p.receipt_no}</b> <span className="text-ink-soft">· {bsDate(p.paid_on)} · {PAY_LABEL[p.method]}</span>{p.voided ? <span className="chip ml-2 bg-sunk">Cancelled</span> : null}</div>
                    <div className="flex items-center gap-2"><b className="num">{rs(p.amount)}</b>{!p.voided && <><Link to={`/receipt/${p.id}`} className="btn btn-plain btn-sm !px-2" aria-label={`Print ${p.receipt_no}`}><IPrint size={18} /></Link><button className="btn btn-plain btn-sm" onClick={() => voidPay(p)}>Cancel</button></>}</div>
                  </li>))}</ul>)}
              <h2 className="mt-6 text-[22px] font-bold">Charges</h2>
              {data.charges.length === 0 ? <p className="mt-2 text-ink-soft">Nothing billed yet. Generate monthly fees from the Fees tab.</p> : (
                <ul className="mt-2 divide-y divide-line rounded-key border-2 border-ink bg-card">{data.charges.map((c: any) => (
                  <li key={c.id} className={`flex items-center justify-between gap-2 px-3 py-2.5 ${c.voided ? 'line-through opacity-50' : ''}`}><span><b>{c.description}</b> <span className="text-[13px] text-ink-soft">{CHARGE_LABEL[c.kind]}</span></span>
                    <span className="flex items-center gap-2"><b className="num">{rs(c.amount)}</b>{!c.voided && <button className="btn btn-plain btn-sm !px-2" onClick={() => voidCharge(c)} aria-label="Remove charge">×</button>}</span></li>))}</ul>)}
            </>
          ) : <Empty title="Fees stay with the office">Teachers see attendance, notices and results. Ask the office about payments.</Empty>}
        </section>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit student"><StudentForm init={{ ...s, roll: s.roll ?? '' }} classes={info.classes} onSubmit={save} busy={busy} error={err} submitLabel="Save" /></Modal>
      <PaymentModal open={pay} onClose={() => setPay(false)} student={s} due={data.balance.due} done={() => again(true)} />
      <ChargeModal open={charge} onClose={() => setCharge(false)} studentId={s.id} done={() => again(true)} />
    </div>
  );
}
export function PaymentModal({ open, onClose, student, due, done }: any) {
  const toast = useToast(); const [f, setF] = useState({ amount: '', method: 'cash', paid_on: ktmTodayIso(), note: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [made, setMade] = useState<any>(null);
  useEffect(() => { if (open) { setF({ amount: due > 0 ? String(due / 100) : '', method: 'cash', paid_on: ktmTodayIso(), note: '' }); setMade(null); setError(null); } }, [open]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api('/payments', { body: { ...f, student_id: student.id } }); setMade(r); toast(`Receipt ${r.receipt_no} issued`); done(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } };
  const amt = parseNpr(f.amount);
  return (
    <Modal open={open} onClose={onClose} title={made ? 'Receipt issued' : `Payment from ${student?.name || ''}`}>
      {made ? <div className="text-center"><div className="sticker mx-auto w-fit px-6 py-4"><div className="relative"><div className="text-[13px] text-ink-soft">Receipt</div><div className="num font-display text-[28px] font-extrabold">{made.receipt_no}</div><div className="text-[14px]">Balance now {rs(Math.max(0, made.balance.due))}</div></div></div>
        <div className="mt-4 flex justify-center gap-2"><button className="btn btn-plain btn-sm" onClick={onClose}>Done</button><Link to={`/receipt/${made.id}`} className="btn btn-primary btn-sm"><IPrint size={18} /> Print</Link></div></div> : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Amount (Rs)" id="pa" hint={due > 0 ? `Due now: ${rs(due)}` : undefined}><input id="pa" className="field num text-[20px] font-bold" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paid by" id="pm"><select id="pm" className="field" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{PAY_METHODS.map((m) => <option key={m} value={m}>{PAY_LABEL[m]}</option>)}</select></Field>
            <Field label="Date (AD)" id="pd" hint={bsDate(f.paid_on)}><input id="pd" type="date" className="field" max={ktmTodayIso()} value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} /></Field>
          </div>
          <Field label="Note (optional)" id="pn"><input id="pn" className="field" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="eSewa ref, cheque no." /></Field>
          {error && <p className="font-bold text-absent" role="alert">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy || !amt}>{busy ? 'Saving…' : amt ? `Issue receipt for ${rs(amt)}` : 'Enter an amount'}</button>
        </form>)}
    </Modal>
  );
}
export function ChargeModal({ open, onClose, studentId, classes, done }: any) {
  const toast = useToast(); const [f, setF] = useState({ kind: 'exam', description: '', amount: '', class_id: classes?.[0]?.id || '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api('/charges', { body: { ...f, ...(studentId ? { student_id: studentId, class_id: undefined } : {}) } }); toast(`Charge added to ${r.created} student${r.created === 1 ? '' : 's'}`); done(); onClose(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title={studentId ? 'Add a charge' : 'Charge a whole class'}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {!studentId && <Field label="Class" id="cc"><ClassPicker id="cc" classes={classes} value={String(f.class_id)} onChange={(v) => setF({ ...f, class_id: v })} /></Field>}
        <Field label="Type" id="ck"><select id="ck" className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['exam', 'transport', 'admission', 'other'].map((k) => <option key={k} value={k}>{CHARGE_LABEL[k]}</option>)}</select></Field>
        <Field label="Description" id="cd"><input id="cd" className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="First terminal exam fee" /></Field>
        <Field label="Amount (Rs)" id="ca"><input id="ca" className="field" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        {error && <p className="font-bold text-absent" role="alert">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Adding…' : 'Add charge'}</button>
      </form>
    </Modal>
  );
}

function Attendance({ info }: { info: SchoolInfo }) {
  const { search } = useLocation(); const toast = useToast();
  const [cls, setCls] = useState(new URLSearchParams(search).get('class') || String(info.classes[0]?.id || ''));
  const [date, setDate] = useState(ktmTodayIso()); const [view, setView] = useState<'day' | 'month'>('day');
  const roster = useApi<any>(cls && view === 'day' ? `/attendance?class=${cls}&date=${date}` : null);
  const reg = useApi<any>(cls && view === 'month' ? `/attendance/register?class=${cls}` : null);
  const [marks, setMarks] = useState<Record<number, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (roster.data) setMarks(Object.fromEntries(roster.data.roster.map((r: any) => [r.id, r.status || 'P']))); }, [roster.data]);
  const cycle = (id: number) => setMarks((m) => ({ ...m, [id]: m[id] === 'P' ? 'A' : m[id] === 'A' ? 'L' : 'P' }));
  const save = async () => { setBusy(true);
    try { const r = await api('/attendance', { method: 'PUT', body: { class_id: Number(cls), date, marks: Object.entries(marks).map(([k, v]) => ({ student_id: Number(k), status: v })) } }); toast(`Saved · ${r.absent} absent`); roster.reload(true); } catch (e) { toast(errorText(e), 'err'); } finally { setBusy(false); } };
  if (!info.classes.length) return <Empty title="No classes yet">Add classes in the School tab first.</Empty>;
  const counts = Object.values(marks).reduce((a: any, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {} as Record<string, number>);
  return (
    <div>
      <PageHead title="Roll call" sub="Everyone starts present. Tap once for absent, twice for leave.">
        <div className="flex rounded-key border-2 border-ink p-0.5" role="tablist">{(['day', 'month'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} className={`rounded-[7px] px-3 py-1.5 font-display font-bold ${view === v ? 'bg-ink text-chalk' : ''}`} onClick={() => setView(v)}>{v === 'day' ? 'Daily' : 'Month register'}</button>)}</div>
      </PageHead>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <ClassPicker classes={info.classes} value={cls} onChange={setCls} />
        {view === 'day' && <label className="flex items-center gap-2"><span className="sr-only">Date</span><input type="date" className="field !w-auto" max={ktmTodayIso()} value={date} onChange={(e) => setDate(e.target.value)} /><span className="text-[14px] font-bold text-ink-soft">{bsDate(date)}</span></label>}
      </div>
      {view === 'day' ? (roster.error ? <ErrorBox text={roster.error} retry={roster.reload} /> : !roster.data ? <SkeletonRows n={8} /> : roster.data.roster.length === 0 ? <Empty title="No students in this class" /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[14px] font-bold">
            <span className="chip bg-sage-soft">{counts.P || 0} present</span><span className="chip bg-pumpkin-soft">{counts.A || 0} absent</span><span className="chip bg-sun-soft">{counts.L || 0} leave</span>
            <span className={roster.data.marked ? 'text-sage-ink' : 'text-pumpkin-ink'}>{roster.data.marked ? 'Saved for this day; changes allowed' : 'Not saved yet'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {roster.data.roster.map((r: any) => { const m = marks[r.id] || 'P'; return (
              <button key={r.id} onClick={() => cycle(r.id)} aria-label={`${r.name}: ${m === 'P' ? 'present' : m === 'A' ? 'absent' : 'leave'}`}
                className={`flex items-center gap-3 rounded-key border-2 border-ink p-3 text-left transition-[transform,background-color] duration-150 active:translate-y-[2px] ${m === 'A' ? 'bg-pumpkin-soft' : m === 'L' ? 'bg-sun-soft' : 'bg-card'}`}>
                <span className={`grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-ink font-display text-[18px] font-extrabold ${m === 'A' ? 'bg-absent text-chalk' : m === 'L' ? 'bg-sun' : 'bg-sage'}`}>{m}</span>
                <span className="min-w-0"><span className="block text-[12px] font-bold text-ink-soft">Roll {r.roll ?? '-'}</span><span className="block truncate font-bold">{r.name}</span></span>
              </button>); })}
          </div>
          <div className="sticky bottom-3 mt-4 flex justify-end"><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save roll call'}</button></div>
        </>
      )) : (reg.error ? <ErrorBox text={reg.error} retry={reg.reload} /> : !reg.data ? <SkeletonRows n={8} /> : <Register data={reg.data} />)}
    </div>
  );
}
function Register({ data }: { data: any }) {
  const days = useMemo(() => { const out: string[] = []; for (let d = Date.parse(data.start + 'T00:00:00Z'); d <= Date.parse(data.end + 'T00:00:00Z'); d += 86400000) out.push(new Date(d).toISOString().slice(0, 10)); return out; }, [data]);
  const map = useMemo(() => { const m = new Map<string, string>(); for (const x of data.marks) m.set(x.student_id + '|' + x.day, x.status); return m; }, [data]);
  if (!data.students.length) return <Empty title="No students in this class" />;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-[22px] font-bold">{data.label} · {data.class.name}</h2><button className="btn btn-plain btn-sm no-print" onClick={() => print()}><IPrint size={18} /> Print</button></div>
      <div className="overflow-x-auto rounded-key border-2 border-ink bg-card">
        <table className="w-full border-collapse text-[13px]">
          <thead><tr><th className="sticky left-0 z-10 bg-sunk px-2 py-2 text-left">Student</th>{days.map((d, i) => <th key={d} className={`min-w-[26px] bg-sunk px-0.5 py-2 text-center ${new Date(d).getUTCDay() === 6 ? 'text-pumpkin-ink' : ''}`}>{i + 1}</th>)}<th className="bg-sunk px-2">%</th></tr></thead>
          <tbody>{data.students.map((s: any) => { let p = 0, t = 0; return (
            <tr key={s.id} className="border-t border-line"><td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1.5 font-bold">{s.roll ? s.roll + '. ' : ''}{s.name}</td>
              {days.map((d) => { const st = map.get(s.id + '|' + d); if (st) { t++; if (st === 'P') p++; } return <td key={d} className="px-0.5 text-center"><span className={`inline-block h-5 w-5 rounded-[5px] text-[11px] font-bold leading-5 ${st === 'P' ? 'bg-sage' : st === 'A' ? 'bg-absent text-chalk' : st === 'L' ? 'bg-sun' : new Date(d).getUTCDay() === 6 ? 'bg-sunk' : ''}`} title={st || ''}>{st && st !== 'P' ? st : ''}</span></td>; })}
              <td className="num px-2 text-right font-bold">{t ? Math.round((p / t) * 100) : '-'}</td></tr>); })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-[13px] text-ink-soft">Columns are days of the Bikram Sambat month. Saturday columns are shaded. Green present, A absent, L leave.</p>
    </div>
  );
}
