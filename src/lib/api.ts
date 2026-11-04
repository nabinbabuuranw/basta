// Thin fetch wrapper: same-origin JSON, cookie session, typed errors.
export class ApiError extends Error {
  status: number; code: string; field?: string; data: any;
  constructor(status: number, data: any) { super(data?.error || 'request_failed'); this.status = status; this.code = data?.error || 'request_failed'; this.field = data?.field; this.data = data; }
}
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method, credentials: 'same-origin', signal: opts.signal,
      headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : method !== 'GET' ? '{}' : undefined,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, { error: 'network' });
  }
  const text = await res.text(); let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: 'bad_response' }; }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
/** Download a CSV from the API through a blob (keeps the session cookie, no new window). */
export async function download(path: string, filename: string) {
  const res = await fetch('/api' + path, { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status, { error: 'download_failed' });
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const FIELD: Record<string, string> = {
  name: 'name', email: 'email', password: 'password (8+ characters with a letter and a number)', phone: 'phone number (98XXXXXXXX)', kind: 'account type',
  school_name: 'school name', family_code: 'family code (8 letters/numbers from the school)', code: 'family code (8 letters/numbers)', class_id: 'class', roll: 'roll number',
  gender: 'gender', guardian_name: 'guardian name', guardian_phone: 'guardian phone (98XXXXXXXX)', monthly_fee: 'monthly fee', rows: 'student list', date: 'date',
  marks: 'marks (between 0 and full marks)', amount: 'amount (at least Rs 1)', method: 'payment method', paid_on: 'payment date (today or earlier)', note: 'note', month: 'month',
  reason: 'reason', title: 'title', body: 'message', description: 'description', held_on: 'exam date', full_marks: 'full marks (10 to 200)', pan: 'PAN (9 digits)', address: 'address',
  status: 'status', student_id: 'student', plan: 'plan',
};
const MESSAGES: Record<string, string> = {
  network: 'Could not reach Basta. Check your connection and try again.',
  bad_credentials: 'That email and password do not match.',
  account_disabled: 'This account has been disabled.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  email_taken: 'An account with this email already exists. Try signing in.',
  not_found: 'We could not find that.', forbidden: 'You do not have access to this.', not_signed_in: 'Please sign in first.', owner_only: 'Only the school office account can do this.',
  no_school: 'This staff account is not attached to a school any more.', school_disabled: 'This school account is paused. Contact Basta support.',
  server_error: 'Something went wrong on our side. Please try again.',
  plan_limit: 'The Free plan covers 60 active students. Ask for Basta Pro to add more.',
  class_exists: 'A class with this name already exists.', class_has_students: 'Move or remove the students in this class first.',
  future_date: 'Attendance cannot be marked for a future date.', too_far_ahead: 'You can generate fees up to next month only.',
  already_void: 'This was already cancelled.', no_students: 'There are no active students in that class.',
  demo_locked: 'The demo account cannot change its password.', too_many_classes: 'A school can have up to 30 classes.', too_many_staff: 'Up to 40 staff accounts per school.',
  too_many_subjects: 'Up to 15 subjects per class.', cannot_change_self: 'You cannot change your own admin account here.', json_required: 'Please try again.',
};
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'invalid' && e.field) return 'Please check the ' + (FIELD[e.field] || e.field) + (e.data?.line ? ` (line ${e.data.line})` : '') + '.';
    return MESSAGES[e.code] || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
export type Role = 'parent' | 'staff' | 'admin';
export interface User { id: number; email: string; name: string; phone: string | null; role: Role; is_demo: number }
export interface SchoolRef { id: number; name: string; plan: string; is_demo: number; srole: 'owner' | 'teacher' }
