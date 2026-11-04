import { useEffect, useState, type FormEvent } from 'react';
import { Link } from '../lib/router';
import { api, errorText } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { rs, bsDate, ago, waLink } from '../lib/format';
import { Field, SkeletonRows, Empty, ErrorBox, Modal, Stat, useToast } from '../components/ui';
import { IPlus, IChat, IPrint, IPin, IBell, IReport } from '../components/Icons';
import { ktmTodayIso, bsYmOf, addBsMonths, bsYmLabel, dueReminder, PAY_LABEL, gradeOf } from '../../shared/school';
import { PageHead, ClassPicker, ChargeModal, PaymentModal, type SchoolInfo } from './Office';

export function Fees({ info }: { info: SchoolInfo }) {
  const toast = useToast(); const cur = bsYmOf(ktmTodayIso())!;
  const [month, setMonth] = useState(cur); const { data, error, reload } = useApi<any>(`/fees?month=${month}`);
  const [gen, setGen] = useState(false); const [charge, setCharge] = useState(false); const [pay, setPay] = useState<any>(null); const [busy, setBusy] = useState(false); const [cls, setCls] = useState(''); const [lang, setLang] = useState<'ne' | 'en'>('ne');
  const generate = async () => { setBusy(true); try { const r = await api('/fees/generate', { body: { month, ...(cls ? { class_id: Number(cls) } : {}) } }); toast(r.created ? `${r.created} monthly fees added for ${bsYmLabel(month)}` : 'Everyone already has this month’s fee'); setGen(false); reload(true); } catch (e) { toast(errorText(e), 'err'); } finally { setBusy(false); } };
  const months = [addBsMonths(cur, -3), addBsMonths(cur, -2), addBsMonths(cur, -1), cur, addBsMonths(cur, 1)];
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <SkeletonRows n={8} />;
  const pct = data.billed ? Math.min(100, Math.round((data.collected / data.billed) * 100)) : 0;
  return (
    <div>
      <PageHead title="Fees" sub={`${data.label} · receipts are numbered by the Bikram Sambat year`}>
        <button className="btn btn-primary btn-sm" onClick={() => setGen(true)}><IPlus size={18} /> Monthly fees</button>
        <button className="btn btn-plain btn-sm" onClick={() => setCharge(true)}>Charge a class</button>
      </PageHead>
      <div className="no-print mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Month">
        {months.map((m) => <button key={m} role="tab" aria-selected={m === month} onClick={() => setMonth(m)} className={`flex-none rounded-key border-2 border-ink px-3 py-2 font-display font-bold ${m === month ? 'bg-ink text-chalk' : 'bg-card hover:bg-sunk'}`}>{bsYmLabel(m)}</button>)}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label={`Billed for ${data.label}`} value={rs(data.billed)} sub={`${data.tuition_generated} monthly fees`} tone="sun" />
        <Stat label="Collected in this month" value={rs(data.collected)} sub={`${data.receipts} receipts`} tone="sage" />
        <div className="tag p-4"><div className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">Collection</div>
          <div className="num mt-1 font-display text-[30px] font-extrabold leading-none">{pct}%</div>
          <div className="mt-3 h-4 overflow-hidden rounded-pill border-2 border-ink bg-sunk"><div className="h-full rounded-pill bg-teal transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} /></div></div>
      </div>
      {data.tuition_generated === 0 && <div className="mt-4 rounded-key border-2 border-dashed border-ink bg-sun-soft px-4 py-3"><b>{data.label} fees are not generated yet.</b> <button className="ml-1 font-bold underline" onClick={() => setGen(true)}>Generate now</button></div>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[22px] font-bold">Who owes ({data.dues.length})</h2>
            <label className="flex items-center gap-2 text-[14px] font-bold">Reminder in <select className="field !min-h-0 !w-auto !py-1" value={lang} onChange={(e) => setLang(e.target.value as any)}><option value="ne">नेपाली</option><option value="en">English</option></select></label></div>
          {data.dues.length === 0 ? <div className="mt-3"><Empty title="Nobody owes anything">Every active student is clear.</Empty></div> : (
            <ul className="mt-3 divide-y divide-line rounded-key border-2 border-ink bg-card">{data.dues.map((d: any) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0"><Link to={`/app/students/${d.id}`} className="font-bold hover:underline">{d.name}</Link><div className="text-[13px] text-ink-soft">{d.class_name}{d.first_month ? ` · billed since ${bsYmLabel(d.first_month)}` : ''}</div></div>
                <div className="flex items-center gap-2"><b className="num text-absent">{rs(d.due)}</b>
                  {d.guardian_phone ? <a className="btn btn-plain btn-sm !px-2" target="_blank" rel="noopener" aria-label={`WhatsApp reminder to ${d.guardian_name || 'guardian'}`} href={waLink(d.guardian_phone, dueReminder({ school: data.school.name, student: d.name, className: d.class_name, amount: d.due, lang }))}><IChat size={18} /></a> : null}
                  <button className="btn btn-primary btn-sm" onClick={() => setPay(d)}>Take payment</button></div>
              </li>))}</ul>)}
        </section>
        <section>
          <h2 className="text-[22px] font-bold">Latest receipts</h2>
          {data.recent.length === 0 ? <p className="mt-2 text-ink-soft">No receipts yet.</p> : (
            <ul className="mt-3 space-y-2">{data.recent.map((p: any) => (
              <li key={p.id} className={`flex items-center justify-between gap-2 rounded-key bg-sunk px-3 py-2 ${p.voided ? 'opacity-50 line-through' : ''}`}>
                <div className="min-w-0"><div className="truncate font-bold">{p.name}</div><div className="text-[13px] text-ink-soft"><span className="num">{p.receipt_no}</span> · {PAY_LABEL[p.method]} · {bsDate(p.paid_on)}</div></div>
                <div className="flex items-center gap-1.5"><b className="num">{rs(p.amount)}</b>{!p.voided && <Link to={`/receipt/${p.id}`} className="btn btn-plain btn-sm !px-2" aria-label="Print receipt"><IPrint size={17} /></Link>}</div>
              </li>))}</ul>)}
        </section>
      </div>
      <Modal open={gen} onClose={() => setGen(false)} title={`Monthly fees for ${bsYmLabel(month)}`}>
        <p>Adds each class’s monthly fee to every active student. Students who already have this month’s fee are skipped, so pressing twice never bills twice.</p>
        <div className="mt-3"><label className="label" htmlFor="gc">Which classes</label><ClassPicker id="gc" classes={info.classes} value={cls} onChange={setCls} all /></div>
        <ul className="mt-3 space-y-1 text-[14px]">{info.classes.filter((c) => !cls || String(c.id) === cls).map((c) => <li key={c.id} className="flex justify-between"><span>{c.name} · {c.students} students</span><b className="num">{c.monthly_fee ? rs(c.monthly_fee) : 'no fee set'}</b></li>)}</ul>
        <button className="btn btn-primary mt-4 w-full" onClick={generate} disabled={busy}>{busy ? 'Adding…' : 'Add monthly fees'}</button>
      </Modal>
      <ChargeModal open={charge} onClose={() => setCharge(false)} classes={info.classes} done={() => reload(true)} />
      <PaymentModal open={!!pay} onClose={() => setPay(null)} student={pay} due={pay?.due || 0} done={() => reload(true)} />
    </div>
  );
}

export function Notices({ info }: { info: SchoolInfo }) {
  const toast = useToast(); const { user } = useAuth(); const owner = info.role === 'owner';
  const { data, error, reload } = useApi<any>('/notices');
  const [open, setOpen] = useState(false); const [f, setF] = useState({ title: '', body: '', class_id: '', pinned: false }); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const post = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(null);
    try { await api('/notices', { body: { ...f, class_id: f.class_id ? Number(f.class_id) : null } }); toast('Notice posted'); setOpen(false); setF({ title: '', body: '', class_id: '', pinned: false }); reload(true); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); } };
  const del = async (n: any) => { if (!confirm(`Delete “${n.title}”?`)) return; try { await api(`/notices/${n.id}`, { method: 'DELETE' }); toast('Deleted'); reload(true); } catch (e) { toast(errorText(e), 'err'); } };
  return (
    <div>
      <PageHead title="Notices" sub="Parents see them in their app. You see who opened each one."><button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><IBell size={18} /> New notice</button></PageHead>
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <SkeletonRows n={5} /> : data.notices.length === 0 ? <Empty title="No notices yet" action={<button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Post the first one</button>}>Holidays, exam routines, meetings: post once and every guardian sees it.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">{data.notices.map((n: any) => (
          <article key={n.id} className="fade-up tag relative p-4">
            {n.pinned ? <span className="absolute -top-3 right-4 grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-pumpkin" title="Pinned"><IPin size={16} /></span> : null}
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold"><span className="chip bg-sunk">{n.class_name || 'Whole school'}</span><span className="text-ink-soft">{ago(n.created_at)} · {n.author}</span></div>
            <h2 className="mt-2 text-[22px] font-bold">{n.title}</h2>
            <p className="mt-1 whitespace-pre-line text-[15px]">{n.body}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><div className="h-2.5 w-28 overflow-hidden rounded-pill border border-ink bg-sunk"><div className="h-full bg-teal" style={{ width: `${n.audience ? (n.reads / n.audience) * 100 : 0}%` }} /></div><span className="text-[13px] font-bold">{n.reads} of {n.audience} guardians opened</span></div>
              {(owner || n.created_by === user?.id) && <button className="btn btn-plain btn-sm" onClick={() => del(n)}>Delete</button>}
            </div>
          </article>))}</div>)}
      <Modal open={open} onClose={() => setOpen(false)} title="New notice">
        <form onSubmit={post} className="space-y-3" noValidate>
          <Field label="Send to" id="nc"><ClassPicker id="nc" classes={info.classes} value={f.class_id} onChange={(v) => setF({ ...f, class_id: v })} all /></Field>
          <Field label="Title" id="nt"><input id="nt" className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Dashain holiday" /></Field>
          <Field label="Message" id="nb" hint="Nepali or English, both work."><textarea id="nb" className="field min-h-[130px]" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          {owner && <label className="flex items-center gap-2 text-[15px] font-bold"><input type="checkbox" className="h-4 w-4 accent-[#233D4D]" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Pin to the top</label>}
          {err && <p className="font-bold text-absent" role="alert">{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Posting…' : 'Post notice'}</button>
        </form>
      </Modal>
    </div>
  );
}

export function Results({ info }: { info: SchoolInfo }) {
  const toast = useToast(); const owner = info.role === 'owner';
  const ex = useApi<any>('/exams');
  const [examId, setExamId] = useState(''); const [cls, setCls] = useState(String(info.classes[0]?.id || ''));
  useEffect(() => { if (ex.data && !examId && ex.data.exams[0]) setExamId(String(ex.data.exams[0].id)); }, [ex.data]);
  const grid = useApi<any>(examId && cls ? `/exams/${examId}/marks?class=${cls}` : null);
  const [vals, setVals] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [bad, setBad] = useState<string | null>(null);
  const [newExam, setNewExam] = useState(false); const [ef, setEf] = useState({ name: '', held_on: ktmTodayIso() }); const [sub, setSub] = useState({ name: '', full_marks: '100' });
  useEffect(() => { if (grid.data) { setVals(Object.fromEntries(grid.data.marks.map((m: any) => [m.student_id + '|' + m.subject_id, m.marks === null ? '' : String(m.marks)]))); setBad(null); } }, [grid.data]);
  const save = async () => {
    if (!grid.data) return; setBusy(true); setBad(null);
    const rows = grid.data.students.flatMap((s: any) => grid.data.subjects.map((sb: any) => ({ student_id: s.id, subject_id: sb.id, marks: vals[s.id + '|' + sb.id] ?? '' })));
    try { await api(`/exams/${examId}/marks`, { method: 'PUT', body: { class_id: Number(cls), rows } }); toast('Marks saved'); grid.reload(true); }
    catch (e: any) { if (e?.data?.student_id) setBad(e.data.student_id + '|' + e.data.subject_id); toast(errorText(e), 'err'); } finally { setBusy(false); } };
  const addExam = async (e: FormEvent) => { e.preventDefault(); try { const r = await api('/exams', { body: ef }); toast('Exam added'); setNewExam(false); await ex.reload(true); setExamId(String(r.id)); } catch (e) { toast(errorText(e), 'err'); } };
  const addSub = async (e: FormEvent) => { e.preventDefault(); try { await api('/subjects', { body: { class_id: Number(cls), name: sub.name, full_marks: Number(sub.full_marks) } }); setSub({ name: '', full_marks: '100' }); grid.reload(true); ex.reload(true); } catch (e) { toast(errorText(e), 'err'); } };
  const delSub = async (sb: any) => { if (!confirm(`Remove ${sb.name} and its marks for this class?`)) return; try { await api(`/subjects/${sb.id}`, { method: 'DELETE' }); grid.reload(true); } catch (e) { toast(errorText(e), 'err'); } };
  const publish = async (p: boolean) => { try { await api(`/exams/${examId}/publish`, { body: { published: p } }); toast(p ? 'Published to parents' : 'Hidden from parents'); ex.reload(true); grid.reload(true); } catch (e) { toast(errorText(e), 'err'); } };
  if (!info.classes.length) return <Empty title="No classes yet">Add classes in the School tab first.</Empty>;
  const exam = ex.data?.exams.find((x: any) => String(x.id) === examId);
  return (
    <div>
      <PageHead title="Results" sub="Marks per subject, letter grades worked out for you.">
        {owner && <button className="btn btn-plain btn-sm" onClick={() => setNewExam(true)}><IPlus size={18} /> New exam</button>}
        {owner && exam && <button className={`btn btn-sm ${exam.published ? 'btn-plain' : 'btn-ink'}`} onClick={() => publish(!exam.published)}>{exam.published ? 'Hide from parents' : 'Publish to parents'}</button>}
      </PageHead>
      {ex.error ? <ErrorBox text={ex.error} retry={ex.reload} /> : !ex.data ? <SkeletonRows n={6} /> : ex.data.exams.length === 0 ? <Empty title="No exams yet" action={owner ? <button className="btn btn-primary btn-sm" onClick={() => setNewExam(true)}>Add an exam</button> : null}>Create “First Terminal Exam”, add subjects for each class, then teachers enter marks.</Empty> : (
        <>
          <div className="no-print mb-4 flex flex-wrap items-center gap-2">
            <select className="field !w-auto" value={examId} onChange={(e) => setExamId(e.target.value)} aria-label="Exam">{ex.data.exams.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <ClassPicker classes={info.classes} value={cls} onChange={setCls} />
            {exam && <span className={`chip ${exam.published ? 'bg-sage-soft' : 'bg-sunk'}`}>{exam.published ? 'Parents can see it' : 'Draft, parents cannot see it'}</span>}
          </div>
          {grid.error ? <ErrorBox text={grid.error} retry={grid.reload} /> : !grid.data ? <SkeletonRows n={8} /> : (
            <>
              {grid.data.subjects.length === 0 ? <Empty title="No subjects for this class">{owner ? 'Add the subjects below.' : 'Ask the office to add subjects.'}</Empty> : grid.data.students.length === 0 ? <Empty title="No students in this class" /> : (
                <div className="overflow-x-auto rounded-key border-2 border-ink bg-card">
                  <table className="table-x min-w-[640px]"><thead><tr><th>Student</th>{grid.data.subjects.map((sb: any) => <th key={sb.id} className="text-center">{sb.name}<div className="text-[11px] normal-case tracking-normal">of {sb.full_marks}</div></th>)}<th className="text-center">GPA</th><th></th></tr></thead>
                    <tbody>{grid.data.students.map((s: any) => {
                      const gs = grid.data.subjects.map((sb: any) => { const v = vals[s.id + '|' + sb.id]; return v === '' || v === undefined ? null : gradeOf(Number(v), sb.full_marks); });
                      const all = gs.every((g: any) => g); const gpa = all ? (gs.reduce((a: number, g: any) => a + g.gpa, 0) / gs.length).toFixed(2) : '-';
                      return (<tr key={s.id}><td className="whitespace-nowrap font-bold">{s.roll ? s.roll + '. ' : ''}{s.name}</td>
                        {grid.data.subjects.map((sb: any, k: number) => { const key = s.id + '|' + sb.id; return (
                          <td key={sb.id} className="text-center"><input aria-label={`${s.name} ${sb.name}`} inputMode="decimal" className={`field num !min-h-[38px] w-[68px] !px-2 !py-1 text-center ${bad === key || (vals[key] && (Number(vals[key]) > sb.full_marks || Number(vals[key]) < 0 || isNaN(Number(vals[key])))) ? '!border-absent !bg-pumpkin-soft' : ''}`} value={vals[key] ?? ''} onChange={(e) => setVals({ ...vals, [key]: e.target.value })} />
                            <div className="text-[11px] font-bold text-ink-soft">{gs[k]?.grade || ''}</div></td>); })}
                        <td className="num text-center font-display text-[18px] font-bold">{gpa}</td>
                        <td>{all && <Link to={`/report/${examId}/${s.id}`} className="btn btn-plain btn-sm !px-2" aria-label={`Report card for ${s.name}`}><IReport size={18} /></Link>}</td></tr>); })}</tbody></table>
                </div>)}
              {grid.data.subjects.length > 0 && grid.data.students.length > 0 && <div className="mt-3 flex justify-end"><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save marks'}</button></div>}
              {owner && (
                <div className="tag mt-6 p-4"><h2 className="text-[20px] font-bold">Subjects for {grid.data.class.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">{grid.data.subjects.map((sb: any) => <span key={sb.id} className="chip bg-sunk">{sb.name} · {sb.full_marks}<button className="ml-1 font-bold" aria-label={`Remove ${sb.name}`} onClick={() => delSub(sb)}>×</button></span>)}</div>
                  <form onSubmit={addSub} className="mt-3 flex flex-wrap items-end gap-2"><Field label="Subject" id="sbn"><input id="sbn" className="field" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} placeholder="Computer" /></Field>
                    <Field label="Full marks" id="sbf"><input id="sbf" className="field !w-28" inputMode="numeric" value={sub.full_marks} onChange={(e) => setSub({ ...sub, full_marks: e.target.value })} /></Field><button className="btn btn-plain">Add subject</button></form></div>)}
            </>)}
        </>)}
      <Modal open={newExam} onClose={() => setNewExam(false)} title="New exam">
        <form onSubmit={addExam} className="space-y-3"><Field label="Name" id="en"><input id="en" className="field" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} placeholder="Second Terminal Exam" /></Field>
          <Field label="Held on (AD)" id="eh" hint={bsDate(ef.held_on)}><input id="eh" type="date" className="field" value={ef.held_on} onChange={(e) => setEf({ ...ef, held_on: e.target.value })} /></Field><button className="btn btn-primary w-full">Add exam</button></form>
      </Modal>
    </div>
  );
}

export function Settings({ info, reload }: { info: SchoolInfo; reload: () => void }) {
  const toast = useToast(); const owner = info.role === 'owner'; const { user, refresh } = useAuth();
  const [s, setS] = useState({ name: info.school.name, address: info.school.address, phone: info.school.phone, pan: info.school.pan });
  const [c, setC] = useState({ name: '', monthly_fee: '' }); const [editC, setEditC] = useState<any>(null);
  const staff = useApi<any>(owner ? '/staff' : null); const [t, setT] = useState({ name: '', email: '' }); const [temp, setTemp] = useState<string | null>(null);
  const [me, setMe] = useState({ name: user?.name || '', phone: user?.phone || '' }); const [pw, setPw] = useState({ current: '', next: '' });
  const run = async (fn: () => Promise<any>, ok: string) => { try { await fn(); toast(ok); } catch (e) { toast(errorText(e), 'err'); } };
  return (
    <div className="space-y-8">
      <PageHead title={owner ? 'School' : 'My account'} sub={owner ? `Plan: ${info.school.plan === 'pro' ? 'Basta Pro' : 'Basta Free'} · ${info.students} of ${info.limit} students` : undefined} />
      {owner && <section className="grid gap-6 lg:grid-cols-2">
        <form className="tag space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/school', { method: 'PUT', body: s }); reload(); }, 'School details saved'); }}>
          <h2 className="text-[22px] font-bold">School details</h2><p className="text-[14px] text-ink-soft">Printed on receipts and report cards.</p>
          <Field label="Name" id="ssn"><input id="ssn" className="field" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Address" id="ssa"><input id="ssa" className="field" value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Phone" id="ssp"><input id="ssp" className="field" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field><Field label="PAN (optional)" id="sspan"><input id="sspan" className="field" inputMode="numeric" value={s.pan} onChange={(e) => setS({ ...s, pan: e.target.value })} /></Field></div>
          <button className="btn btn-primary">Save</button>
        </form>
        <div className="tag p-4"><h2 className="text-[22px] font-bold">Classes and monthly fees</h2>
          <ul className="mt-3 divide-y divide-line">{info.classes.map((k) => <li key={k.id} className="flex items-center justify-between gap-2 py-2"><span><b>{k.name}</b> <span className="text-[13px] text-ink-soft">{k.students} students</span></span><span className="flex items-center gap-2"><b className="num">{rs(k.monthly_fee)}</b><button className="btn btn-plain btn-sm" onClick={() => setEditC({ ...k, monthly_fee: String(k.monthly_fee / 100) })}>Edit</button></span></li>)}
            {!info.classes.length && <li className="py-2 text-ink-soft">No classes yet. Add your first below.</li>}</ul>
          <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/classes', { body: c }); setC({ name: '', monthly_fee: '' }); reload(); }, 'Class added'); }}>
            <Field label="Class" id="cn"><input id="cn" className="field !w-36" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Grade 6" /></Field>
            <Field label="Monthly fee (Rs)" id="cf"><input id="cf" className="field !w-36" inputMode="decimal" value={c.monthly_fee} onChange={(e) => setC({ ...c, monthly_fee: e.target.value })} /></Field>
            <button className="btn btn-plain"><IPlus size={18} /> Add</button></form></div>
      </section>}
      {owner && <section className="tag p-4"><h2 className="text-[22px] font-bold">Teachers</h2><p className="text-[14px] text-ink-soft">Teachers mark attendance, post class notices and enter marks. They never see fees.</p>
        {staff.error ? <ErrorBox text={staff.error} /> : !staff.data ? <SkeletonRows n={2} /> : <ul className="mt-3 divide-y divide-line">{staff.data.staff.map((m: any) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{m.name}</b> <span className="text-[13px] text-ink-soft">{m.email} · {m.role === 'owner' ? 'Office' : 'Teacher'}</span></span>{m.role === 'teacher' && <button className="btn btn-plain btn-sm" onClick={() => confirm(`Remove ${m.name}?`) && run(async () => { await api(`/staff/${m.id}`, { method: 'DELETE' }); staff.reload(true); }, 'Teacher removed')}>Remove</button>}</li>)}</ul>}
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/staff', { body: t }); setTemp(r.temp_password); setT({ name: '', email: '' }); staff.reload(true); }, 'Teacher account made'); }}>
          <Field label="Teacher name" id="tn"><input id="tn" className="field" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field>
          <Field label="Email" id="te"><input id="te" className="field" type="email" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} /></Field><button className="btn btn-plain"><IPlus size={18} /> Add teacher</button></form>
        {temp && <div className="mt-3 rounded-key border-2 border-ink bg-sun-soft px-4 py-3">First password (shown once, ask them to change it): <b className="num font-mono text-[18px]">{temp}</b></div>}
      </section>}
      <section className="grid gap-6 lg:grid-cols-2">
        <form className="tag space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/me', { method: 'PUT', body: me }); await refresh(); }, 'Profile saved'); }}>
          <h2 className="text-[22px] font-bold">Your profile</h2>
          <Field label="Name" id="mn"><input id="mn" className="field" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} /></Field>
          <Field label="Mobile" id="mp"><input id="mp" className="field" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} /></Field><button className="btn btn-plain">Save profile</button></form>
        <form className="tag space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/me/password', { body: pw }); setPw({ current: '', next: '' }); }, 'Password changed'); }}>
          <h2 className="text-[22px] font-bold">Password</h2>
          <Field label="Current password" id="pc"><input id="pc" type="password" autoComplete="current-password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New password" id="pn2" hint="8+ characters with a letter and a number."><input id="pn2" type="password" autoComplete="new-password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field><button className="btn btn-plain">Change password</button></form>
      </section>
      <Modal open={!!editC} onClose={() => setEditC(null)} title={`Edit ${editC?.name || ''}`}>
        {editC && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api(`/classes/${editC.id}`, { method: 'PUT', body: { name: editC.name, monthly_fee: editC.monthly_fee } }); setEditC(null); reload(); }, 'Class saved'); }}>
          <Field label="Class name" id="ecn"><input id="ecn" className="field" value={editC.name} onChange={(e) => setEditC({ ...editC, name: e.target.value })} /></Field>
          <Field label="Monthly fee (Rs)" id="ecf" hint="Applies to fees generated from now on."><input id="ecf" className="field" value={editC.monthly_fee} onChange={(e) => setEditC({ ...editC, monthly_fee: e.target.value })} /></Field>
          <div className="flex gap-2"><button className="btn btn-primary flex-1">Save</button>{editC.students === 0 && <button type="button" className="btn btn-danger" onClick={() => run(async () => { await api(`/classes/${editC.id}`, { method: 'DELETE' }); setEditC(null); reload(); }, 'Class deleted')}>Delete</button>}</div></form>}
      </Modal>
    </div>
  );
}
