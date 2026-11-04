// Basta API + static host. One Cloudflare Worker: /api/* is handled here, everything else is served from ASSETS.
// Storage: Cloudflare D1 (SQLite). No third-party services, no keys.
import { SCHEMA, SCHEMA_VERSION } from './schema.ts';
import { hashPassword, verifyPassword, randomToken, sha256hex } from './crypto.ts';
import {
  parseNpr, ktmTodayIso, adIsoToBs, bsYmOf, validBsYm, bsMonthRange, addBsMonths, bsYmLabel, amountInWords, gradeOf, overallGpa,
  PAY_METHODS, CHARGE_KINDS, ATT_STATUS, FREE_STUDENT_LIMIT, PRO_STUDENT_LIMIT, FAMILY_CODE_ALPHABET,
} from '../../shared/school.ts';

export interface Env { DB: D1Database; ASSETS?: { fetch: (r: Request) => Promise<Response> }; SETUP_KEY_SHA256?: string }
type Role = 'parent' | 'staff' | 'admin';
interface User { id: number; email: string; name: string; phone: string | null; role: Role; disabled: number; is_demo: number; created_at: number }
interface Ctx { req: Request; env: Env; url: URL; user: User | null; ip: string; body: any; query: URLSearchParams }
interface Staff { user: User; school_id: number; srole: 'owner' | 'teacher'; school: any }

export const SETUP_KEY_SHA256 = '59387e6c74602350e1b5e953cccaef6a4ef997f593213ae6898c5f06a2856633';
export const SESSION_COOKIE = 'basta_sid';
const SESSION_DAYS = 14;
export const DEMO_OWNER = 'demo-office@basta.demo';
export const DEMO_TEACHER = 'demo-teacher@basta.demo';
export const DEMO_PARENT = 'demo-parent@basta.demo';
const DEMO_RESET_HOURS = 3;

class HttpError extends Error {
  status: number; code: string; detail?: any;
  constructor(status: number, code: string, detail?: any) { super(code); this.status = status; this.code = code; this.detail = detail; }
}
const err = (status: number, code: string, detail?: any) => new HttpError(status, code, detail);
const bad = (field: string) => err(422, 'invalid', { field });

// ------------------------------------------------------------------ validation
export function clean(v: unknown, max: number, { required = true, min = 1 } = {}): string | null {
  if (v === undefined || v === null || v === '') return required ? null : '';
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
  if (!required && s.length === 0) return '';
  if (s.length < min || s.length > max) return null;
  return s;
}
const req = (v: unknown, max: number, field: string, min = 1) => { const s = clean(v, max, { min }); if (s === null) throw bad(field); return s; };
const opt = (v: unknown, max: number, field: string) => { const s = clean(v, max, { required: false }); if (s === null) throw bad(field); return s; };
export function validEmail(v: unknown): string | null {
  const s = clean(v, 160); if (!s) return null; const e = s.toLowerCase();
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(e) ? e : null;
}
export function validPhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let d = v.replace(/[\s\-()]/g, '');
  if (d.startsWith('+977')) d = d.slice(4); else if (d.startsWith('977') && d.length === 13) d = d.slice(3);
  if (/^9[678]\d{8}$/.test(d)) return d;
  if (/^0\d{7,9}$/.test(d)) return d;
  return null;
}
export function validPassword(v: unknown): string | null {
  if (typeof v !== 'string' || v.length < 8 || v.length > 200) return null;
  if (!/[a-zA-Z]/.test(v) || !/\d/.test(v)) return null;
  return v;
}
export function validDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  return adIsoToBs(v) ? v : null;
}
export const int = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], field: string, fallback?: T): T => {
  if ((v === undefined || v === null || v === '') && fallback !== undefined) return fallback;
  if (typeof v === 'string' && (list as readonly string[]).includes(v)) return v as T; throw bad(field);
};
const money = (v: unknown, field: string, { min = 0 } = {}) => { const p = parseNpr(v); if (p === null || p < min) throw bad(field); return p; };
const idOf = (s: string) => { const n = Number(s); if (!Number.isInteger(n) || n < 1) throw err(404, 'not_found'); return n; };
const bool = (v: unknown) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

// ------------------------------------------------------------------ http helpers
const SEC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
};
function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEC_HEADERS, ...extra } });
}
function readCookie(r: Request, name: string): string | null {
  const c = r.headers.get('Cookie') || ''; const m = c.split(/;\s*/).find((x) => x.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function cookie(token: string, maxAge: number): string { return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
const now = () => Date.now();

let schemaReady = false;
async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  const v = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").first().catch(() => null);
  let ok: any = null;
  if (v) ok = await db.prepare("SELECT v FROM meta WHERE k='schema'").first<any>();
  if (!ok || ok.v !== SCHEMA_VERSION) { for (const s of SCHEMA) await db.prepare(s).run(); await db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('schema', ?1)").bind(SCHEMA_VERSION).run(); }
  if (!(await db.prepare('SELECT id FROM users WHERE email = ?1').bind(DEMO_OWNER).first())) await seedDemo(db);
  schemaReady = true;
}
export function resetSchemaFlag() { schemaReady = false; }

export async function rateLimit(db: D1Database, bucket: string, limit: number, windowSec: number): Promise<void> {
  const t = now();
  const row = await db.prepare('SELECT count, reset_at FROM rate_limits WHERE bucket = ?1').bind(bucket).first<any>();
  if (!row || row.reset_at <= t) { await db.prepare('INSERT OR REPLACE INTO rate_limits (bucket, count, reset_at) VALUES (?1, 1, ?2)').bind(bucket, t + windowSec * 1000).run(); return; }
  if (row.count >= limit) throw err(429, 'rate_limited', { retry_after: Math.ceil((row.reset_at - t) / 1000) });
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE bucket = ?1').bind(bucket).run();
}
async function audit(db: D1Database, actor: User | null, action: string, target = '', detail = '') {
  await db.prepare('INSERT INTO audit_log (actor_id, actor_email, action, target, detail, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(actor?.id ?? null, actor?.email ?? null, action, target, detail.slice(0, 400), now()).run();
}
async function loadUser(ctx: Ctx): Promise<User | null> {
  const tok = readCookie(ctx.req, SESSION_COOKIE); if (!tok || tok.length > 100) return null;
  const sid = await sha256hex(tok);
  const u = await ctx.env.DB.prepare(`SELECT u.id, u.email, u.name, u.phone, u.role, u.disabled, u.is_demo, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ?1 AND s.expires_at > ?2`).bind(sid, now()).first<User>();
  return u && !u.disabled ? u : null;
}
function need(ctx: Ctx, ...roles: Role[]): User {
  if (!ctx.user) throw err(401, 'not_signed_in');
  if (roles.length && !roles.includes(ctx.user.role)) throw err(403, 'forbidden');
  return ctx.user;
}
async function staff(ctx: Ctx, ownerOnly = false): Promise<Staff> {
  const u = need(ctx, 'staff');
  const m = await ctx.env.DB.prepare('SELECT m.role AS srole, s.* FROM members m JOIN schools s ON s.id = m.school_id WHERE m.user_id = ?1').bind(u.id).first<any>();
  if (!m) throw err(403, 'no_school');
  if (m.disabled) throw err(403, 'school_disabled');
  if (ownerOnly && m.srole !== 'owner') throw err(403, 'owner_only');
  return { user: u, school_id: m.id, srole: m.srole, school: m };
}
async function startSession(db: D1Database, userId: number): Promise<string> {
  const token = randomToken(32);
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)').bind(await sha256hex(token), userId, now() + SESSION_DAYS * 86400000, now()).run();
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now()).run();
  return token;
}
const publicUser = (u: any) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, is_demo: u.is_demo });
function familyCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(8)); let s = '';
  for (const x of b) s += FAMILY_CODE_ALPHABET[x % FAMILY_CODE_ALPHABET.length];
  return s;
}
async function uniqueCode(db: D1Database): Promise<string> {
  for (let i = 0; i < 6; i++) { const c = familyCode(); if (!(await db.prepare('SELECT id FROM students WHERE family_code = ?1').bind(c).first())) return c; }
  throw err(500, 'code_exhausted');
}
async function classOf(db: D1Database, schoolId: number, id: unknown) {
  const n = int(id, 1, 1e12); if (!n) throw bad('class_id');
  const c = await db.prepare('SELECT * FROM classes WHERE id = ?1 AND school_id = ?2').bind(n, schoolId).first<any>();
  if (!c) throw bad('class_id'); return c;
}
async function studentOf(db: D1Database, schoolId: number, id: unknown) {
  const n = int(id, 1, 1e12); if (!n) throw err(404, 'not_found');
  const s = await db.prepare('SELECT st.*, c.name AS class_name FROM students st JOIN classes c ON c.id = st.class_id WHERE st.id = ?1 AND st.school_id = ?2').bind(n, schoolId).first<any>();
  if (!s) throw err(404, 'not_found'); return s;
}
async function activeCount(db: D1Database, schoolId: number): Promise<number> {
  return ((await db.prepare('SELECT COUNT(*) AS n FROM students WHERE school_id = ?1 AND active = 1').bind(schoolId).first<any>())?.n) || 0;
}
const limitFor = (plan: string) => (plan === 'pro' ? PRO_STUDENT_LIMIT : FREE_STUDENT_LIMIT);
async function balanceOf(db: D1Database, studentId: number): Promise<{ charged: number; paid: number; due: number }> {
  const c = await db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM charges WHERE student_id = ?1 AND voided = 0').bind(studentId).first<any>();
  const p = await db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE student_id = ?1 AND voided = 0').bind(studentId).first<any>();
  return { charged: c.t, paid: p.t, due: c.t - p.t };
}

type Handler = (ctx: Ctx, params: string[]) => Promise<Response>;
const routes: [string, RegExp, Handler][] = [];
const on = (m: string, p: string, h: Handler) => routes.push([m, new RegExp('^' + p.replace(/:(\w+)/g, '([^/]+)') + '$'), h]);

// ------------------------------------------------------------------ setup + auth
on('POST', '/api/setup', async (ctx) => {
  await rateLimit(ctx.env.DB, 'setup:' + ctx.ip, 5, 3600);
  const key = typeof ctx.body.key === 'string' ? ctx.body.key : '';
  if (!key || (await sha256hex(key)) !== (ctx.env.SETUP_KEY_SHA256 || SETUP_KEY_SHA256)) throw err(403, 'forbidden');
  const email = validEmail(ctx.body.email); if (!email) throw bad('email');
  const pw = validPassword(ctx.body.password); if (!pw) throw bad('password');
  const name = req(ctx.body.name, 80, 'name');
  const ex = await ctx.env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first<any>();
  if (ex) await ctx.env.DB.prepare("UPDATE users SET role = 'admin', pw_hash = ?1, name = ?2, disabled = 0 WHERE id = ?3").bind(await hashPassword(pw), name, ex.id).run();
  else await ctx.env.DB.prepare("INSERT INTO users (email, name, pw_hash, role, created_at) VALUES (?1, ?2, ?3, 'admin', ?4)").bind(email, name, await hashPassword(pw), now()).run();
  await audit(ctx.env.DB, null, 'admin.setup', email);
  return json({ ok: true });
});
on('POST', '/api/auth/register', async (ctx) => {
  await rateLimit(ctx.env.DB, 'reg:' + ctx.ip, 10, 3600);
  if (ctx.body.website) throw bad('website'); // honeypot
  const name = req(ctx.body.name, 80, 'name', 2);
  const email = validEmail(ctx.body.email); if (!email) throw bad('email');
  const pw = validPassword(ctx.body.password); if (!pw) throw bad('password');
  const kind = oneOf(ctx.body.kind, ['school', 'parent'] as const, 'kind');
  let phone: string | null = null; if (ctx.body.phone) { phone = validPhone(ctx.body.phone); if (!phone) throw bad('phone'); }
  if (email.endsWith('@basta.demo')) throw bad('email');
  const db = ctx.env.DB;
  let schoolName = '', code = '', student: any = null;
  if (kind === 'school') schoolName = req(ctx.body.school_name, 120, 'school_name', 3);
  else {
    code = typeof ctx.body.family_code === 'string' ? ctx.body.family_code.trim().toUpperCase().replace(/[\s-]/g, '') : '';
    if (code) { student = await db.prepare('SELECT id, school_id FROM students WHERE family_code = ?1 AND active = 1').bind(code).first<any>(); if (!student) throw bad('family_code'); }
  }
  if (await db.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first()) throw err(409, 'email_taken');
  const role: Role = kind === 'school' ? 'staff' : 'parent';
  const r = await db.prepare('INSERT INTO users (email, name, phone, pw_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id')
    .bind(email, name, phone, await hashPassword(pw), role, now()).first<any>();
  if (kind === 'school') {
    const s = await db.prepare('INSERT INTO schools (name, created_at) VALUES (?1, ?2) RETURNING id').bind(schoolName, now()).first<any>();
    await db.prepare("INSERT INTO members (school_id, user_id, role, created_at) VALUES (?1, ?2, 'owner', ?3)").bind(s.id, r.id, now()).run();
  } else if (student) {
    await db.prepare('INSERT OR IGNORE INTO guardians (student_id, user_id, created_at) VALUES (?1, ?2, ?3)').bind(student.id, r.id, now()).run();
  }
  const token = await startSession(db, r.id);
  await audit(db, { id: r.id, email } as User, 'user.register', 'user:' + r.id, kind);
  return json({ user: { id: r.id, email, name, phone, role, is_demo: 0 } }, 201, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
});
on('POST', '/api/auth/login', async (ctx) => {
  await rateLimit(ctx.env.DB, 'login:' + ctx.ip, 12, 900);
  const email = validEmail(ctx.body.email); const pw = typeof ctx.body.password === 'string' ? ctx.body.password : '';
  if (!email || !pw) throw err(401, 'bad_credentials');
  await rateLimit(ctx.env.DB, 'login-acct:' + email, 8, 900);
  const u = await ctx.env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first<any>();
  if (!u || !(await verifyPassword(pw, u.pw_hash))) throw err(401, 'bad_credentials');
  if (u.disabled) throw err(403, 'account_disabled');
  const token = await startSession(ctx.env.DB, u.id);
  return json({ user: publicUser(u) }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
});
on('POST', '/api/auth/demo', async (ctx) => {
  await rateLimit(ctx.env.DB, 'demo:' + ctx.ip, 30, 3600);
  const as = oneOf(ctx.body.as, ['office', 'teacher', 'parent'] as const, 'as');
  const last = await ctx.env.DB.prepare("SELECT v FROM meta WHERE k = 'demo_reset_at'").first<any>();
  if (!last || now() - Number(last.v) > DEMO_RESET_HOURS * 3600000) await seedDemo(ctx.env.DB);
  const email = as === 'office' ? DEMO_OWNER : as === 'teacher' ? DEMO_TEACHER : DEMO_PARENT;
  const u = await ctx.env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first<any>();
  if (!u || u.disabled) throw err(403, 'account_disabled');
  const token = await startSession(ctx.env.DB, u.id);
  return json({ user: publicUser(u) }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
});
on('POST', '/api/auth/logout', async (ctx) => {
  const tok = readCookie(ctx.req, SESSION_COOKIE);
  if (tok) await ctx.env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(await sha256hex(tok)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
});
on('GET', '/api/me', async (ctx) => {
  if (!ctx.user) return json({ user: null });
  let school: any = null;
  if (ctx.user.role === 'staff') school = await ctx.env.DB.prepare('SELECT s.id, s.name, s.plan, s.is_demo, m.role AS srole FROM members m JOIN schools s ON s.id = m.school_id WHERE m.user_id = ?1').bind(ctx.user.id).first<any>();
  return json({ user: publicUser(ctx.user), school });
});
on('PUT', '/api/me', async (ctx) => {
  const u = need(ctx);
  const name = req(ctx.body.name, 80, 'name', 2);
  let phone: string | null = null; if (ctx.body.phone) { phone = validPhone(ctx.body.phone); if (!phone) throw bad('phone'); }
  await ctx.env.DB.prepare('UPDATE users SET name = ?1, phone = ?2 WHERE id = ?3').bind(name, phone, u.id).run();
  return json({ ok: true });
});
on('POST', '/api/me/password', async (ctx) => {
  const u = need(ctx);
  if (u.is_demo) throw err(403, 'demo_locked');
  await rateLimit(ctx.env.DB, 'pw:' + u.id, 6, 900);
  const row = await ctx.env.DB.prepare('SELECT pw_hash FROM users WHERE id = ?1').bind(u.id).first<any>();
  if (!(await verifyPassword(String(ctx.body.current || ''), row.pw_hash))) throw err(401, 'bad_credentials');
  const pw = validPassword(ctx.body.next); if (!pw) throw bad('password');
  const tok = readCookie(ctx.req, SESSION_COOKIE); const keep = tok ? await sha256hex(tok) : '';
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE users SET pw_hash = ?1 WHERE id = ?2').bind(await hashPassword(pw), u.id),
    ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1 AND id != ?2').bind(u.id, keep),
  ]);
  await audit(ctx.env.DB, u, 'user.password');
  return json({ ok: true });
});

// ------------------------------------------------------------------ school + classes + staff
on('GET', '/api/school', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB;
  const classes = (await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.active = 1) AS students FROM classes c WHERE c.school_id = ?1 ORDER BY c.sort, c.id`).bind(s.school_id).all()).results;
  const n = await activeCount(db, s.school_id);
  const { receipt_seq, srole, ...school } = s.school;
  return json({ school, role: s.srole, classes, students: n, limit: limitFor(s.school.plan) });
});
on('PUT', '/api/school', async (ctx) => {
  const s = await staff(ctx, true);
  const name = req(ctx.body.name, 120, 'name', 3), address = opt(ctx.body.address, 200, 'address'), pan = opt(ctx.body.pan, 20, 'pan');
  let phone = ''; if (ctx.body.phone) { const p = validPhone(ctx.body.phone); if (!p) throw bad('phone'); phone = p; }
  if (pan && !/^\d{9}$/.test(pan)) throw bad('pan');
  await ctx.env.DB.prepare('UPDATE schools SET name = ?1, address = ?2, phone = ?3, pan = ?4 WHERE id = ?5').bind(name, address, phone, pan, s.school_id).run();
  await audit(ctx.env.DB, s.user, 'school.update', 'school:' + s.school_id);
  return json({ ok: true });
});
on('POST', '/api/classes', async (ctx) => {
  const s = await staff(ctx, true);
  const name = req(ctx.body.name, 40, 'name'); const fee = money(ctx.body.monthly_fee ?? '0', 'monthly_fee');
  const cnt = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM classes WHERE school_id = ?1').bind(s.school_id).first<any>();
  if (cnt.n >= 30) throw err(422, 'too_many_classes');
  if (await ctx.env.DB.prepare('SELECT id FROM classes WHERE school_id = ?1 AND name = ?2').bind(s.school_id, name).first()) throw err(409, 'class_exists');
  const r = await ctx.env.DB.prepare('INSERT INTO classes (school_id, name, monthly_fee, sort, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id').bind(s.school_id, name, fee, cnt.n, now()).first<any>();
  return json({ id: r.id }, 201);
});
on('PUT', '/api/classes/:id', async (ctx, [id]) => {
  const s = await staff(ctx, true); const c = await classOf(ctx.env.DB, s.school_id, id);
  const name = req(ctx.body.name, 40, 'name'); const fee = money(ctx.body.monthly_fee ?? '0', 'monthly_fee');
  await ctx.env.DB.prepare('UPDATE classes SET name = ?1, monthly_fee = ?2 WHERE id = ?3').bind(name, fee, c.id).run();
  return json({ ok: true });
});
on('DELETE', '/api/classes/:id', async (ctx, [id]) => {
  const s = await staff(ctx, true); const c = await classOf(ctx.env.DB, s.school_id, id);
  if (await ctx.env.DB.prepare('SELECT id FROM students WHERE class_id = ?1').bind(c.id).first()) throw err(409, 'class_has_students');
  await ctx.env.DB.prepare('DELETE FROM classes WHERE id = ?1').bind(c.id).run();
  return json({ ok: true });
});
on('GET', '/api/staff', async (ctx) => {
  const s = await staff(ctx, true);
  const rows = (await ctx.env.DB.prepare('SELECT u.id, u.name, u.email, u.phone, m.role, u.disabled, m.created_at FROM members m JOIN users u ON u.id = m.user_id WHERE m.school_id = ?1 ORDER BY m.role DESC, u.name').bind(s.school_id).all()).results;
  return json({ staff: rows });
});
on('POST', '/api/staff', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB;
  const name = req(ctx.body.name, 80, 'name', 2); const email = validEmail(ctx.body.email); if (!email) throw bad('email');
  if (email.endsWith('@basta.demo')) throw bad('email');
  const n = await db.prepare('SELECT COUNT(*) AS n FROM members WHERE school_id = ?1').bind(s.school_id).first<any>();
  if (n.n >= 40) throw err(422, 'too_many_staff');
  if (await db.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first()) throw err(409, 'email_taken');
  const temp = randomToken(9).replace(/[-_]/g, 'x').slice(0, 10) + '7';
  const r = await db.prepare("INSERT INTO users (email, name, pw_hash, role, created_at) VALUES (?1, ?2, ?3, 'staff', ?4) RETURNING id").bind(email, name, await hashPassword(temp), now()).first<any>();
  await db.prepare("INSERT INTO members (school_id, user_id, role, created_at) VALUES (?1, ?2, 'teacher', ?3)").bind(s.school_id, r.id, now()).run();
  await audit(db, s.user, 'staff.add', 'user:' + r.id, email);
  return json({ id: r.id, temp_password: temp }, 201);
});
on('DELETE', '/api/staff/:id', async (ctx, [id]) => {
  const s = await staff(ctx, true); const uid = idOf(id);
  const m = await ctx.env.DB.prepare("SELECT user_id FROM members WHERE school_id = ?1 AND user_id = ?2 AND role = 'teacher'").bind(s.school_id, uid).first<any>();
  if (!m) throw err(404, 'not_found');
  await ctx.env.DB.batch([ctx.env.DB.prepare('DELETE FROM members WHERE user_id = ?1').bind(uid), ctx.env.DB.prepare('UPDATE users SET disabled = 1 WHERE id = ?1').bind(uid), ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(uid)]);
  await audit(ctx.env.DB, s.user, 'staff.remove', 'user:' + uid);
  return json({ ok: true });
});

// ------------------------------------------------------------------ students
function studentInput(b: any) {
  const name = req(b.name, 80, 'name', 2);
  const roll = b.roll === '' || b.roll === undefined || b.roll === null ? null : int(b.roll, 1, 999); if (roll === null && b.roll !== '' && b.roll !== undefined && b.roll !== null) throw bad('roll');
  const gender = oneOf(b.gender, ['', 'girl', 'boy', 'other'] as const, 'gender', '');
  const guardian_name = opt(b.guardian_name, 80, 'guardian_name');
  let guardian_phone = ''; if (b.guardian_phone) { const p = validPhone(b.guardian_phone); if (!p) throw bad('guardian_phone'); guardian_phone = p; }
  return { name, roll, gender, guardian_name, guardian_phone };
}
on('GET', '/api/students', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB; const q = (ctx.query.get('q') || '').trim().slice(0, 60);
  const cls = ctx.query.get('class'); const status = ctx.query.get('status') === 'left' ? 0 : 1;
  let sql = `SELECT st.id, st.name, st.roll, st.gender, st.guardian_name, st.guardian_phone, st.class_id, c.name AS class_name, st.active,
    (SELECT COALESCE(SUM(amount),0) FROM charges WHERE student_id = st.id AND voided = 0) - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = st.id AND voided = 0) AS due,
    (SELECT COUNT(*) FROM guardians g WHERE g.student_id = st.id) AS linked
    FROM students st JOIN classes c ON c.id = st.class_id WHERE st.school_id = ?1 AND st.active = ?2`;
  const args: any[] = [s.school_id, status];
  if (cls) { const c = await classOf(db, s.school_id, cls); sql += ` AND st.class_id = ?${args.length + 1}`; args.push(c.id); }
  if (q) { sql += ` AND (st.name LIKE ?${args.length + 1} OR st.guardian_name LIKE ?${args.length + 1} OR st.guardian_phone LIKE ?${args.length + 1})`; args.push('%' + q.replace(/[%_]/g, '') + '%'); }
  sql += ' ORDER BY c.sort, c.id, st.roll, st.name LIMIT 1000';
  const rows = (await db.prepare(sql).bind(...args).all()).results;
  return json({ students: s.srole === 'owner' ? rows : rows.map((r: any) => ({ ...r, due: undefined })) });
});
on('POST', '/api/students', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB;
  const c = await classOf(db, s.school_id, ctx.body.class_id); const v = studentInput(ctx.body);
  if ((await activeCount(db, s.school_id)) >= limitFor(s.school.plan)) throw err(402, 'plan_limit', { limit: limitFor(s.school.plan) });
  const code = await uniqueCode(db);
  const r = await db.prepare(`INSERT INTO students (school_id, class_id, name, roll, gender, guardian_name, guardian_phone, family_code, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) RETURNING id`)
    .bind(s.school_id, c.id, v.name, v.roll, v.gender, v.guardian_name, v.guardian_phone, code, now()).first<any>();
  await audit(db, s.user, 'student.add', 'student:' + r.id);
  return json({ id: r.id, family_code: code }, 201);
});
on('POST', '/api/students/bulk', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB;
  const c = await classOf(db, s.school_id, ctx.body.class_id);
  const text = typeof ctx.body.rows === 'string' ? ctx.body.rows : ''; if (!text.trim() || text.length > 15000) throw bad('rows');
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean).slice(0, 120);
  const room = limitFor(s.school.plan) - (await activeCount(db, s.school_id));
  if (lines.length > room) throw err(402, 'plan_limit', { limit: limitFor(s.school.plan) });
  const parsed = lines.map((l: string, i: number) => {
    const [name, roll, guardian_name, guardian_phone] = l.split(/\t|,/).map((x) => x.trim());
    try { return studentInput({ name, roll: roll || null, guardian_name: guardian_name || '', guardian_phone: guardian_phone || '' }); } catch { throw err(422, 'invalid', { field: 'rows', line: i + 1 }); }
  });
  const stmts = [];
  for (const v of parsed) stmts.push(db.prepare(`INSERT INTO students (school_id, class_id, name, roll, gender, guardian_name, guardian_phone, family_code, created_at) VALUES (?1,?2,?3,?4,'',?5,?6,?7,?8)`)
    .bind(s.school_id, c.id, v.name, v.roll, v.guardian_name, v.guardian_phone, await uniqueCode(db), now()));
  await db.batch(stmts);
  await audit(db, s.user, 'student.bulk', 'class:' + c.id, String(parsed.length));
  return json({ added: parsed.length }, 201);
});
on('GET', '/api/students/:id', async (ctx, [id]) => {
  const s = await staff(ctx); const db = ctx.env.DB; const st = await studentOf(db, s.school_id, id);
  const att = await db.prepare(`SELECT status, COUNT(*) AS n FROM attendance WHERE student_id = ?1 GROUP BY status`).bind(st.id).all();
  const guardians = (await db.prepare('SELECT u.name, u.email FROM guardians g JOIN users u ON u.id = g.user_id WHERE g.student_id = ?1').bind(st.id).all()).results;
  const out: any = { student: st, attendance: att.results, guardians };
  if (s.srole === 'owner') {
    out.balance = await balanceOf(db, st.id);
    out.charges = (await db.prepare('SELECT * FROM charges WHERE student_id = ?1 ORDER BY bs_month DESC, id DESC LIMIT 200').bind(st.id).all()).results;
    out.payments = (await db.prepare('SELECT * FROM payments WHERE student_id = ?1 ORDER BY id DESC LIMIT 200').bind(st.id).all()).results;
  } else delete out.student.family_code;
  return json(out);
});
on('PUT', '/api/students/:id', async (ctx, [id]) => {
  const s = await staff(ctx, true); const db = ctx.env.DB; const st = await studentOf(db, s.school_id, id);
  const v = studentInput(ctx.body); const c = await classOf(db, s.school_id, ctx.body.class_id ?? st.class_id);
  const active = ctx.body.active === undefined ? st.active : bool(ctx.body.active);
  if (active && !st.active && (await activeCount(db, s.school_id)) >= limitFor(s.school.plan)) throw err(402, 'plan_limit', { limit: limitFor(s.school.plan) });
  await db.prepare('UPDATE students SET name=?1, roll=?2, gender=?3, guardian_name=?4, guardian_phone=?5, class_id=?6, active=?7 WHERE id=?8')
    .bind(v.name, v.roll, v.gender, v.guardian_name, v.guardian_phone, c.id, active, st.id).run();
  await audit(db, s.user, 'student.update', 'student:' + st.id);
  return json({ ok: true });
});
on('POST', '/api/students/:id/code', async (ctx, [id]) => {
  const s = await staff(ctx, true); const db = ctx.env.DB; const st = await studentOf(db, s.school_id, id);
  const code = await uniqueCode(db);
  await db.prepare('UPDATE students SET family_code = ?1 WHERE id = ?2').bind(code, st.id).run();
  await audit(db, s.user, 'student.code', 'student:' + st.id);
  return json({ family_code: code });
});

// ------------------------------------------------------------------ attendance
function schoolDay(v: unknown): string {
  const d = validDate(v); if (!d) throw bad('date');
  if (d > ktmTodayIso()) throw err(422, 'future_date');
  return d;
}
on('GET', '/api/attendance', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB; const c = await classOf(db, s.school_id, ctx.query.get('class'));
  const day = schoolDay(ctx.query.get('date') || ktmTodayIso());
  const rows = (await db.prepare(`SELECT st.id, st.name, st.roll, a.status FROM students st LEFT JOIN attendance a ON a.student_id = st.id AND a.day = ?2
    WHERE st.class_id = ?1 AND st.active = 1 ORDER BY st.roll, st.name`).bind(c.id, day).all()).results;
  return json({ class: { id: c.id, name: c.name }, date: day, bs: adIsoToBs(day), roster: rows, marked: rows.some((r: any) => r.status) });
});
on('PUT', '/api/attendance', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB; const c = await classOf(db, s.school_id, ctx.body.class_id);
  const day = schoolDay(ctx.body.date);
  const marks = Array.isArray(ctx.body.marks) ? ctx.body.marks : null; if (!marks || !marks.length || marks.length > 200) throw bad('marks');
  const ids = new Set(((await db.prepare('SELECT id FROM students WHERE class_id = ?1 AND active = 1').bind(c.id).all()).results as any[]).map((r) => r.id));
  const stmts = marks.map((m: any) => {
    const sid = int(m.student_id, 1, 1e12); if (!sid || !ids.has(sid)) throw bad('student_id');
    const st = oneOf(m.status, ATT_STATUS, 'status');
    return db.prepare(`INSERT INTO attendance (student_id, day, school_id, class_id, status, marked_by, marked_at) VALUES (?1,?2,?3,?4,?5,?6,?7)
      ON CONFLICT(student_id, day) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at`).bind(sid, day, s.school_id, c.id, st, s.user.id, now());
  });
  await db.batch(stmts);
  await audit(db, s.user, 'attendance.mark', 'class:' + c.id, day + ' ' + marks.length);
  const absent = marks.filter((m: any) => m.status === 'A').length;
  return json({ ok: true, saved: marks.length, absent });
});
on('GET', '/api/attendance/register', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB; const c = await classOf(db, s.school_id, ctx.query.get('class'));
  const ym = validBsYm(ctx.query.get('month') || '') || bsYmOf(ktmTodayIso())!; const range = bsMonthRange(ym); if (!range) throw bad('month');
  const students = (await db.prepare('SELECT id, name, roll FROM students WHERE class_id = ?1 AND active = 1 ORDER BY roll, name').bind(c.id).all()).results;
  const marks = (await db.prepare('SELECT student_id, day, status FROM attendance WHERE class_id = ?1 AND day BETWEEN ?2 AND ?3').bind(c.id, range.start, range.end).all()).results;
  return json({ class: { id: c.id, name: c.name }, month: ym, label: bsYmLabel(ym), start: range.start, end: range.end, students, marks });
});

// ------------------------------------------------------------------ fees (owner only)
on('GET', '/api/fees', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB;
  const ym = validBsYm(ctx.query.get('month') || '') || bsYmOf(ktmTodayIso())!; const range = bsMonthRange(ym)!;
  const billed = await db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM charges WHERE school_id = ?1 AND bs_month = ?2 AND voided = 0').bind(s.school_id, ym).first<any>();
  const collected = await db.prepare('SELECT COALESCE(SUM(amount),0) AS t, COUNT(*) AS n FROM payments WHERE school_id = ?1 AND voided = 0 AND paid_on BETWEEN ?2 AND ?3').bind(s.school_id, range.start, range.end).first<any>();
  const tuition = await db.prepare("SELECT COUNT(*) AS n FROM charges WHERE school_id = ?1 AND bs_month = ?2 AND kind = 'tuition' AND voided = 0").bind(s.school_id, ym).first<any>();
  const dues = (await db.prepare(`SELECT * FROM (SELECT st.id, st.name, st.roll, st.guardian_name, st.guardian_phone, c.name AS class_name, c.id AS class_id,
    (SELECT COALESCE(SUM(amount),0) FROM charges WHERE student_id = st.id AND voided = 0) - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = st.id AND voided = 0) AS due,
    (SELECT MIN(bs_month) FROM charges WHERE student_id = st.id AND voided = 0) AS first_month
    FROM students st JOIN classes c ON c.id = st.class_id WHERE st.school_id = ?1 AND st.active = 1) WHERE due > 0 ORDER BY due DESC LIMIT 500`).bind(s.school_id).all()).results;
  const recent = (await db.prepare(`SELECT p.id, p.receipt_no, p.amount, p.method, p.paid_on, p.voided, st.name, c.name AS class_name FROM payments p JOIN students st ON st.id = p.student_id JOIN classes c ON c.id = st.class_id
    WHERE p.school_id = ?1 ORDER BY p.id DESC LIMIT 15`).bind(s.school_id).all()).results;
  return json({ month: ym, label: bsYmLabel(ym), billed: billed.t, collected: collected.t, receipts: collected.n, tuition_generated: tuition.n, dues, recent, school: { name: s.school.name } });
});
on('POST', '/api/fees/generate', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB;
  const ym = validBsYm(ctx.body.month); if (!ym) throw bad('month');
  if (ym > addBsMonths(bsYmOf(ktmTodayIso())!, 1)) throw err(422, 'too_far_ahead');
  let clsFilter = ''; const args: any[] = [s.school_id];
  if (ctx.body.class_id) { const c = await classOf(db, s.school_id, ctx.body.class_id); clsFilter = ' AND st.class_id = ?2'; args.push(c.id); }
  args.push(ym); const ymArg = '?' + args.length;
  const rows = (await db.prepare(`SELECT st.id, c.monthly_fee, c.name FROM students st JOIN classes c ON c.id = st.class_id WHERE st.school_id = ?1 AND st.active = 1 AND c.monthly_fee > 0${clsFilter}
    AND NOT EXISTS (SELECT 1 FROM charges ch WHERE ch.student_id = st.id AND ch.bs_month = ${ymArg} AND ch.kind = 'tuition' AND ch.voided = 0)`).bind(...args).all()).results as any[];
  const label = bsYmLabel(ym);
  if (rows.length) await db.batch(rows.map((r) => db.prepare("INSERT INTO charges (school_id, student_id, bs_month, kind, description, amount, created_at) VALUES (?1,?2,?3,'tuition',?4,?5,?6)")
    .bind(s.school_id, r.id, ym, 'Monthly fee, ' + label, r.monthly_fee, now())));
  await audit(db, s.user, 'fees.generate', 'month:' + ym, String(rows.length));
  return json({ created: rows.length, month: ym });
});
on('POST', '/api/charges', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB;
  const kind = oneOf(ctx.body.kind, CHARGE_KINDS.filter((k) => k !== 'tuition'), 'kind');
  const description = req(ctx.body.description, 80, 'description', 2); const amount = money(ctx.body.amount, 'amount', { min: 100 });
  const ym = validBsYm(ctx.body.month) || bsYmOf(ktmTodayIso())!;
  let ids: number[] = [];
  if (ctx.body.student_id) ids = [(await studentOf(db, s.school_id, ctx.body.student_id)).id];
  else { const c = await classOf(db, s.school_id, ctx.body.class_id); ids = ((await db.prepare('SELECT id FROM students WHERE class_id = ?1 AND active = 1').bind(c.id).all()).results as any[]).map((r) => r.id); }
  if (!ids.length) throw err(422, 'no_students');
  await db.batch(ids.map((sid) => db.prepare('INSERT INTO charges (school_id, student_id, bs_month, kind, description, amount, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)').bind(s.school_id, sid, ym, kind, description, amount, now())));
  await audit(db, s.user, 'charge.add', ctx.body.student_id ? 'student:' + ids[0] : 'class:' + ctx.body.class_id, `${kind} ${amount} x${ids.length}`);
  return json({ created: ids.length }, 201);
});
on('POST', '/api/charges/:id/void', async (ctx, [id]) => {
  const s = await staff(ctx, true); const c = await ctx.env.DB.prepare('SELECT * FROM charges WHERE id = ?1 AND school_id = ?2').bind(idOf(id), s.school_id).first<any>();
  if (!c) throw err(404, 'not_found'); if (c.voided) throw err(409, 'already_void');
  await ctx.env.DB.prepare('UPDATE charges SET voided = 1 WHERE id = ?1').bind(c.id).run();
  await audit(ctx.env.DB, s.user, 'charge.void', 'charge:' + c.id);
  return json({ ok: true });
});
on('POST', '/api/payments', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB; const st = await studentOf(db, s.school_id, ctx.body.student_id);
  const amount = money(ctx.body.amount, 'amount', { min: 100 }); const method = oneOf(ctx.body.method, PAY_METHODS, 'method');
  const paid_on = validDate(ctx.body.paid_on || ktmTodayIso()); if (!paid_on || paid_on > ktmTodayIso()) throw bad('paid_on');
  const note = opt(ctx.body.note, 120, 'note');
  const seq = await db.prepare('UPDATE schools SET receipt_seq = receipt_seq + 1 WHERE id = ?1 RETURNING receipt_seq').bind(s.school_id).first<any>();
  const fy = (adIsoToBs(paid_on) || '').slice(0, 4);
  const receipt_no = `BS-${fy}-${String(seq.receipt_seq).padStart(4, '0')}`;
  const r = await db.prepare('INSERT INTO payments (school_id, student_id, receipt_no, amount, method, paid_on, note, created_by, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) RETURNING id')
    .bind(s.school_id, st.id, receipt_no, amount, method, paid_on, note, s.user.id, now()).first<any>();
  await audit(db, s.user, 'payment.add', 'payment:' + r.id, `${receipt_no} ${amount}`);
  return json({ id: r.id, receipt_no, balance: await balanceOf(db, st.id) }, 201);
});
on('POST', '/api/payments/:id/void', async (ctx, [id]) => {
  const s = await staff(ctx, true); const p = await ctx.env.DB.prepare('SELECT * FROM payments WHERE id = ?1 AND school_id = ?2').bind(idOf(id), s.school_id).first<any>();
  if (!p) throw err(404, 'not_found'); if (p.voided) throw err(409, 'already_void');
  const reason = req(ctx.body.reason, 120, 'reason', 3);
  await ctx.env.DB.prepare("UPDATE payments SET voided = 1, note = TRIM(note || ' [void: ' || ?1 || ']') WHERE id = ?2").bind(reason, p.id).run();
  await audit(ctx.env.DB, s.user, 'payment.void', 'payment:' + p.id, reason);
  return json({ ok: true });
});
async function receiptData(db: D1Database, paymentId: number) {
  return db.prepare(`SELECT p.*, st.name AS student, st.roll, c.name AS class_name, sc.name AS school, sc.address, sc.phone AS school_phone, sc.pan, sc.is_demo, u.name AS received_by
    FROM payments p JOIN students st ON st.id = p.student_id JOIN classes c ON c.id = st.class_id JOIN schools sc ON sc.id = p.school_id LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?1`).bind(paymentId).first<any>();
}
on('GET', '/api/receipts/:id', async (ctx, [id]) => {
  const u = need(ctx); const db = ctx.env.DB; const r = await receiptData(db, idOf(id)); if (!r) throw err(404, 'not_found');
  if (u.role === 'staff') { const s = await staff(ctx, true); if (s.school_id !== r.school_id) throw err(404, 'not_found'); }
  else if (u.role === 'parent') { if (!(await db.prepare('SELECT 1 FROM guardians WHERE student_id = ?1 AND user_id = ?2').bind(r.student_id, u.id).first())) throw err(404, 'not_found'); }
  const bal = await balanceOf(db, r.student_id);
  return json({ receipt: { ...r, created_by: undefined, in_words: amountInWords(r.amount), bs_date: adIsoToBs(r.paid_on) }, balance_after: bal.due });
});

// ------------------------------------------------------------------ notices
on('GET', '/api/notices', async (ctx) => {
  const s = await staff(ctx);
  const rows = (await ctx.env.DB.prepare(`SELECT n.*, c.name AS class_name, u.name AS author, (SELECT COUNT(*) FROM notice_reads r WHERE r.notice_id = n.id) AS reads,
    (SELECT COUNT(DISTINCT g.user_id) FROM guardians g JOIN students st ON st.id = g.student_id WHERE st.school_id = n.school_id AND st.active = 1 AND (n.class_id IS NULL OR st.class_id = n.class_id)) AS audience
    FROM notices n LEFT JOIN classes c ON c.id = n.class_id LEFT JOIN users u ON u.id = n.created_by WHERE n.school_id = ?1 ORDER BY n.pinned DESC, n.id DESC LIMIT 100`).bind(s.school_id).all()).results;
  return json({ notices: rows });
});
on('POST', '/api/notices', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB;
  const title = req(ctx.body.title, 100, 'title', 3); const body = req(ctx.body.body, 2000, 'body', 3);
  let classId: number | null = null; if (ctx.body.class_id) classId = (await classOf(db, s.school_id, ctx.body.class_id)).id;
  const pinned = s.srole === 'owner' ? bool(ctx.body.pinned) : 0;
  await rateLimit(db, 'notice:' + s.user.id, 30, 3600);
  const r = await db.prepare('INSERT INTO notices (school_id, class_id, title, body, pinned, created_by, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7) RETURNING id').bind(s.school_id, classId, title, body, pinned, s.user.id, now()).first<any>();
  await audit(db, s.user, 'notice.post', 'notice:' + r.id);
  return json({ id: r.id }, 201);
});
on('DELETE', '/api/notices/:id', async (ctx, [id]) => {
  const s = await staff(ctx); const n = await ctx.env.DB.prepare('SELECT * FROM notices WHERE id = ?1 AND school_id = ?2').bind(idOf(id), s.school_id).first<any>();
  if (!n) throw err(404, 'not_found'); if (s.srole !== 'owner' && n.created_by !== s.user.id) throw err(403, 'forbidden');
  await ctx.env.DB.prepare('DELETE FROM notices WHERE id = ?1').bind(n.id).run();
  await audit(ctx.env.DB, s.user, 'notice.delete', 'notice:' + n.id);
  return json({ ok: true });
});

// ------------------------------------------------------------------ exams, subjects, marks
on('GET', '/api/exams', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB;
  const exams = (await db.prepare('SELECT * FROM exams WHERE school_id = ?1 ORDER BY id DESC').bind(s.school_id).all()).results;
  const subjects = (await db.prepare('SELECT * FROM subjects WHERE school_id = ?1 ORDER BY class_id, sort, id').bind(s.school_id).all()).results;
  return json({ exams, subjects });
});
on('POST', '/api/exams', async (ctx) => {
  const s = await staff(ctx, true); const name = req(ctx.body.name, 60, 'name', 3); const held = validDate(ctx.body.held_on); if (!held) throw bad('held_on');
  const r = await ctx.env.DB.prepare('INSERT INTO exams (school_id, name, held_on, created_at) VALUES (?1,?2,?3,?4) RETURNING id').bind(s.school_id, name, held, now()).first<any>();
  await audit(ctx.env.DB, s.user, 'exam.add', 'exam:' + r.id);
  return json({ id: r.id }, 201);
});
on('POST', '/api/exams/:id/publish', async (ctx, [id]) => {
  const s = await staff(ctx, true); const e = await ctx.env.DB.prepare('SELECT * FROM exams WHERE id = ?1 AND school_id = ?2').bind(idOf(id), s.school_id).first<any>();
  if (!e) throw err(404, 'not_found'); const pub = bool(ctx.body.published);
  await ctx.env.DB.prepare('UPDATE exams SET published = ?1 WHERE id = ?2').bind(pub, e.id).run();
  await audit(ctx.env.DB, s.user, pub ? 'exam.publish' : 'exam.unpublish', 'exam:' + e.id);
  return json({ ok: true, published: pub });
});
on('POST', '/api/subjects', async (ctx) => {
  const s = await staff(ctx, true); const db = ctx.env.DB; const c = await classOf(db, s.school_id, ctx.body.class_id);
  const name = req(ctx.body.name, 40, 'name', 2); const full = int(ctx.body.full_marks ?? 100, 10, 200); if (!full) throw bad('full_marks');
  const n = await db.prepare('SELECT COUNT(*) AS n FROM subjects WHERE class_id = ?1').bind(c.id).first<any>(); if (n.n >= 15) throw err(422, 'too_many_subjects');
  const r = await db.prepare('INSERT INTO subjects (school_id, class_id, name, full_marks, sort) VALUES (?1,?2,?3,?4,?5) RETURNING id').bind(s.school_id, c.id, name, full, n.n).first<any>();
  return json({ id: r.id }, 201);
});
on('DELETE', '/api/subjects/:id', async (ctx, [id]) => {
  const s = await staff(ctx, true); const r = await ctx.env.DB.prepare('DELETE FROM subjects WHERE id = ?1 AND school_id = ?2 RETURNING id').bind(idOf(id), s.school_id).first<any>();
  if (!r) throw err(404, 'not_found'); return json({ ok: true });
});
on('GET', '/api/exams/:id/marks', async (ctx, [id]) => {
  const s = await staff(ctx); const db = ctx.env.DB; const e = await db.prepare('SELECT * FROM exams WHERE id = ?1 AND school_id = ?2').bind(idOf(id), s.school_id).first<any>();
  if (!e) throw err(404, 'not_found'); const c = await classOf(db, s.school_id, ctx.query.get('class'));
  const subjects = (await db.prepare('SELECT * FROM subjects WHERE class_id = ?1 ORDER BY sort, id').bind(c.id).all()).results;
  const students = (await db.prepare('SELECT id, name, roll FROM students WHERE class_id = ?1 AND active = 1 ORDER BY roll, name').bind(c.id).all()).results;
  const marks = (await db.prepare('SELECT m.student_id, m.subject_id, m.marks FROM marks m JOIN students st ON st.id = m.student_id WHERE m.exam_id = ?1 AND st.class_id = ?2').bind(e.id, c.id).all()).results;
  return json({ exam: e, class: { id: c.id, name: c.name }, subjects, students, marks });
});
on('PUT', '/api/exams/:id/marks', async (ctx, [id]) => {
  const s = await staff(ctx); const db = ctx.env.DB; const e = await db.prepare('SELECT * FROM exams WHERE id = ?1 AND school_id = ?2').bind(idOf(id), s.school_id).first<any>();
  if (!e) throw err(404, 'not_found'); const c = await classOf(db, s.school_id, ctx.body.class_id);
  const subs = new Map(((await db.prepare('SELECT id, full_marks FROM subjects WHERE class_id = ?1').bind(c.id).all()).results as any[]).map((r) => [r.id, r.full_marks]));
  const studs = new Set(((await db.prepare('SELECT id FROM students WHERE class_id = ?1 AND active = 1').bind(c.id).all()).results as any[]).map((r) => r.id));
  const rows = Array.isArray(ctx.body.rows) ? ctx.body.rows : null; if (!rows || !rows.length || rows.length > 3000) throw bad('rows');
  const stmts = rows.map((r: any) => {
    const sid = int(r.student_id, 1, 1e12), sub = int(r.subject_id, 1, 1e12);
    if (!sid || !studs.has(sid) || !sub || !subs.has(sub)) throw bad('rows');
    let m: number | null = null;
    if (r.marks !== null && r.marks !== '' && r.marks !== undefined) { m = Number(r.marks); if (!Number.isFinite(m) || m < 0 || m > (subs.get(sub) as number) || Math.round(m * 2) !== m * 2) throw err(422, 'invalid', { field: 'marks', student_id: sid, subject_id: sub }); }
    return db.prepare('INSERT INTO marks (exam_id, student_id, subject_id, marks) VALUES (?1,?2,?3,?4) ON CONFLICT(exam_id, student_id, subject_id) DO UPDATE SET marks = excluded.marks').bind(e.id, sid, sub, m);
  });
  await db.batch(stmts);
  await audit(db, s.user, 'marks.save', 'exam:' + e.id, 'class:' + c.id + ' rows:' + rows.length);
  return json({ ok: true, saved: rows.length });
});
async function reportCard(db: D1Database, examId: number, studentId: number) {
  const e = await db.prepare('SELECT * FROM exams WHERE id = ?1').bind(examId).first<any>(); if (!e) return null;
  const st = await db.prepare('SELECT st.id, st.name, st.roll, st.school_id, st.class_id, c.name AS class_name, sc.name AS school, sc.address, sc.is_demo FROM students st JOIN classes c ON c.id = st.class_id JOIN schools sc ON sc.id = st.school_id WHERE st.id = ?1').bind(studentId).first<any>();
  if (!st || st.school_id !== e.school_id) return null;
  const subjects = (await db.prepare(`SELECT sb.id, sb.name, sb.full_marks, m.marks FROM subjects sb LEFT JOIN marks m ON m.subject_id = sb.id AND m.exam_id = ?1 AND m.student_id = ?2 WHERE sb.class_id = ?3 ORDER BY sb.sort, sb.id`).bind(examId, studentId, st.class_id).all()).results as any[];
  const rows = subjects.map((sb) => ({ ...sb, ...(sb.marks === null ? { grade: '-', gpa: null, pct: null } : gradeOf(sb.marks, sb.full_marks)) }));
  const overall = overallGpa(subjects.map((sb) => ({ marks: sb.marks, full: sb.full_marks })));
  const total = subjects.reduce((s, x) => s + (x.marks || 0), 0), full = subjects.reduce((s, x) => s + x.full_marks, 0);
  const range = { from: addBsMonths(bsYmOf(e.held_on)!, -3), to: bsYmOf(e.held_on)! };
  const r1 = bsMonthRange(range.from)!, r2 = bsMonthRange(range.to)!;
  const att = await db.prepare(`SELECT SUM(status='P') AS p, SUM(status='A') AS a, SUM(status='L') AS l FROM attendance WHERE student_id = ?1 AND day BETWEEN ?2 AND ?3`).bind(studentId, r1.start, r2.end).first<any>();
  return { exam: e, student: st, subjects: rows, overall, total, full, attendance: { present: att?.p || 0, absent: att?.a || 0, leave: att?.l || 0, from: range.from, to: range.to } };
}
on('GET', '/api/report/:exam/:student', async (ctx, [eid, sid]) => {
  const u = need(ctx); const db = ctx.env.DB; const rc = await reportCard(db, idOf(eid), idOf(sid)); if (!rc) throw err(404, 'not_found');
  if (u.role === 'staff') { const s = await staff(ctx); if (s.school_id !== rc.student.school_id) throw err(404, 'not_found'); }
  else if (u.role === 'parent') { if (!rc.exam.published || !(await db.prepare('SELECT 1 FROM guardians WHERE student_id = ?1 AND user_id = ?2').bind(rc.student.id, u.id).first())) throw err(404, 'not_found'); }
  return json(rc);
});

// ------------------------------------------------------------------ dashboard
on('GET', '/api/dashboard', async (ctx) => {
  const s = await staff(ctx); const db = ctx.env.DB; const today = ktmTodayIso(); const ym = bsYmOf(today)!; const range = bsMonthRange(ym)!;
  const classes = (await db.prepare(`SELECT c.id, c.name, (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.active = 1) AS total,
    (SELECT COUNT(*) FROM attendance a JOIN students st ON st.id = a.student_id WHERE a.class_id = c.id AND a.day = ?2 AND st.active = 1) AS marked,
    (SELECT COUNT(*) FROM attendance a JOIN students st ON st.id = a.student_id WHERE a.class_id = c.id AND a.day = ?2 AND a.status = 'A' AND st.active = 1) AS absent
    FROM classes c WHERE c.school_id = ?1 ORDER BY c.sort, c.id`).bind(s.school_id, today).all()).results;
  const notices = (await db.prepare('SELECT n.id, n.title, n.created_at, n.pinned, (SELECT COUNT(*) FROM notice_reads r WHERE r.notice_id = n.id) AS reads FROM notices n WHERE n.school_id = ?1 ORDER BY n.id DESC LIMIT 4').bind(s.school_id).all()).results;
  const out: any = { today, bs_today: adIsoToBs(today), month: ym, label: bsYmLabel(ym), classes, notices, role: s.srole, school: { name: s.school.name, plan: s.school.plan, is_demo: s.school.is_demo }, students: await activeCount(db, s.school_id), limit: limitFor(s.school.plan) };
  if (s.srole === 'owner') {
    const months = [addBsMonths(ym, -5), addBsMonths(ym, -4), addBsMonths(ym, -3), addBsMonths(ym, -2), addBsMonths(ym, -1), ym];
    out.trend = [];
    for (const m of months) {
      const r = bsMonthRange(m)!;
      const b = await db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM charges WHERE school_id = ?1 AND bs_month = ?2 AND voided = 0').bind(s.school_id, m).first<any>();
      const c = await db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE school_id = ?1 AND voided = 0 AND paid_on BETWEEN ?2 AND ?3').bind(s.school_id, r.start, r.end).first<any>();
      out.trend.push({ month: m, label: bsYmLabel(m), billed: b.t, collected: c.t });
    }
    const due = await db.prepare(`SELECT COALESCE(SUM(d),0) AS t, COUNT(*) AS n FROM (SELECT (SELECT COALESCE(SUM(amount),0) FROM charges WHERE student_id = st.id AND voided = 0) - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = st.id AND voided = 0) AS d FROM students st WHERE st.school_id = ?1 AND st.active = 1) WHERE d > 0`).bind(s.school_id).first<any>();
    out.outstanding = due.t; out.owing = due.n;
    const col = await db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE school_id = ?1 AND voided = 0 AND paid_on BETWEEN ?2 AND ?3').bind(s.school_id, range.start, range.end).first<any>();
    out.collected_month = col.t;
  }
  return json(out);
});

// ------------------------------------------------------------------ parent portal
async function childFor(ctx: Ctx, id: string) {
  const u = need(ctx, 'parent'); const sid = idOf(id);
  const st = await ctx.env.DB.prepare(`SELECT st.id, st.name, st.roll, st.class_id, st.school_id, c.name AS class_name, sc.name AS school, sc.phone AS school_phone, sc.is_demo FROM guardians g
    JOIN students st ON st.id = g.student_id JOIN classes c ON c.id = st.class_id JOIN schools sc ON sc.id = st.school_id WHERE g.user_id = ?1 AND st.id = ?2 AND sc.disabled = 0`).bind(u.id, sid).first<any>();
  if (!st) throw err(404, 'not_found'); return { u, st };
}
on('POST', '/api/family/link', async (ctx) => {
  const u = need(ctx, 'parent'); const db = ctx.env.DB;
  await rateLimit(db, 'link:' + u.id, 10, 3600);
  const code = typeof ctx.body.code === 'string' ? ctx.body.code.trim().toUpperCase().replace(/[\s-]/g, '') : '';
  if (!/^[A-Z0-9]{8}$/.test(code)) throw bad('code');
  const st = await db.prepare('SELECT id, name FROM students WHERE family_code = ?1 AND active = 1').bind(code).first<any>(); if (!st) throw bad('code');
  await db.prepare('INSERT OR IGNORE INTO guardians (student_id, user_id, created_at) VALUES (?1, ?2, ?3)').bind(st.id, u.id, now()).run();
  await audit(db, u, 'family.link', 'student:' + st.id);
  return json({ ok: true, student: { id: st.id, name: st.name } });
});
on('GET', '/api/family', async (ctx) => {
  const u = need(ctx, 'parent'); const db = ctx.env.DB; const today = ktmTodayIso();
  const kids = (await db.prepare(`SELECT st.id, st.name, st.roll, c.name AS class_name, sc.name AS school, sc.is_demo,
    (SELECT status FROM attendance a WHERE a.student_id = st.id AND a.day = ?2) AS today,
    (SELECT COALESCE(SUM(amount),0) FROM charges WHERE student_id = st.id AND voided = 0) - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE student_id = st.id AND voided = 0) AS due,
    (SELECT COUNT(*) FROM notices n WHERE n.school_id = st.school_id AND (n.class_id IS NULL OR n.class_id = st.class_id) AND NOT EXISTS (SELECT 1 FROM notice_reads r WHERE r.notice_id = n.id AND r.user_id = ?1)) AS unread
    FROM guardians g JOIN students st ON st.id = g.student_id JOIN classes c ON c.id = st.class_id JOIN schools sc ON sc.id = st.school_id WHERE g.user_id = ?1 AND sc.disabled = 0 ORDER BY st.name`).bind(u.id, today).all()).results;
  return json({ children: kids, today, bs_today: adIsoToBs(today) });
});
on('GET', '/api/family/:id', async (ctx, [id]) => {
  const { u, st } = await childFor(ctx, id); const db = ctx.env.DB;
  const ym = validBsYm(ctx.query.get('month') || '') || bsYmOf(ktmTodayIso())!; const range = bsMonthRange(ym)!;
  const att = (await db.prepare('SELECT day, status FROM attendance WHERE student_id = ?1 AND day BETWEEN ?2 AND ?3 ORDER BY day').bind(st.id, range.start, range.end).all()).results;
  const charges = (await db.prepare('SELECT id, bs_month, kind, description, amount FROM charges WHERE student_id = ?1 AND voided = 0 ORDER BY bs_month DESC, id DESC LIMIT 100').bind(st.id).all()).results;
  const payments = (await db.prepare('SELECT id, receipt_no, amount, method, paid_on FROM payments WHERE student_id = ?1 AND voided = 0 ORDER BY id DESC LIMIT 100').bind(st.id).all()).results;
  const notices = (await db.prepare(`SELECT n.id, n.title, n.body, n.pinned, n.created_at, c.name AS class_name, EXISTS (SELECT 1 FROM notice_reads r WHERE r.notice_id = n.id AND r.user_id = ?3) AS read
    FROM notices n LEFT JOIN classes c ON c.id = n.class_id WHERE n.school_id = ?1 AND (n.class_id IS NULL OR n.class_id = ?2) ORDER BY n.pinned DESC, n.id DESC LIMIT 50`).bind(st.school_id, st.class_id, u.id).all()).results;
  const exams = (await db.prepare('SELECT id, name, held_on FROM exams WHERE school_id = ?1 AND published = 1 ORDER BY id DESC').bind(st.school_id).all()).results;
  return json({ child: st, month: ym, label: bsYmLabel(ym), start: range.start, end: range.end, attendance: att, balance: await balanceOf(db, st.id), charges, payments, notices, exams });
});
on('POST', '/api/notices/:id/read', async (ctx, [id]) => {
  const u = need(ctx, 'parent'); const db = ctx.env.DB; const nid = idOf(id);
  const ok = await db.prepare(`SELECT 1 FROM notices n JOIN students st ON st.school_id = n.school_id AND (n.class_id IS NULL OR n.class_id = st.class_id) JOIN guardians g ON g.student_id = st.id WHERE n.id = ?1 AND g.user_id = ?2`).bind(nid, u.id).first();
  if (!ok) throw err(404, 'not_found');
  await db.prepare('INSERT OR IGNORE INTO notice_reads (notice_id, user_id, read_at) VALUES (?1, ?2, ?3)').bind(nid, u.id, now()).run();
  return json({ ok: true });
});

// ------------------------------------------------------------------ platform admin
on('GET', '/api/admin/overview', async (ctx) => {
  need(ctx, 'admin'); const db = ctx.env.DB;
  const q = async (sql: string) => ((await db.prepare(sql).first<any>())?.n) || 0;
  return json({ schools: await q('SELECT COUNT(*) AS n FROM schools WHERE is_demo = 0'), demo_schools: await q('SELECT COUNT(*) AS n FROM schools WHERE is_demo = 1'), pro: await q("SELECT COUNT(*) AS n FROM schools WHERE plan = 'pro'"),
    students: await q('SELECT COUNT(*) AS n FROM students st JOIN schools s ON s.id = st.school_id WHERE s.is_demo = 0 AND st.active = 1'), parents: await q("SELECT COUNT(*) AS n FROM users WHERE role = 'parent' AND is_demo = 0"),
    staff: await q("SELECT COUNT(*) AS n FROM users WHERE role = 'staff' AND is_demo = 0"), notices: await q('SELECT COUNT(*) AS n FROM notices n JOIN schools s ON s.id = n.school_id WHERE s.is_demo = 0') });
});
on('GET', '/api/admin/schools', async (ctx) => {
  need(ctx, 'admin');
  const rows = (await ctx.env.DB.prepare(`SELECT s.id, s.name, s.plan, s.disabled, s.is_demo, s.created_at, (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.active = 1) AS students,
    (SELECT u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.school_id = s.id AND m.role = 'owner' LIMIT 1) AS owner FROM schools s ORDER BY s.id DESC LIMIT 500`).all()).results;
  return json({ schools: rows });
});
on('PUT', '/api/admin/schools/:id', async (ctx, [id]) => {
  const a = need(ctx, 'admin'); const sid = idOf(id);
  const plan = oneOf(ctx.body.plan, ['free', 'pro'] as const, 'plan'); const disabled = bool(ctx.body.disabled);
  const r = await ctx.env.DB.prepare('UPDATE schools SET plan = ?1, disabled = ?2 WHERE id = ?3 RETURNING id').bind(plan, disabled, sid).first(); if (!r) throw err(404, 'not_found');
  await audit(ctx.env.DB, a, 'admin.school', 'school:' + sid, `plan=${plan} disabled=${disabled}`);
  return json({ ok: true });
});
on('GET', '/api/admin/users', async (ctx) => {
  need(ctx, 'admin'); const q = (ctx.query.get('q') || '').trim().slice(0, 60).replace(/[%_]/g, '');
  const rows = (await ctx.env.DB.prepare(`SELECT id, email, name, role, disabled, is_demo, created_at FROM users WHERE (?1 = '' OR email LIKE '%' || ?1 || '%' OR name LIKE '%' || ?1 || '%') ORDER BY id DESC LIMIT 300`).bind(q).all()).results;
  return json({ users: rows });
});
on('PUT', '/api/admin/users/:id', async (ctx, [id]) => {
  const a = need(ctx, 'admin'); const uid = idOf(id); if (uid === a.id) throw err(422, 'cannot_change_self');
  const disabled = bool(ctx.body.disabled);
  const r = await ctx.env.DB.prepare("UPDATE users SET disabled = ?1 WHERE id = ?2 AND role != 'admin' RETURNING id").bind(disabled, uid).first(); if (!r) throw err(404, 'not_found');
  if (disabled) await ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(uid).run();
  await audit(ctx.env.DB, a, disabled ? 'admin.user_disable' : 'admin.user_enable', 'user:' + uid);
  return json({ ok: true });
});
on('GET', '/api/admin/audit', async (ctx) => {
  need(ctx, 'admin');
  return json({ audit: (await ctx.env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()).results });
});
on('POST', '/api/admin/demo-reset', async (ctx) => {
  const a = need(ctx, 'admin'); await seedDemo(ctx.env.DB); await audit(ctx.env.DB, a, 'admin.demo_reset'); return json({ ok: true });
});

// ------------------------------------------------------------------ demo data (clearly labelled "Demo school"; reset every few hours)
const DEMO_PW_HASH_SEED = 'demo-only-not-a-login-password';
export async function seedDemo(db: D1Database) {
  const old = (await db.prepare('SELECT id FROM schools WHERE is_demo = 1').all()).results as any[];
  for (const s of old) {
    for (const t of ['marks WHERE exam_id IN (SELECT id FROM exams WHERE school_id = ?1)', 'notice_reads WHERE notice_id IN (SELECT id FROM notices WHERE school_id = ?1)', 'attendance WHERE school_id = ?1', 'payments WHERE school_id = ?1', 'charges WHERE school_id = ?1',
      'guardians WHERE student_id IN (SELECT id FROM students WHERE school_id = ?1)', 'subjects WHERE school_id = ?1', 'exams WHERE school_id = ?1', 'notices WHERE school_id = ?1', 'students WHERE school_id = ?1', 'classes WHERE school_id = ?1', 'members WHERE school_id = ?1', 'schools WHERE id = ?1'])
      await db.prepare('DELETE FROM ' + t).bind(s.id).run();
  }
  await db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE is_demo = 1)").run();
  await db.prepare("DELETE FROM users WHERE is_demo = 1").run();
  const pw = await hashPassword(DEMO_PW_HASH_SEED + randomToken(8));
  const mk = async (email: string, name: string, role: Role) => (await db.prepare('INSERT INTO users (email, name, pw_hash, role, is_demo, created_at) VALUES (?1,?2,?3,?4,1,?5) RETURNING id').bind(email, name, pw, role, now()).first<any>()).id as number;
  const owner = await mk(DEMO_OWNER, 'Sarita Adhikari (demo)', 'staff');
  const teacher = await mk(DEMO_TEACHER, 'Bikash Rai (demo)', 'staff');
  const parent = await mk(DEMO_PARENT, 'Kamala Shrestha (demo)', 'parent');
  const school = (await db.prepare("INSERT INTO schools (name, address, phone, pan, plan, is_demo, created_at) VALUES ('Demo school: Himal Bal Bikas Kendra', 'Demo address, Lalitpur', '015550000', '', 'free', 1, ?1) RETURNING id").bind(now()).first<any>()).id as number;
  await db.batch([
    db.prepare("INSERT INTO members (school_id, user_id, role, created_at) VALUES (?1, ?2, 'owner', ?3)").bind(school, owner, now()),
    db.prepare("INSERT INTO members (school_id, user_id, role, created_at) VALUES (?1, ?2, 'teacher', ?3)").bind(school, teacher, now()),
  ]);
  const classDefs: [string, number][] = [['Grade 3', 250000], ['Grade 4', 275000], ['Grade 5', 300000]];
  const names = [
    ['Aarav Shrestha', 'Aanya Gurung', 'Bibek Tamang', 'Prakriti Magar', 'Sujal Karki', 'Riya Thapa', 'Nischal Rai', 'Samikshya KC'],
    ['Pranish Lama', 'Sneha Bhandari', 'Aayush Poudel', 'Kritika Maharjan', 'Rohan Basnet', 'Anushka Limbu', 'Saugat Ghimire', 'Pooja Sherpa'],
    ['Yubraj Dahal', 'Sristi Pandey', 'Kshitiz Joshi', 'Aakriti Shahi', 'Bishal Chaudhary', 'Mamata Yadav', 'Dipesh Bhattarai', 'Sabina Tharu'],
  ];
  const today = ktmTodayIso(); const ym = bsYmOf(today)!; const prev = addBsMonths(ym, -1); const prev2 = addBsMonths(ym, -2);
  const days: string[] = []; for (let i = 0, d = Date.parse(today + 'T00:00:00Z'); days.length < 18 && i < 40; i++, d -= 86400000) { const dt = new Date(d); if (dt.getUTCDay() !== 6) days.push(dt.toISOString().slice(0, 10)); }
  const subjects = ['English', 'Nepali', 'Mathematics', 'Science', 'Social Studies'];
  const examDate = new Date(Date.parse(today + 'T00:00:00Z') - 20 * 86400000).toISOString().slice(0, 10);
  const exam = (await db.prepare("INSERT INTO exams (school_id, name, held_on, published, created_at) VALUES (?1, 'First Terminal Exam', ?2, 1, ?3) RETURNING id").bind(school, examDate, now()).first<any>()).id;
  let seq = 0; let firstStudent = 0; let firstClass = 0;
  for (let ci = 0; ci < classDefs.length; ci++) {
    const [cname, fee] = classDefs[ci];
    const cid = (await db.prepare('INSERT INTO classes (school_id, name, monthly_fee, sort, created_at) VALUES (?1,?2,?3,?4,?5) RETURNING id').bind(school, cname, fee, ci, now()).first<any>()).id as number;
    if (!firstClass) firstClass = cid;
    const subIds: number[] = [];
    for (let k = 0; k < subjects.length; k++) subIds.push((await db.prepare('INSERT INTO subjects (school_id, class_id, name, full_marks, sort) VALUES (?1,?2,?3,100,?4) RETURNING id').bind(school, cid, subjects[k], k).first<any>()).id);
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < names[ci].length; i++) {
      const n = names[ci][i]; const last = n.split(' ')[1];
      const sid = (await db.prepare(`INSERT INTO students (school_id, class_id, name, roll, gender, guardian_name, guardian_phone, family_code, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) RETURNING id`)
        .bind(school, cid, n, i + 1, i % 2 ? 'girl' : 'boy', 'Guardian ' + last + ' (demo)', '98' + String(10000000 + ci * 100 + i).padStart(8, '0'), await uniqueCode(db), now()).first<any>()).id as number;
      if (!firstStudent) firstStudent = sid;
      for (const [m, label] of [[prev2, bsYmLabel(prev2)], [prev, bsYmLabel(prev)], [ym, bsYmLabel(ym)]] as [string, string][])
        stmts.push(db.prepare("INSERT INTO charges (school_id, student_id, bs_month, kind, description, amount, created_at) VALUES (?1,?2,?3,'tuition',?4,?5,?6)").bind(school, sid, m, 'Monthly fee, ' + label, fee, now()));
      if (i === 2 || i === 5) stmts.push(db.prepare("INSERT INTO charges (school_id, student_id, bs_month, kind, description, amount, created_at) VALUES (?1,?2,?3,'transport',?4,?5,?6)").bind(school, sid, prev, 'School van, ' + bsYmLabel(prev), 120000, now()));
      const pays = i % 4 === 3 ? 1 : i % 5 === 4 ? 2 : 3 - (i % 3 === 2 ? 1 : 0);
      for (let p = 0; p < pays; p++) {
        seq++; const pd = new Date(Date.parse(today + 'T00:00:00Z') - ((2 - p) * 29 + (i % 5) + 1) * 86400000).toISOString().slice(0, 10);
        stmts.push(db.prepare("INSERT INTO payments (school_id, student_id, receipt_no, amount, method, paid_on, note, created_by, created_at) VALUES (?1,?2,?3,?4,?5,?6,'',?7,?8)")
          .bind(school, sid, `BS-${(adIsoToBs(pd) || ym).slice(0, 4)}-${String(seq).padStart(4, '0')}`, fee, ['cash', 'esewa', 'bank', 'fonepay'][(i + p) % 4], pd, owner, now()));
      }
      for (let d = 0; d < days.length; d++) {
        const r = (sid * 7 + d * 13) % 23; const st = r === 0 || r === 11 ? 'A' : r === 5 ? 'L' : 'P';
        if (d === 0 && ci === 2) continue; // Grade 5 not yet marked today
        stmts.push(db.prepare('INSERT INTO attendance (student_id, day, school_id, class_id, status, marked_by, marked_at) VALUES (?1,?2,?3,?4,?5,?6,?7)').bind(sid, days[d], school, cid, st, teacher, now()));
      }
      for (let k = 0; k < subIds.length; k++) {
        const base = 52 + ((sid * 17 + k * 29) % 46);
        stmts.push(db.prepare('INSERT INTO marks (exam_id, student_id, subject_id, marks) VALUES (?1,?2,?3,?4)').bind(exam, sid, subIds[k], (ci === 2 && i === 7 && k === 2) ? 31 : base));
      }
    }
    await db.batch(stmts);
  }
  await db.prepare('UPDATE schools SET receipt_seq = ?1 WHERE id = ?2').bind(seq, school).run();
  await db.prepare('INSERT INTO guardians (student_id, user_id, created_at) VALUES (?1, ?2, ?3)').bind(firstStudent, parent, now()).run();
  const n1 = (await db.prepare("INSERT INTO notices (school_id, class_id, title, body, pinned, created_by, created_at) VALUES (?1, NULL, 'School closed for Tihar', 'The school stays closed from Laxmi Puja to Bhai Tika. Classes resume the day after Bhai Tika at the usual time. (Demo notice)', 1, ?2, ?3) RETURNING id").bind(school, owner, now() - 86400000 * 3).first<any>()).id;
  await db.prepare("INSERT INTO notices (school_id, class_id, title, body, pinned, created_by, created_at) VALUES (?1, ?2, 'Bring a plant for the science corner', 'Grade 3 students: please bring one small potted plant this week for the science corner. (Demo notice)', 0, ?3, ?4)").bind(school, firstClass, teacher, now() - 86400000).run();
  await db.prepare("INSERT INTO notices (school_id, class_id, title, body, pinned, created_by, created_at) VALUES (?1, NULL, 'Parent-teacher meeting on Friday', 'Parents are invited to meet class teachers on Friday from 10 to 1. First Terminal report cards are now in the parent portal. (Demo notice)', 0, ?2, ?3)").bind(school, owner, now() - 3600000 * 5).run();
  await db.prepare('INSERT INTO notice_reads (notice_id, user_id, read_at) VALUES (?1, ?2, ?3)').bind(n1, parent, now()).run();
  await db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('demo_reset_at', ?1)").bind(String(now())).run();
}

// ------------------------------------------------------------------ dispatcher
export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url); const method = req.method.toUpperCase();
  try {
    if (method === 'OPTIONS') return new Response(null, { status: 405, headers: SEC_HEADERS });
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = req.headers.get('Origin');
      if (origin && origin !== url.origin) throw err(403, 'bad_origin');
      const sfs = req.headers.get('Sec-Fetch-Site');
      if (sfs && !['same-origin', 'none'].includes(sfs)) throw err(403, 'bad_origin');

    }
    await ensureSchema(env.DB);
    let body: any = {};
    if (!['GET', 'HEAD'].includes(method)) {
      const text = await req.text();
      if (text.length > 20000) throw err(413, 'too_large');
      if (text && !(req.headers.get('Content-Type') || '').startsWith('application/json')) throw err(415, 'json_required');
      if (text) { try { body = JSON.parse(text); } catch { throw err(400, 'bad_json'); } }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw err(400, 'bad_json');
    }
    const ctx: Ctx = { req, env, url, user: null, ip: req.headers.get('CF-Connecting-IP') || 'local', body, query: url.searchParams };
    ctx.user = await loadUser(ctx);
    for (const [m, re, h] of routes) {
      if (m !== method && !(method === 'HEAD' && m === 'GET')) continue;
      const match = url.pathname.match(re);
      if (match) return await h(ctx, match.slice(1).map(decodeURIComponent));
    }
    throw err(404, 'not_found');
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.code, ...(e.detail || {}) }, e.status, e.status === 429 && e.detail?.retry_after ? { 'Retry-After': String(e.detail.retry_after) } : {});
    console.error('api_error', (e && e.stack) || e);
    return json({ error: 'server_error' }, 500);
  }
}

export const SPA_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cache-Control': 'no-cache',
};
export const APP_ROUTES = /^\/(|login|register|app(\/[a-z]+)?(\/\d{1,12})?|family(\/\d{1,12})?|admin(\/[a-z]+)?|receipt\/\d{1,12}|report\/\d{1,12}\/\d{1,12}|settings|terms|privacy)$/;
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env);
    if (!env.ASSETS) return new Response('Not found', { status: 404 });
    if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return env.ASSETS.fetch(req);
    const res = await env.ASSETS.fetch(new Request(new URL('/app-shell.html', url).toString(), { method: 'GET' }));
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(SPA_HEADERS)) h.set(k, v);
    const known = APP_ROUTES.test(url.pathname.replace(/\/$/, '') || '/');
    return new Response(res.body, { status: known ? 200 : 404, headers: h });
  },
};
