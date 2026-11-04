import { useEffect, useState } from 'react';
import { Link, navigate, useLocation } from '../lib/router';
import { api, errorText } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, homeFor } from '../lib/auth';
import { Logo, SkeletonRows, ErrorBox, Stat, useToast } from '../components/ui';
import { IOut, ISearch } from '../components/Icons';

const T = [['', 'Overview'], ['schools', 'Schools'], ['users', 'People'], ['audit', 'Audit trail']];
export default function Admin() {
  const { user, loading, logout } = useAuth(); const { path } = useLocation(); const seg = path.split('/')[2] || '';
  useEffect(() => { if (!loading && (!user || user.role !== 'admin')) navigate(user ? homeFor(user.role) : '/login', { replace: true }); }, [user, loading]);
  if (loading || !user || user.role !== 'admin') return <div className="wrap py-10"><SkeletonRows n={5} /></div>;
  return (
    <div className="min-h-screen pb-16">
      <header className="border-b-2 border-ink bg-ink text-chalk"><div className="wrap flex items-center justify-between py-4"><div className="flex items-center gap-3"><span className="rounded-[12px] bg-chalk px-2 py-1 text-ink"><Logo small /></span><span className="font-display text-[18px] font-bold">Platform admin</span></div>
        <button className="btn btn-sm border-chalk bg-transparent text-chalk" onClick={async () => { await logout(); navigate('/'); }}><IOut size={18} /> Sign out</button></div></header>
      <div className="wrap pt-6">
        <nav className="binder" aria-label="Admin sections">{T.map(([k, t]) => <Link key={k} to={'/admin' + (k ? '/' + k : '')} aria-current={seg === k ? 'page' : undefined}>{t}</Link>)}</nav>
        <main className="binder-panel page-enter p-4 sm:p-6" key={seg}>{seg === 'schools' ? <Schools /> : seg === 'users' ? <Users /> : seg === 'audit' ? <Audit /> : <Overview />}</main>
      </div>
    </div>
  );
}
function Overview() {
  const toast = useToast(); const { data, error, reload } = useApi<any>('/admin/overview');
  if (error) return <ErrorBox text={error} retry={reload} />; if (!data) return <SkeletonRows n={3} />;
  return (<div><h1 className="text-[32px] font-extrabold">Overview</h1><p className="text-ink-soft">Real accounts only; the demo school is counted separately.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Schools" value={data.schools} sub={`${data.pro} on Pro`} tone="sun" /><Stat label="Active students" value={data.students} tone="sage" /><Stat label="Parents" value={data.parents} /><Stat label="Staff" value={data.staff} sub={`${data.notices} notices posted`} tone="pumpkin" /></div>
    <div className="mt-6 flex items-center gap-3"><button className="btn btn-plain btn-sm" onClick={async () => { try { await api('/admin/demo-reset', { method: 'POST' }); toast('Demo school reset'); reload(true); } catch (e) { toast(errorText(e), 'err'); } }}>Reset demo school now</button><span className="text-[14px] text-ink-soft">Demo schools: {data.demo_schools}</span></div></div>);
}
function Schools() {
  const toast = useToast(); const { data, error, reload } = useApi<any>('/admin/schools');
  const set = async (s: any, patch: any) => { try { await api(`/admin/schools/${s.id}`, { method: 'PUT', body: { plan: s.plan, disabled: !!s.disabled, ...patch } }); toast('Saved'); reload(true); } catch (e) { toast(errorText(e), 'err'); } };
  if (error) return <ErrorBox text={error} retry={reload} />; if (!data) return <SkeletonRows n={5} />;
  return (<div><h1 className="text-[32px] font-extrabold">Schools</h1><p className="text-ink-soft">Pro is switched on by hand after a written agreement. No card is charged here.</p>
    <div className="mt-4 overflow-x-auto"><table className="table-x"><thead><tr><th>School</th><th>Office login</th><th>Students</th><th>Plan</th><th>Status</th></tr></thead>
      <tbody>{data.schools.map((s: any) => <tr key={s.id}><td className="font-bold">{s.name}{s.is_demo ? <span className="chip ml-2 bg-sun-soft">demo</span> : null}</td><td>{s.owner}</td><td className="num">{s.students}</td>
        <td><select className="field !min-h-0 !w-auto !py-1" value={s.plan} onChange={(e) => set(s, { plan: e.target.value })} aria-label={`Plan for ${s.name}`}><option value="free">Free</option><option value="pro">Pro</option></select></td>
        <td><button className={`btn btn-sm ${s.disabled ? 'btn-danger' : 'btn-plain'}`} onClick={() => set(s, { disabled: !s.disabled })}>{s.disabled ? 'Paused · resume' : 'Active · pause'}</button></td></tr>)}</tbody></table></div></div>);
}
function Users() {
  const toast = useToast(); const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  useEffect(() => { const t = setTimeout(() => setQq(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, error, reload } = useApi<any>(`/admin/users?q=${encodeURIComponent(qq)}`);
  const toggle = async (u: any) => { try { await api(`/admin/users/${u.id}`, { method: 'PUT', body: { disabled: !u.disabled } }); toast('Saved'); reload(true); } catch (e) { toast(errorText(e), 'err'); } };
  return (<div><h1 className="text-[32px] font-extrabold">People</h1>
    <label className="relative mt-3 block max-w-sm"><span className="sr-only">Search</span><ISearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2" /><input className="field !pl-10" placeholder="Search email or name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
    {error ? <ErrorBox text={error} retry={reload} /> : !data ? <SkeletonRows n={6} /> : <div className="mt-4 overflow-x-auto"><table className="table-x"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
      <tbody>{data.users.map((u: any) => <tr key={u.id}><td className="font-bold">{u.name}{u.is_demo ? <span className="chip ml-2 bg-sun-soft">demo</span> : null}</td><td>{u.email}</td><td>{u.role}</td><td>{u.role !== 'admin' && <button className="btn btn-plain btn-sm" onClick={() => toggle(u)}>{u.disabled ? 'Enable' : 'Disable'}</button>}</td></tr>)}</tbody></table></div>}</div>);
}
function Audit() {
  const { data, error, reload } = useApi<any>('/admin/audit');
  if (error) return <ErrorBox text={error} retry={reload} />; if (!data) return <SkeletonRows n={8} />;
  return (<div><h1 className="text-[32px] font-extrabold">Audit trail</h1><ol className="mt-4 space-y-1.5">{data.audit.map((a: any) => <li key={a.id} className="flex flex-wrap gap-x-3 rounded-key bg-sunk px-3 py-2 text-[14px]"><span className="num text-ink-soft">{new Date(a.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}</span><b>{a.action}</b><span>{a.actor_email || 'system'}</span><span className="text-ink-soft">{a.target} {a.detail}</span></li>)}</ol></div>);
}
