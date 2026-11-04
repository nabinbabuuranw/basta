import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, navigate } from '../lib/router';
import { api, errorText } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';
import { PublicHeader, Footer } from '../components/PublicHeader';
import { Reveal } from '../components/Reveal';
import { useToast, Tally } from '../components/ui';
import { IBell, IRoll, ICoin, IKids, IShield, IChat } from '../components/Icons';
import { GRADE_BANDS, FREE_STUDENT_LIMIT, PRO_STUDENT_LIMIT, PRO_PRICE_NPR } from '../../shared/school';

const CLASS = ['Aarav', 'Aanya', 'Bibek', 'Prakriti', 'Sujal', 'Riya', 'Nischal', 'Samikshya', 'Pranish', 'Sneha', 'Aayush', 'Kritika'];
function RollCallDemo() {
  const [absent, setAbsent] = useState<Set<number>>(new Set([3, 8]));
  const [ring, setRing] = useState(0);
  const toggle = (i: number) => { setAbsent((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; }); setRing((r) => r + 1); };
  const present = CLASS.length - absent.size;
  return (
    <div className="sticker relative p-4 shadow-press sm:p-5" aria-label="Try the roll call">
      <div className="flex items-center justify-between gap-3 px-1">
        <div><div className="eyebrow">Try it · Grade 4, today</div><div className="font-display text-[22px] font-bold">Tap a name to mark absent</div></div>
        <span key={ring} className="bell-swing grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-sun"><IBell /></span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {CLASS.map((n, i) => {
          const a = absent.has(i);
          return (
            <button key={n} onClick={() => toggle(i)} aria-pressed={a}
              className={`rounded-key border-2 border-ink px-2 py-2 text-left transition-[transform,background-color] duration-150 active:translate-y-[2px] ${a ? 'bg-pumpkin-soft' : 'bg-card hover:bg-sunk'}`}>
              <span className="block text-[11px] font-bold text-ink-soft">Roll {i + 1}</span>
              <span className="block truncate font-display text-[16px] font-bold leading-tight">{n}</span>
              <span className={`mt-1 inline-block rounded-pill px-1.5 text-[11px] font-bold ${a ? 'bg-absent text-chalk' : 'bg-sage-soft text-sage-ink'}`}>{a ? 'Absent' : 'Present'}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-key bg-sunk px-3 py-2.5">
        <span className="flex items-center gap-3"><Tally n={present} /><b className="num">{present}/{CLASS.length} present</b></span>
        <span className="text-[14px]">{absent.size ? <>Parents of <b>{absent.size}</b> see “absent today” in their app.</> : 'Full class today.'}</span>
      </div>
      <p className="mt-2 px-1 text-[12px] text-ink-soft">This box runs in your browser only. The demo school below is the real app.</p>
    </div>
  );
}

const DAY = [
  { t: '10:00', icon: IRoll, h: 'Roll call in a minute', p: 'The class teacher taps the absentees on a phone. Everyone else is present by default. Corrections are allowed the same day.' },
  { t: '11:30', icon: ICoin, h: 'A fee at the counter', p: 'The office takes cash, eSewa, Khalti, Fonepay or a bank slip, and Basta numbers the receipt (BS-2083-0042) with the amount in words.' },
  { t: '14:00', icon: IBell, h: 'One notice, the right parents', p: 'Post to the whole school or one class. You see how many guardians actually opened it, so you know who to call.' },
  { t: '17:00', icon: IKids, h: 'Parents check at home', p: 'Guardians sign in with the family code from the school and see attendance, dues, receipts, notices and published report cards.' },
];
const ROLES = {
  office: { label: 'School office', who: 'Principal or accountant', points: ['Monthly fee dues for every class in one tap, never billed twice', 'Receipts, voids with a reason, and an audit trail', 'Who owes what, with a WhatsApp reminder in Nepali or English', 'Teacher accounts that cannot see money'] },
  teacher: { label: 'Class teacher', who: 'Phone in the classroom', points: ['Daily roll call and a month register', 'Marks entry per subject, checked against full marks', 'Class notices with read counts', 'No fee screens, by design'] },
  parent: { label: 'Parent', who: 'Any phone, any network', points: ['Absent or present today, and the month calendar', 'Dues and every receipt the school issued', 'Notices, marked read when opened', 'Report card with letter grades, once the school publishes it'] },
} as const;

function Pricing() {
  const [n, setN] = useState(120);
  const pro = n > FREE_STUDENT_LIMIT;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <label htmlFor="students" className="font-display text-[22px] font-bold">How many students do you have?</label>
        <div className="mt-4 flex items-center gap-4">
          <input id="students" type="range" min={10} max={PRO_STUDENT_LIMIT} step={10} value={n} onChange={(e) => setN(Number(e.target.value))} className="h-2 w-full accent-[#FE7F2D]" />
          <output htmlFor="students" className="num w-20 rounded-key border-2 border-ink bg-card px-2 py-1 text-center font-display text-[22px] font-bold">{n}</output>
        </div>
        <p className="mt-3 text-ink-soft">One price per school, not per student and not per parent. Parents and teachers never pay.</p>
      </div>
      <div className="sticker p-6">
        <div className="relative">
          <div className="eyebrow">{pro ? 'Basta Pro' : 'Basta Free'}</div>
          <div className="num mt-1 font-display text-[52px] font-extrabold leading-none">{pro ? `Rs ${PRO_PRICE_NPR.toLocaleString('en-IN')}` : 'Rs 0'}<span className="text-[18px] font-bold text-ink-soft"> / month</span></div>
          <p className="mt-2">{pro ? `Up to ${PRO_STUDENT_LIMIT} active students, every feature, priority help on WhatsApp.` : `Up to ${FREE_STUDENT_LIMIT} active students with every feature. No card, no trial clock.`}</p>
          <div className="sticker-line my-4" />
          <p className="text-[14px] text-ink-soft">{pro ? 'Pro is switched on by hand after you contact us. There is no online checkout yet, so nothing is charged automatically.' : 'When you pass 60 students, Basta asks before anything changes. Your data stays yours either way.'}</p>
          <Link to="/register" className="btn btn-primary mt-4">Create your school</Link>
        </div>
      </div>
    </div>
  );
}
const FAQ = [
  ['Is Basta approved by the government or a board?', 'No. Basta is a school office tool. It does not file anything with the Ministry, IEMIS or any examination board. The grade bands follow the CDC/NEB letter-grading table (A+ to NG), but check your board’s latest rules before printing official certificates.'],
  ['How do parents get in?', 'Every student has an 8-character family code. Print it on the admission slip or send it by SMS. A parent creates an account with that code and sees only their own child.'],
  ['Can parents pay fees online?', 'Not yet. Basta records payments the school receives (cash, bank, eSewa, Khalti, Fonepay, cheque) and issues the receipt. Online collection needs a payment-provider agreement, which we have not signed.'],
  ['Does it send SMS?', 'No paid SMS. Reminders open WhatsApp with the message ready, so the office sends it from its own phone, for free.'],
  ['Which dates does it use?', 'Bikram Sambat everywhere: fee months, receipts, registers and report cards.'],
  ['What happens to our data?', 'It is stored in one database for your school only. Teachers never see money; parents see only their own child. You can ask us to delete the school at any time.'],
];
export default function Home() {
  const { user } = useAuth(); const toast = useToast(); const [busy, setBusy] = useState<string | null>(null);
  const [role, setRole] = useState<keyof typeof ROLES>('office');
  const dayRef = useRef<HTMLDivElement>(null); const [dp, setDp] = useState(0);
  useEffect(() => {
    const on = () => { const el = dayRef.current; if (!el) return; const r = el.getBoundingClientRect(); const vh = window.innerHeight; setDp(Math.max(0, Math.min(1, (vh * 0.75 - r.top) / (r.height)))); };
    on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on);
  }, []);
  const demo = async (as: 'office' | 'teacher' | 'parent') => {
    setBusy(as);
    try { const r = await api('/auth/demo', { body: { as } }); location.assign(homeFor(r.user.role)); } catch (e) { toast(errorText(e), 'err'); setBusy(null); }
  };
  const bands = useMemo(() => GRADE_BANDS, []);
  return (
    <div className="page-enter">
      <PublicHeader />
      <main id="main">
        <section className="wrap grid items-center gap-10 pb-14 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <div className="fade-up chip bg-sun-soft">For private schools with 30 to 600 students</div>
            <h1 className="fade-up mt-4 text-[44px] font-extrabold sm:text-[60px] lg:text-[72px]" style={{ animationDelay: '60ms' }}>The school office,<br />packed <span className="relative inline-block whitespace-nowrap">in one bag.<svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path className="draw-line" pathLength={1} d="M2 8 C 60 2, 120 11, 180 6 S 270 3, 298 7" stroke="#FE7F2D" strokeWidth="5" fill="none" strokeLinecap="round" /></svg></span></h1>
            <p className="fade-up mt-4 font-display text-[22px] font-semibold text-teal-ink" lang="ne" style={{ animationDelay: '120ms' }}>शुल्क, हाजिरी, सूचना र रिपोर्ट कार्ड, एउटै बस्तामा।</p>
            <p className="fade-up mt-3 max-w-xl text-[18px] text-ink-soft" style={{ animationDelay: '160ms' }}>Basta replaces the fee register, the attendance copy and the notice diary with one app the office, the teachers and the parents each open on their own phone.</p>
            <div className="fade-up mt-6 flex flex-wrap gap-3" style={{ animationDelay: '220ms' }}>
              {user ? <Link to={homeFor(user.role)} className="btn btn-primary">Open my account</Link> : <button className="btn btn-primary" disabled={!!busy} onClick={() => demo('office')}>{busy === 'office' ? 'Opening…' : 'Walk into the demo school'}</button>}
              <Link to="/register" className="btn btn-plain">Create your school, free</Link>
            </div>
            <p className="fade-up mt-3 text-[14px] text-ink-soft" style={{ animationDelay: '260ms' }}>Or see it as <button className="font-bold underline" onClick={() => demo('teacher')} disabled={!!busy}>a teacher</button> or <button className="font-bold underline" onClick={() => demo('parent')} disabled={!!busy}>a parent</button>. No sign-up needed.</p>
          </div>
          <div className="fade-up" style={{ animationDelay: '180ms' }}><RollCallDemo /></div>
        </section>

        <section id="day" className="border-y-2 border-ink bg-sunk py-16">
          <div className="wrap">
            <Reveal><div className="eyebrow">One school day</div><h2 className="mt-2 max-w-2xl text-[36px] font-extrabold sm:text-[48px]">Four bells, four jobs Basta takes off the desk.</h2></Reveal>
            <div ref={dayRef} className="relative mt-10">
              <div className="absolute left-[19px] top-0 h-full w-[4px] rounded bg-line md:left-0 md:top-[19px] md:h-[4px] md:w-full" aria-hidden="true" />
              <div className="absolute left-[19px] top-0 w-[4px] rounded bg-pumpkin md:hidden" style={{ height: `${dp * 100}%` }} aria-hidden="true" />
              <div className="absolute left-0 top-[19px] hidden h-[4px] origin-left rounded bg-pumpkin md:block" style={{ width: `${dp * 100}%` }} aria-hidden="true" />
              <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
                {DAY.map((d, i) => (
                  <Reveal as="li" key={d.t} delay={i * 90} className="relative pl-14 md:pl-0 md:pt-14">
                    <span className={`absolute left-0 top-0 grid h-[42px] w-[42px] place-items-center rounded-full border-2 border-ink transition-colors duration-300 ${dp > i / 4 + 0.05 ? 'bg-sun' : 'bg-card'}`}><d.icon size={20} /></span>
                    <div className="num font-display text-[15px] font-bold text-pumpkin-ink">{d.t}</div>
                    <h3 className="mt-0.5 text-[24px] font-bold">{d.h}</h3>
                    <p className="mt-1.5 text-ink-soft">{d.p}</p>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="who" className="wrap py-16">
          <Reveal><div className="eyebrow">Three logins, one school</div><h2 className="mt-2 max-w-3xl text-[36px] font-extrabold sm:text-[48px]">Everyone sees their part, and only their part.</h2></Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
            <div role="tablist" aria-label="Who uses Basta" className="flex gap-2 overflow-x-auto lg:flex-col">
              {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((k) => (
                <button key={k} role="tab" aria-selected={role === k} onClick={() => setRole(k)}
                  className={`flex-none rounded-tag border-2 border-ink px-4 py-3 text-left transition-[transform,background-color] duration-200 ease-bounce ${role === k ? 'translate-x-0 bg-ink text-chalk lg:translate-x-2' : 'bg-card hover:bg-sunk'}`}>
                  <span className="block font-display text-[20px] font-bold">{ROLES[k].label}</span><span className={`block text-[13px] ${role === k ? 'text-chalk/75' : 'text-ink-soft'}`}>{ROLES[k].who}</span>
                </button>
              ))}
            </div>
            <div key={role} role="tabpanel" className="sticker pop-in grid gap-6 p-6 md:grid-cols-[1fr_1fr]">
              <ul className="relative space-y-3">
                {ROLES[role].points.map((p, i) => <li key={p} className="flex gap-3"><span className="num grid h-7 w-7 flex-none place-items-center rounded-full border-2 border-ink bg-sun font-display text-[14px] font-bold">{i + 1}</span><span className="pt-0.5 text-[17px]">{p}</span></li>)}
              </ul>
              <div className="relative">
                <div className="eyebrow mb-2">What they open</div>
                {role === 'office' && <OfficeSnap />}{role === 'teacher' && <TeacherSnap />}{role === 'parent' && <ParentSnap />}
                <button className="btn btn-ink btn-sm mt-4" onClick={() => demo(role)} disabled={!!busy}>{busy === role ? 'Opening…' : `Open the demo as ${ROLES[role].label.toLowerCase()}`}</button>
              </div>
            </div>
          </div>
        </section>

        <section id="results" className="border-y-2 border-ink bg-teal-soft py-16">
          <div className="wrap grid items-start gap-10 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <div className="eyebrow !text-teal-ink">Report cards</div>
              <h2 className="mt-2 text-[36px] font-extrabold sm:text-[48px]">Marks in, letter grades out.</h2>
              <p className="mt-3 max-w-lg text-[17px]">Teachers type marks per subject; Basta refuses anything above full marks, works out the grade and GPA with the letter-grading bands, and shows attendance for the term. Parents see it only after the office presses publish.</p>
              <table className="table-x mt-6 max-w-md rounded-key bg-card"><thead><tr><th>Percent</th><th>Grade</th><th>GPA</th></tr></thead>
                <tbody>{bands.map((b, i) => <tr key={b.grade}><td className="num">{i === 0 ? '90 to 100' : b.min === 0 ? 'below 35' : `${b.min} to ${bands[i - 1].min}`}</td><td><b>{b.grade}</b></td><td className="num">{b.gpa.toFixed(1)}</td></tr>)}</tbody></table>
            </Reveal>
            <Reveal delay={120}><ReportSpecimen /></Reveal>
          </div>
        </section>

        <section id="price" className="wrap py-16">
          <Reveal><div className="eyebrow">Price</div><h2 className="mt-2 text-[36px] font-extrabold sm:text-[48px]">Free for a small school. One flat fee after that.</h2></Reveal>
          <div className="mt-8"><Pricing /></div>
        </section>

        <section id="faq" className="wrap pb-6">
          <Reveal><h2 className="text-[36px] font-extrabold sm:text-[44px]">Questions schools ask first</h2></Reveal>
          <div className="mt-6 divide-y-2 divide-ink/15 rounded-tag border-2 border-ink bg-card">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[20px] font-bold"><span>{q}</span><span className="grid h-8 w-8 flex-none place-items-center rounded-full border-2 border-ink transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span></summary>
                <p className="mt-2 max-w-3xl text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="wrap mt-14">
          <div className="sticker flex flex-col items-start justify-between gap-5 bg-sun p-7 md:flex-row md:items-center">
            <div className="relative"><h2 className="text-[32px] font-extrabold">Pack your school’s first bag today.</h2><p className="mt-1">Add classes, paste your student list, take tomorrow’s roll call. About 15 minutes.</p></div>
            <div className="relative flex gap-3"><button className="btn btn-plain" onClick={() => demo('office')} disabled={!!busy}>See the demo</button><button className="btn btn-ink" onClick={() => navigate('/register')}>Start free</button></div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
function OfficeSnap() {
  return (
    <div className="tag overflow-hidden text-[14px]">
      <div className="flex items-center justify-between bg-sunk px-3 py-2 font-bold"><span>Who owes fees</span><span className="chip bg-pumpkin-soft">Demo data</span></div>
      {[['Pranish Lama', 'Grade 4', '5,500'], ['Sujal Karki', 'Grade 3', '2,500'], ['Bishal Chaudhary', 'Grade 5', '3,000']].map(([n, c, a]) => (
        <div key={n} className="flex items-center justify-between border-t border-line px-3 py-2"><span><b>{n}</b> <span className="text-ink-soft">{c}</span></span><span className="flex items-center gap-2"><b className="num">Rs {a}</b><IChat size={18} /></span></div>
      ))}
    </div>
  );
}
function TeacherSnap() {
  return (
    <div className="tag p-3 text-[14px]">
      <div className="mb-2 flex justify-between font-bold"><span>Grade 3 · roll call</span><span className="text-sage-ink">Saved</span></div>
      <div className="grid grid-cols-4 gap-1.5">{['P', 'P', 'A', 'P', 'P', 'L', 'P', 'P'].map((s, i) => <span key={i} className={`rounded-[8px] border-2 border-ink py-1 text-center font-bold ${s === 'A' ? 'bg-pumpkin-soft' : s === 'L' ? 'bg-sun-soft' : 'bg-sage-soft'}`}>{i + 1} {s}</span>)}</div>
    </div>
  );
}
function ParentSnap() {
  return (
    <div className="tag p-3 text-[14px]">
      <div className="flex items-center justify-between"><b>Aarav · Grade 3</b><span className="chip bg-sage-soft">Present today</span></div>
      <div className="mt-2 grid grid-cols-7 gap-1">{Array.from({ length: 21 }, (_, i) => <span key={i} className={`h-5 rounded-[5px] border border-ink/40 ${i % 9 === 4 ? 'bg-pumpkin' : i % 7 === 6 ? 'bg-line' : 'bg-sage'}`} />)}</div>
      <div className="mt-2 flex justify-between border-t border-line pt-2"><span>Fees due</span><b className="num">Rs 0</b></div>
    </div>
  );
}
function ReportSpecimen() {
  const rows = [['English', 86], ['Nepali', 78], ['Mathematics', 93], ['Science', 71], ['Social Studies', 64]] as const;
  const g = (m: number) => GRADE_BANDS.find((b) => m >= b.min)!;
  const gpa = (rows.reduce((s, r) => s + g(r[1]).gpa, 0) / rows.length).toFixed(2);
  return (
    <div className="sticker rotate-[0.6deg] p-6 shadow-press">
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Sample · First Terminal Exam</div><div className="font-display text-[26px] font-extrabold leading-tight">Progress report</div></div>
          <span className="chip -rotate-6 border-pumpkin-ink bg-pumpkin-soft text-pumpkin-ink">SPECIMEN</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[14px]"><div><span className="text-ink-soft">Name</span><div className="sticker-line font-bold">Aanya Gurung</div></div><div><span className="text-ink-soft">Class</span><div className="sticker-line font-bold">Grade 3</div></div><div><span className="text-ink-soft">Roll</span><div className="sticker-line font-bold">2</div></div></div>
        <table className="table-x mt-4"><thead><tr><th>Subject</th><th className="text-right">Marks</th><th className="text-right">Grade</th></tr></thead>
          <tbody>{rows.map(([s, m]) => <tr key={s}><td>{s}</td><td className="num text-right">{m}/100</td><td className="text-right font-bold">{g(m).grade}</td></tr>)}</tbody></table>
        <div className="mt-3 flex items-center justify-between rounded-key bg-sun-soft px-3 py-2"><span className="font-bold">GPA</span><span className="num font-display text-[26px] font-extrabold">{gpa}</span></div>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-soft"><IShield size={16} /> Attendance for the term is printed beside the marks.</div>
      </div>
    </div>
  );
}
