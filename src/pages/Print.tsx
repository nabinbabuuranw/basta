import { Link } from '../lib/router';
import { useApi } from '../lib/useApi';
import { useAuth, homeFor } from '../lib/auth';
import { rs, bsDate } from '../lib/format';
import { SkeletonRows, ErrorBox, Logo } from '../components/ui';
import { IPrint, IBack } from '../components/Icons';
import { PAY_LABEL, bsYmLabel, GRADE_BANDS } from '../../shared/school';

function Bar({ back }: { back: string }) {
  return <div className="no-print wrap flex items-center justify-between py-4"><Link to={back} className="btn btn-plain btn-sm"><IBack size={18} /> Back</Link><button className="btn btn-primary btn-sm" onClick={() => print()}><IPrint size={18} /> Print</button></div>;
}
export function Receipt({ id }: { id: number }) {
  const { user } = useAuth(); const { data, error, reload } = useApi<any>(`/receipts/${id}`);
  const back = user?.role === 'parent' ? '/family' : '/app/fees';
  return (
    <div className="min-h-screen pb-10"><Bar back={back} />
      <main className="wrap max-w-[720px]">
        {error ? <ErrorBox text={error} retry={reload} /> : !data ? <SkeletonRows n={6} /> : (() => { const r = data.receipt; return (
          <article className="sticker print-sheet p-7"><div className="relative">
            {r.is_demo ? <div className="mb-3 rounded-key bg-sun px-3 py-1 text-center text-[13px] font-bold">Demo receipt · not a real payment</div> : null}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="font-display text-[26px] font-extrabold leading-tight">{r.school}</div><div className="text-[14px] text-ink-soft">{r.address}{r.school_phone ? ` · ${r.school_phone}` : ''}{r.pan ? ` · PAN ${r.pan}` : ''}</div></div>
              <div className="text-right"><div className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Fee receipt</div><div className="num font-display text-[24px] font-extrabold">{r.receipt_no}</div><div className="text-[14px]">{bsDate(r.paid_on)} <span className="text-ink-soft">({r.paid_on})</span></div></div>
            </div>
            <div className="sticker-line my-5" />
            <dl className="grid grid-cols-2 gap-4 text-[16px]"><div><dt className="text-[13px] text-ink-soft">Received from (student)</dt><dd className="font-bold">{r.student}</dd></div><div><dt className="text-[13px] text-ink-soft">Class · Roll</dt><dd className="font-bold">{r.class_name} · {r.roll ?? '-'}</dd></div>
              <div><dt className="text-[13px] text-ink-soft">Paid by</dt><dd className="font-bold">{PAY_LABEL[r.method]}</dd></div><div><dt className="text-[13px] text-ink-soft">Received by</dt><dd className="font-bold">{r.received_by || '-'}</dd></div></dl>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3 rounded-key border-2 border-ink bg-sun-soft p-4"><div><div className="text-[13px] font-bold uppercase text-ink-soft">Amount</div><div className="num font-display text-[38px] font-extrabold leading-none">{rs(r.amount)}</div><div className="mt-1 text-[14px]">{r.in_words}</div></div>
              <div className="text-right text-[14px]">Balance after this: <b className="num">{rs(Math.max(0, data.balance_after))}</b></div></div>
            {r.note && <p className="mt-3 text-[14px]">Note: {r.note}</p>}
            {r.voided ? <p className="mt-3 font-bold text-absent">This receipt was cancelled.</p> : null}
            <div className="mt-8 flex items-end justify-between text-[13px] text-ink-soft"><span>Issued with Basta. A school fee acknowledgement, not a tax invoice.</span><span className="border-t-2 border-ink/40 px-6 pt-1">Signature</span></div>
          </div></article>); })()}
      </main>
    </div>
  );
}
export function Report({ exam, student }: { exam: number; student: number }) {
  const { user } = useAuth(); const { data, error, reload } = useApi<any>(`/report/${exam}/${student}`);
  const back = user?.role === 'parent' ? `/family/${student}` : '/app/results';
  return (
    <div className="min-h-screen pb-10"><Bar back={user ? back : homeFor()} />
      <main className="wrap max-w-[780px]">
        {error ? <ErrorBox text={error} retry={reload} /> : !data ? <SkeletonRows n={8} /> : (
          <article className="sticker print-sheet p-7"><div className="relative">
            {data.student.is_demo ? <div className="mb-3 rounded-key bg-sun px-3 py-1 text-center text-[13px] font-bold">Demo report card · made-up student</div> : null}
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-display text-[26px] font-extrabold leading-tight">{data.student.school}</div><div className="text-[14px] text-ink-soft">{data.student.address}</div></div><Logo small /></div>
            <h1 className="mt-4 text-[30px] font-extrabold">Progress report · {data.exam.name}</h1><p className="text-ink-soft">Held {bsDate(data.exam.held_on)}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-[15px]"><div><span className="text-[13px] text-ink-soft">Name</span><div className="sticker-line font-bold">{data.student.name}</div></div><div><span className="text-[13px] text-ink-soft">Class</span><div className="sticker-line font-bold">{data.student.class_name}</div></div><div><span className="text-[13px] text-ink-soft">Roll</span><div className="sticker-line font-bold">{data.student.roll ?? '-'}</div></div></div>
            <table className="table-x mt-5"><thead><tr><th>Subject</th><th className="text-right">Full</th><th className="text-right">Obtained</th><th className="text-right">Grade</th><th className="text-right">GP</th></tr></thead>
              <tbody>{data.subjects.map((s: any) => <tr key={s.id}><td>{s.name}</td><td className="num text-right">{s.full_marks}</td><td className="num text-right">{s.marks ?? '-'}</td><td className={`text-right font-bold ${s.grade === 'NG' ? 'text-absent' : ''}`}>{s.grade}</td><td className="num text-right">{s.gpa === null ? '-' : s.gpa.toFixed(1)}</td></tr>)}</tbody>
              <tfoot><tr><td className="pt-2 font-bold">Total</td><td className="num pt-2 text-right">{data.full}</td><td className="num pt-2 text-right font-bold">{data.total}</td><td /><td /></tr></tfoot></table>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-key border-2 border-ink bg-sun-soft p-4"><div className="text-[13px] font-bold uppercase text-ink-soft">GPA</div><div className="num font-display text-[40px] font-extrabold leading-none">{data.overall.gpa === null ? '-' : data.overall.gpa.toFixed(2)}</div><div className="mt-1 font-bold">Overall grade {data.overall.grade}</div>{data.overall.ng && <div className="mt-1 text-[13px] font-bold text-absent">One or more subjects are NG (below 35%).</div>}</div>
              <div className="rounded-key border-2 border-ink bg-card p-4"><div className="text-[13px] font-bold uppercase text-ink-soft">Attendance {bsYmLabel(data.attendance.from)} to {bsYmLabel(data.attendance.to)}</div><div className="num mt-1 font-display text-[28px] font-extrabold">{data.attendance.present} present</div><div className="text-[14px]">{data.attendance.absent} absent · {data.attendance.leave} leave</div></div>
            </div>
            <details className="mt-4 text-[13px] text-ink-soft"><summary className="cursor-pointer font-bold">Grading scale</summary><p className="mt-1">{GRADE_BANDS.map((b) => `${b.grade} ${b.min}%+ (${b.gpa.toFixed(1)})`).join(' · ')}. Letter-grading bands as published by CDC/NEB; check your board’s latest rules for official certificates.</p></details>
            <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[13px] text-ink-soft"><span className="border-t-2 border-ink/40 pt-1">Class teacher</span><span className="border-t-2 border-ink/40 pt-1">Principal</span></div>
          </div></article>)}
      </main>
    </div>
  );
}
