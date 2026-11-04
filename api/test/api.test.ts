import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleApi, validPhone, SESSION_COOKIE, APP_ROUTES, DEMO_OWNER } from '../src/worker.ts';
import { fmtNpr, parseNpr, amountInWords, adIsoToBs, bsYmOf, ktmTodayIso, gradeOf, overallGpa, dueReminder } from '../../shared/school.ts';
import { D1Shim } from './d1shim.ts';

const ORIGIN = 'https://basta.sites.tab.bot';
const SETUP_KEY = 'test-setup-key-' + Math.random().toString(36).slice(2);
let env: any; let ipc = 0;
async function call(method: string, path: string, o: { body?: any; cookie?: string; origin?: string | null; ip?: string; ct?: string } = {}) {
  const h: Record<string, string> = {};
  if (o.origin !== null && method !== 'GET') h.Origin = o.origin || ORIGIN;
  if (o.cookie) h.Cookie = `${SESSION_COOKIE}=${o.cookie}`;
  if (o.body !== undefined) h['Content-Type'] = o.ct || 'application/json';
  h['CF-Connecting-IP'] = o.ip || `10.1.0.${++ipc % 250}`;
  const res = await handleApi(new Request(ORIGIN + path, { method, headers: h, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }), env);
  const text = await res.text();
  const m = new RegExp(SESSION_COOKIE + '=([^;]*)').exec(res.headers.get('set-cookie') || '');
  let j: any = null; try { j = text ? JSON.parse(text) : null; } catch { j = text; }
  return { status: res.status, json: j, text, cookie: m ? m[1] : null, headers: res.headers };
}
const PW = 'Pathshala2083';
const today = ktmTodayIso(); const month = bsYmOf(today)!;
let office: string, office2: string, teacher: string, parent: string, admin: string;
let classId: number, studentId: number, code: string, payId: number, examId: number, subId: number, noticeId: number, otherStudent: number;

test.before(async () => {
  const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SETUP_KEY))), (b) => b.toString(16).padStart(2, '0')).join('');
  env = { DB: new D1Shim(), SETUP_KEY_SHA256: h };
});

test('helpers: money, BS dates, grading, reminders, phone', () => {
  assert.equal(fmtNpr(1234567800), '1,23,45,678'); assert.equal(parseNpr('2,500'), 250000); assert.equal(parseNpr('-1'), null);
  assert.equal(amountInWords(250000), 'Rupees Two Thousand Five Hundred Only');
  assert.equal(adIsoToBs('2026-11-03'), '2083-07-17');
  assert.deepEqual(gradeOf(91, 100), { grade: 'A+', gpa: 4, pct: 91 });
  assert.equal(gradeOf(34.5, 100).grade, 'NG'); assert.equal(gradeOf(35, 100).grade, 'D'); assert.equal(gradeOf(40, 50).grade, 'A');
  assert.deepEqual(overallGpa([{ marks: 95, full: 100 }, { marks: 72, full: 100 }]), { gpa: 3.6, grade: 'A', ng: false });
  assert.equal(overallGpa([{ marks: 95, full: 100 }, { marks: 20, full: 100 }]).grade, 'NG');
  assert.equal(overallGpa([{ marks: null, full: 100 }]).gpa, null);
  assert.match(dueReminder({ school: 'S', student: 'Ram', className: 'Grade 1', amount: 250000, lang: 'ne' }), /रू|Rs 2,500/);
  assert.equal(validPhone('+977 9812345678'), '9812345678'); assert.equal(validPhone('12345'), null);
});

test('auth: register school owner + parent, validation, login, CSRF guard', async () => {
  let r = await call('POST', '/api/auth/register', { body: { kind: 'school', name: 'Ramesh KC', email: 'office@school.np', password: PW, school_name: 'Shree Test Academy' } });
  assert.equal(r.status, 201); office = r.cookie!;
  r = await call('POST', '/api/auth/register', { body: { kind: 'school', name: 'X', email: 'bad', password: 'short' } }); assert.equal(r.status, 422);
  r = await call('POST', '/api/auth/register', { body: { kind: 'school', name: 'Ramesh', email: 'office@school.np', password: PW, school_name: 'Dup Academy' } }); assert.equal(r.status, 409);
  r = await call('POST', '/api/auth/register', { body: { kind: 'school', name: 'Other Owner', email: 'other@school.np', password: PW, school_name: 'Other School' } }); office2 = r.cookie!;
  r = await call('POST', '/api/auth/login', { body: { email: 'office@school.np', password: 'wrong-pass1' } }); assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { body: { email: 'office@school.np', password: PW } }); assert.equal(r.status, 200); assert.ok(r.cookie);
  assert.match(r.headers.get('set-cookie')!, /HttpOnly; Secure; SameSite=Lax/);
  r = await call('POST', '/api/classes', { cookie: office, origin: 'https://evil.example', body: { name: 'Grade 1' } }); assert.equal(r.status, 403);
  r = await call('POST', '/api/classes', { cookie: office, body: { name: 'Grade 1' }, ct: 'text/plain' }); assert.equal(r.status, 415);
  r = await call('GET', '/api/me', { cookie: office }); assert.equal(r.json.school.srole, 'owner');
});

test('school setup: classes, students, bulk import, plan limit message', async () => {
  let r = await call('POST', '/api/classes', { cookie: office, body: { name: 'Grade 1', monthly_fee: '2,500' } }); assert.equal(r.status, 201); classId = r.json.id;
  r = await call('POST', '/api/classes', { cookie: office, body: { name: 'Grade 2', monthly_fee: 2800 } }); assert.equal(r.status, 201);
  r = await call('POST', '/api/classes', { cookie: office, body: { name: 'Grade 1' } }); assert.equal(r.status, 409);
  r = await call('POST', '/api/students', { cookie: office, body: { class_id: classId, name: 'Sita Tamang', roll: 1, gender: 'girl', guardian_name: 'Hari Tamang', guardian_phone: '9801234567' } });
  assert.equal(r.status, 201); studentId = r.json.id; code = r.json.family_code; assert.match(code, /^[A-Z0-9]{8}$/);
  r = await call('POST', '/api/students', { cookie: office, body: { class_id: classId, name: 'Bad', guardian_phone: '123' } }); assert.equal(r.status, 422);
  r = await call('POST', '/api/students/bulk', { cookie: office, body: { class_id: classId, rows: 'Ram Thapa,2,Gopal Thapa,9811111111\nGita Rai,3,,\n' } }); assert.equal(r.status, 201); assert.equal(r.json.added, 2);
  r = await call('POST', '/api/students/bulk', { cookie: office, body: { class_id: classId, rows: 'Ok Name,4\n,5\n' } }); assert.equal(r.status, 422);
  r = await call('GET', `/api/students?class=${classId}&q=thapa`, { cookie: office }); assert.equal(r.json.students.length, 1);
  r = await call('POST', '/api/students', { cookie: office2, body: { class_id: classId, name: 'Cross School' } }); assert.equal(r.status, 422, 'other school cannot use my class');
  r = await call('POST', '/api/classes', { cookie: office2, body: { name: 'Nursery' } }); const oc = r.json.id;
  r = await call('POST', '/api/students', { cookie: office2, body: { class_id: oc, name: 'Other Kid' } }); otherStudent = r.json.id;
  r = await call('GET', `/api/students/${otherStudent}`, { cookie: office }); assert.equal(r.status, 404, 'tenant isolation');
});

test('staff: owner adds teacher; teacher RBAC (attendance yes, fees no)', async () => {
  let r = await call('POST', '/api/staff', { cookie: office, body: { name: 'Mina Teacher', email: 'mina@school.np' } }); assert.equal(r.status, 201);
  r = await call('POST', '/api/auth/login', { body: { email: 'mina@school.np', password: r.json.temp_password } }); assert.equal(r.status, 200); teacher = r.cookie!;
  r = await call('GET', '/api/fees', { cookie: teacher }); assert.equal(r.status, 403);
  r = await call('POST', '/api/payments', { cookie: teacher, body: { student_id: studentId, amount: 100, method: 'cash' } }); assert.equal(r.status, 403);
  r = await call('GET', '/api/students', { cookie: teacher }); assert.equal(r.status, 200); assert.equal(r.json.students[0].due, undefined, 'teacher sees no dues');
  r = await call('POST', '/api/students', { cookie: teacher, body: { class_id: classId, name: 'Nope' } }); assert.equal(r.status, 403);
});

test('attendance: mark, re-mark, register, future date refused', async () => {
  let r = await call('GET', `/api/attendance?class=${classId}&date=${today}`, { cookie: teacher }); assert.equal(r.status, 200); assert.equal(r.json.roster.length, 3); assert.equal(r.json.marked, false);
  const ids = r.json.roster.map((x: any) => x.id);
  r = await call('PUT', '/api/attendance', { cookie: teacher, body: { class_id: classId, date: today, marks: ids.map((id: number, i: number) => ({ student_id: id, status: i === 1 ? 'A' : 'P' })) } });
  assert.equal(r.status, 200); assert.equal(r.json.absent, 1);
  r = await call('PUT', '/api/attendance', { cookie: teacher, body: { class_id: classId, date: today, marks: [{ student_id: ids[1], status: 'L' }] } }); assert.equal(r.status, 200);
  r = await call('GET', `/api/attendance?class=${classId}&date=${today}`, { cookie: teacher }); assert.equal(r.json.roster[1].status, 'L');
  r = await call('PUT', '/api/attendance', { cookie: teacher, body: { class_id: classId, date: '2099-01-01', marks: [{ student_id: ids[0], status: 'P' }] } }); assert.equal(r.status, 422);
  r = await call('PUT', '/api/attendance', { cookie: teacher, body: { class_id: classId, date: today, marks: [{ student_id: otherStudent, status: 'P' }] } }); assert.equal(r.status, 422);
  r = await call('GET', `/api/attendance/register?class=${classId}&month=${month}`, { cookie: office }); assert.equal(r.status, 200); assert.ok(r.json.marks.length >= 3);
});

test('fees: generate monthly dues once, extra charge, payment receipt, void, balance', async () => {
  let r = await call('POST', '/api/fees/generate', { cookie: office, body: { month } }); assert.equal(r.status, 200); assert.equal(r.json.created, 3);
  r = await call('POST', '/api/fees/generate', { cookie: office, body: { month } }); assert.equal(r.json.created, 0, 'no double billing');
  r = await call('POST', '/api/charges', { cookie: office, body: { class_id: classId, kind: 'exam', description: 'First terminal exam fee', amount: '500', month } }); assert.equal(r.json.created, 3);
  r = await call('POST', '/api/payments', { cookie: office, body: { student_id: studentId, amount: '2,000', method: 'esewa', paid_on: today } });
  assert.equal(r.status, 201); payId = r.json.id; assert.match(r.json.receipt_no, /^BS-\d{4}-0001$/); assert.equal(r.json.balance.due, 100000);
  r = await call('GET', `/api/receipts/${payId}`, { cookie: office }); assert.equal(r.json.receipt.in_words, 'Rupees Two Thousand Only');
  r = await call('GET', `/api/receipts/${payId}`, { cookie: office2 }); assert.equal(r.status, 404);
  r = await call('POST', '/api/payments', { cookie: office, body: { student_id: studentId, amount: '0', method: 'cash' } }); assert.equal(r.status, 422);
  r = await call('GET', '/api/fees', { cookie: office }); assert.equal(r.json.collected, 200000); assert.equal(r.json.dues.length, 3);
  r = await call('POST', `/api/payments/${payId}/void`, { cookie: office, body: { reason: 'Entered twice' } }); assert.equal(r.status, 200);
  r = await call('POST', `/api/payments/${payId}/void`, { cookie: office, body: { reason: 'again' } }); assert.equal(r.status, 409);
  r = await call('GET', `/api/students/${studentId}`, { cookie: office }); assert.equal(r.json.balance.due, 300000);
  r = await call('POST', '/api/payments', { cookie: office, body: { student_id: studentId, amount: 3000, method: 'cash' } }); payId = r.json.id; assert.equal(r.json.balance.due, 0);
});

test('notices + parent portal: link by family code, read receipts, isolation', async () => {
  let r = await call('POST', '/api/notices', { cookie: teacher, body: { title: 'Sports day', body: 'Wear house colours on Friday.', class_id: classId } }); assert.equal(r.status, 201); noticeId = r.json.id;
  r = await call('POST', '/api/auth/register', { body: { kind: 'parent', name: 'Hari Tamang', email: 'hari@mail.np', password: PW, family_code: 'WRONG123' } }); assert.equal(r.status, 422);
  r = await call('POST', '/api/auth/register', { body: { kind: 'parent', name: 'Hari Tamang', email: 'hari@mail.np', password: PW, family_code: code } }); assert.equal(r.status, 201); parent = r.cookie!;
  r = await call('GET', '/api/family', { cookie: parent }); assert.equal(r.json.children.length, 1); assert.equal(r.json.children[0].unread, 1); assert.equal(r.json.children[0].today, 'P');
  r = await call('GET', `/api/family/${studentId}`, { cookie: parent }); assert.equal(r.status, 200); assert.equal(r.json.balance.due, 0); assert.equal(r.json.payments.length, 1);
  r = await call('GET', `/api/family/${otherStudent}`, { cookie: parent }); assert.equal(r.status, 404);
  r = await call('GET', `/api/receipts/${payId}`, { cookie: parent }); assert.equal(r.status, 200);
  r = await call('POST', `/api/notices/${noticeId}/read`, { cookie: parent }); assert.equal(r.status, 200);
  r = await call('GET', '/api/notices', { cookie: office }); assert.equal(r.json.notices[0].reads, 1); assert.equal(r.json.notices[0].audience, 1);
  r = await call('GET', '/api/fees', { cookie: parent }); assert.equal(r.status, 403);
  r = await call('GET', '/api/students', { cookie: parent }); assert.equal(r.status, 403);
});

test('exams: subjects, marks validation, publish gate for parents, report card GPA', async () => {
  let r = await call('POST', '/api/exams', { cookie: office, body: { name: 'First Terminal', held_on: today } }); examId = r.json.id;
  r = await call('POST', '/api/subjects', { cookie: office, body: { class_id: classId, name: 'Maths', full_marks: 100 } }); subId = r.json.id;
  r = await call('POST', '/api/subjects', { cookie: office, body: { class_id: classId, name: 'English', full_marks: 50 } }); const sub2 = r.json.id;
  r = await call('PUT', `/api/exams/${examId}/marks`, { cookie: teacher, body: { class_id: classId, rows: [{ student_id: studentId, subject_id: sub2, marks: 51 }] } }); assert.equal(r.status, 422);
  r = await call('PUT', `/api/exams/${examId}/marks`, { cookie: teacher, body: { class_id: classId, rows: [{ student_id: studentId, subject_id: subId, marks: 92 }, { student_id: studentId, subject_id: sub2, marks: 40 }] } }); assert.equal(r.status, 200);
  r = await call('GET', `/api/report/${examId}/${studentId}`, { cookie: parent }); assert.equal(r.status, 404, 'unpublished hidden from parents');
  r = await call('POST', `/api/exams/${examId}/publish`, { cookie: teacher, body: { published: true } }); assert.equal(r.status, 403);
  r = await call('POST', `/api/exams/${examId}/publish`, { cookie: office, body: { published: true } }); assert.equal(r.status, 200);
  r = await call('GET', `/api/report/${examId}/${studentId}`, { cookie: parent }); assert.equal(r.status, 200);
  assert.equal(r.json.subjects[0].grade, 'A+'); assert.equal(r.json.subjects[1].grade, 'A'); assert.equal(r.json.overall.gpa, 3.8); assert.equal(r.json.total, 132);
});

test('dashboard + admin: setup key, overview, disable school, audit', async () => {
  let r = await call('GET', '/api/dashboard', { cookie: office }); assert.equal(r.status, 200); assert.equal(r.json.trend.length, 6); assert.equal(r.json.classes[0].absent, 0);
  r = await call('GET', '/api/dashboard', { cookie: teacher }); assert.equal(r.json.trend, undefined);
  r = await call('POST', '/api/setup', { body: { key: 'nope', email: 'admin@basta.np', name: 'Admin', password: PW } }); assert.equal(r.status, 403);
  r = await call('POST', '/api/setup', { body: { key: SETUP_KEY, email: 'admin@basta.np', name: 'Admin', password: PW } }); assert.equal(r.status, 200);
  r = await call('POST', '/api/auth/login', { body: { email: 'admin@basta.np', password: PW } }); admin = r.cookie!;
  r = await call('GET', '/api/admin/overview', { cookie: office }); assert.equal(r.status, 403);
  r = await call('GET', '/api/admin/overview', { cookie: admin }); assert.equal(r.json.schools, 2); assert.equal(r.json.demo_schools, 1);
  r = await call('GET', '/api/admin/schools', { cookie: admin }); const mine = r.json.schools.find((s: any) => s.name === 'Other School');
  r = await call('PUT', `/api/admin/schools/${mine.id}`, { cookie: admin, body: { plan: 'free', disabled: true } }); assert.equal(r.status, 200);
  r = await call('GET', '/api/school', { cookie: office2 }); assert.equal(r.status, 403);
  r = await call('GET', '/api/admin/audit', { cookie: admin }); assert.ok(r.json.audit.some((a: any) => a.action === 'payment.void'));
});

test('demo: three demo roles sign in; demo school is labelled; password change locked', async () => {
  for (const as of ['office', 'teacher', 'parent']) { const r = await call('POST', '/api/auth/demo', { body: { as } }); assert.equal(r.status, 200, as); }
  const r = await call('POST', '/api/auth/demo', { body: { as: 'office' } });
  const s = await call('GET', '/api/school', { cookie: r.cookie! }); assert.match(s.json.school.name, /^Demo school/); assert.equal(s.json.students, 24);
  const d = await call('GET', '/api/dashboard', { cookie: r.cookie! }); assert.ok(d.json.outstanding > 0);
  const p = await call('POST', '/api/me/password', { cookie: r.cookie!, body: { current: 'x', next: 'Something123' } }); assert.equal(p.status, 403);
  const u = await env.DB.prepare('SELECT email FROM users WHERE email = ?1').bind(DEMO_OWNER).first(); assert.ok(u);
  const pr = await call('POST', '/api/auth/demo', { body: { as: 'parent' } });
  const fam = await call('GET', '/api/family', { cookie: pr.cookie! }); assert.equal(fam.json.children.length, 1);
  const ex = await call('GET', `/api/family/${fam.json.children[0].id}`, { cookie: pr.cookie! }); assert.equal(ex.json.exams.length, 1);
});

test('SPA routes + headers', async () => {
  for (const p of ['/', '/login', '/register', '/app', '/app/students', '/app/students/12', '/family', '/family/3', '/admin', '/admin/audit', '/receipt/4', '/report/1/2', '/terms', '/privacy', '/settings']) assert.ok(APP_ROUTES.test(p), p);
  assert.ok(!APP_ROUTES.test('/wp-admin'));
  const assets = { fetch: async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }) };
  const res = await worker.fetch(new Request(ORIGIN + '/nope-page'), { ...env, ASSETS: assets });
  assert.equal(res.status, 404); assert.match(res.headers.get('content-security-policy')!, /default-src 'self'/);
});
