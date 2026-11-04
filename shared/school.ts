// Basta shared helpers (API + browser): money, Bikram Sambat dates, grading. Amounts are integer paisa (Rs 1 = 100 paisa).
import { adToBs, bsToAd, BS_MONTHS_EN, daysInBsMonth } from './nepali-date.js';

/** 123456789 paisa -> "12,34,567.89" (Nepali digit grouping). */
export function fmtNpr(paisa: number, withPaisa = false): string {
  const neg = paisa < 0; const p = Math.abs(Math.round(paisa));
  const r = Math.floor(p / 100), ps = p % 100;
  const s = String(r); let head = s.slice(0, -3); const tail = s.slice(-3);
  if (head) head = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',';
  return (neg ? '-' : '') + head + tail + (withPaisa || ps ? '.' + String(ps).padStart(2, '0') : '');
}
export const rs = (paisa: number) => 'Rs ' + fmtNpr(paisa);

/** "1,23,456.5" / 1234 -> paisa; null when not a valid non-negative amount (max Rs 9,99,99,999). */
export function parseNpr(v: unknown): number | null {
  if (typeof v === 'number') { if (!Number.isFinite(v) || v < 0 || v > 99_999_999) return null; return Math.round(v * 100); }
  if (typeof v !== 'string') return null;
  const s = v.replace(/[,\s]/g, '').replace(/^Rs\.?/i, '');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ''] = s.split('.');
  return Number(a) * 100 + Number((b + '00').slice(0, 2));
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
const three = (n: number) => { const h = Math.floor(n / 100), r = n % 100; return [h ? ONES[h] + ' Hundred' : '', r ? two(r) : ''].filter(Boolean).join(' '); };
export function rupeesInWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000); n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000); n %= 1_00_000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n) parts.push(three(n));
  return parts.join(' ');
}
export function amountInWords(paisa: number): string {
  const r = Math.floor(paisa / 100), p = paisa % 100;
  return 'Rupees ' + rupeesInWords(r) + (p ? ' and ' + two(p) + ' Paisa' : '') + ' Only';
}

/** Today's date in Kathmandu (UTC+5:45) as AD 'YYYY-MM-DD'. */
export function ktmTodayIso(now = Date.now()): string { return new Date(now + 345 * 60000).toISOString().slice(0, 10); }
/** AD 'YYYY-MM-DD' -> BS 'YYYY-MM-DD' (null outside the table range). */
export function adIsoToBs(iso: string): string | null {
  try { const b = adToBs(iso); return `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`; } catch { return null; }
}
export function bsLabel(iso: string): string {
  try { const b = adToBs(iso); return `${b.day} ${BS_MONTHS_EN[b.month - 1]} ${b.year}`; } catch { return ''; }
}
/** BS month key 'YYYY-MM' containing an AD date. */
export function bsYmOf(iso: string): string | null { const b = adIsoToBs(iso); return b ? b.slice(0, 7) : null; }
export function validBsYm(v: unknown): string | null {
  if (typeof v !== 'string') return null; const m = /^(\d{4})-(\d{2})$/.exec(v); if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]); if (mo < 1 || mo > 12) return null;
  try { daysInBsMonth(y, mo); return v; } catch { return null; }
}
export function bsYmLabel(ym: string): string { const [y, m] = ym.split('-').map(Number); return `${BS_MONTHS_EN[m - 1]} ${y}`; }
export function addBsMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
/** AD date range [start, end] for a BS month (YYYY-MM). */
export function bsMonthRange(ym: string): { start: string; end: string } | null {
  if (!validBsYm(ym)) return null; const [y, mo] = ym.split('-').map(Number);
  try {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { start: iso(bsToAd(y, mo, 1).date), end: iso(bsToAd(y, mo, daysInBsMonth(y, mo)).date) };
  } catch { return null; }
}
export const daysBetween = (aIso: string, bIso: string) => Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86400000);

export const PAY_METHODS = ['cash', 'bank', 'esewa', 'khalti', 'fonepay', 'cheque'] as const;
export const PAY_LABEL: Record<string, string> = { cash: 'Cash', bank: 'Bank deposit', esewa: 'eSewa', khalti: 'Khalti', fonepay: 'Fonepay QR', cheque: 'Cheque' };
export const CHARGE_KINDS = ['tuition', 'exam', 'transport', 'admission', 'other'] as const;
export const CHARGE_LABEL: Record<string, string> = { tuition: 'Monthly fee', exam: 'Exam fee', transport: 'Transport', admission: 'Admission', other: 'Other' };
export const ATT_STATUS = ['P', 'A', 'L'] as const;
export const ATT_LABEL: Record<string, string> = { P: 'Present', A: 'Absent', L: 'Leave' };
export const FREE_STUDENT_LIMIT = 60;
export const PRO_STUDENT_LIMIT = 600;
export const PRO_PRICE_NPR = 1499;

/** Letter grade from a percentage, using the CDC/NEB letter-grading bands (NG below 35). */
export const GRADE_BANDS: { min: number; grade: string; gpa: number; note: string }[] = [
  { min: 90, grade: 'A+', gpa: 4.0, note: 'Outstanding' },
  { min: 80, grade: 'A', gpa: 3.6, note: 'Excellent' },
  { min: 70, grade: 'B+', gpa: 3.2, note: 'Very good' },
  { min: 60, grade: 'B', gpa: 2.8, note: 'Good' },
  { min: 50, grade: 'C+', gpa: 2.4, note: 'Satisfactory' },
  { min: 40, grade: 'C', gpa: 2.0, note: 'Acceptable' },
  { min: 35, grade: 'D', gpa: 1.6, note: 'Basic' },
  { min: 0, grade: 'NG', gpa: 0.0, note: 'Not graded' },
];
export function gradeOf(marks: number, full: number): { grade: string; gpa: number; pct: number } {
  const pct = full > 0 ? Math.max(0, Math.min(100, (marks / full) * 100)) : 0;
  const b = GRADE_BANDS.find((x) => pct >= x.min) || GRADE_BANDS[GRADE_BANDS.length - 1];
  return { grade: b.grade, gpa: b.gpa, pct: Math.round(pct * 10) / 10 };
}
/** Overall GPA = average of subject grade points, 2 decimals; null when any subject is NG or missing. */
export function overallGpa(rows: { marks: number | null; full: number }[]): { gpa: number | null; grade: string; ng: boolean } {
  if (!rows.length || rows.some((r) => r.marks === null)) return { gpa: null, grade: '-', ng: false };
  const g = rows.map((r) => gradeOf(r.marks as number, r.full));
  const ng = g.some((x) => x.grade === 'NG');
  const avg = Math.round((g.reduce((s, x) => s + x.gpa, 0) / g.length) * 100) / 100;
  const band = GRADE_BANDS.find((b) => avg >= b.gpa) || GRADE_BANDS[GRADE_BANDS.length - 1];
  return { gpa: avg, grade: ng ? 'NG' : band.grade, ng };
}
/** WhatsApp reminder text for a guardian (Nepali + English). Amount in paisa. */
export function dueReminder(o: { school: string; student: string; className: string; amount: number; lang: 'ne' | 'en' }): string {
  if (o.lang === 'ne') return `नमस्ते, ${o.school} बाट। ${o.student} (${o.className}) को शुल्क ${rs(o.amount)} बाँकी छ। कृपया सुविधा अनुसार तिर्नुहोला। धन्यवाद।`;
  return `Namaste from ${o.school}. ${o.student} (${o.className}) has Rs ${fmtNpr(o.amount)} in fees due. Please pay at your convenience. Thank you.`;
}
export const FAMILY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
