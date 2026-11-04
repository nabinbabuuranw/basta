import { PublicHeader, Footer } from '../components/PublicHeader';
import { Link } from '../lib/router';
const UPDATED = '4 November 2026 (18 Kartik 2083)';
export function Terms() {
  return (
    <div className="page-enter"><PublicHeader />
      <main className="wrap max-w-3xl py-12">
        <div className="eyebrow">Terms of Service</div><h1 className="mt-2 text-[44px] font-extrabold">Using Basta</h1><p className="mt-2 text-ink-soft">Last updated {UPDATED}.</p>
        <div className="mt-8 space-y-6 text-[17px] leading-relaxed">
          <section><h2 className="text-[24px] font-bold">1. What Basta is</h2><p>Basta is a web app that helps a school record students, attendance, fees, payments, notices and exam marks, and lets guardians view their own child’s records. It is an early-stage product run by an individual developer in Nepal, offered as is.</p></section>
          <section><h2 className="text-[24px] font-bold">2. What Basta is not</h2><p>Basta is not a government system, is not connected to IEMIS or any examination board, and is not a certified billing or accounting system. Receipts it prints are the school’s own acknowledgements. Grade bands follow the published letter-grading table, and the school is responsible for checking results before sharing them.</p></section>
          <section><h2 className="text-[24px] font-bold">3. Accounts</h2><p>The school office account is responsible for who it adds as staff and for giving family codes only to real guardians. Keep passwords private. We may pause an account that is used to harm others or to break the law.</p></section>
          <section><h2 className="text-[24px] font-bold">4. Payments</h2><p>Basta does not collect money from parents. It only records payments the school says it received. Basta Free costs nothing. Basta Pro (Rs 1,499 per month per school) is switched on manually after a written agreement; nothing is charged automatically.</p></section>
          <section><h2 className="text-[24px] font-bold">5. Your data</h2><p>The school owns its data. You can ask us to export or delete a school’s data at any time. See the <Link to="/privacy" className="underline">Privacy Policy</Link>.</p></section>
          <section><h2 className="text-[24px] font-bold">6. Limits</h2><p>We work to keep Basta available and correct, but we cannot promise it will never be down or never contain a mistake. To the extent the law allows, Basta is not liable for indirect losses arising from its use.</p></section>
          <section><h2 className="text-[24px] font-bold">7. Changes and contact</h2><p>If these terms change we will show the new date here. Questions: open an issue on the project’s public code page linked in the footer.</p></section>
        </div>
      </main><Footer /></div>
  );
}
export function Privacy() {
  return (
    <div className="page-enter"><PublicHeader />
      <main className="wrap max-w-3xl py-12">
        <div className="eyebrow">Privacy Policy</div><h1 className="mt-2 text-[44px] font-extrabold">Children’s records deserve care</h1><p className="mt-2 text-ink-soft">Last updated {UPDATED}.</p>
        <div className="mt-8 space-y-6 text-[17px] leading-relaxed">
          <section><h2 className="text-[24px] font-bold">What we store</h2><p>Account details (name, email, optional phone, a salted password hash). School records entered by the school: student names, class, roll number, guardian name and phone, attendance, fee charges, payments, notices, subjects and marks. Which notices a guardian opened. A security log of important actions.</p></section>
          <section><h2 className="text-[24px] font-bold">Who can see it</h2><p>The school office sees its whole school. Teachers see students, attendance, notices and marks, but not fees. A guardian sees only the children linked to their account. Nobody outside the school can browse a school’s data. The platform operator can see records only to keep the service running or when asked by the school.</p></section>
          <section><h2 className="text-[24px] font-bold">What we do not do</h2><p>No advertising, no selling or sharing of data, no tracking scripts, no third-party analytics. The only cookie is a sign-in cookie (HttpOnly, Secure).</p></section>
          <section><h2 className="text-[24px] font-bold">Where it lives</h2><p>Data is stored in a managed database on Cloudflare’s network, encrypted in transit. Passwords are hashed with PBKDF2 and never stored in plain text.</p></section>
          <section><h2 className="text-[24px] font-bold">Your choices</h2><p>Guardians can ask the school to correct a record. A school can ask for an export or full deletion of its data. Demo data is made up and reset every few hours.</p></section>
        </div>
      </main><Footer /></div>
  );
}
export function NotFound() {
  return (
    <div className="page-enter"><PublicHeader />
      <main className="wrap grid min-h-[60vh] place-items-center py-16 text-center">
        <div><div className="font-display text-[120px] font-extrabold leading-none text-pumpkin">404</div><h1 className="text-[32px] font-bold">This page is not in the bag.</h1><p className="mt-2 text-ink-soft">The link may be old or mistyped.</p><Link to="/" className="btn btn-primary mt-6">Back to the start</Link></div>
      </main><Footer /></div>
  );
}
