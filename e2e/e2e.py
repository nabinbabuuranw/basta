# Live E2E for Basta against the published site. Usage: python3 e2e/e2e.py <base_url> <out_dir> <setup_key_file>
import sys, json, time, random, string, re
from playwright.sync_api import sync_playwright
BASE = sys.argv[1].rstrip('/'); OUT = sys.argv[2]; KEYF = sys.argv[3] if len(sys.argv) > 3 else None
results = []; errors = []
def ok(name, cond, detail=''):
    results.append({'check': name, 'pass': bool(cond), 'detail': str(detail)[:200]}); print(('PASS ' if cond else 'FAIL ') + name, detail if not cond else '')
tag = ''.join(random.choices(string.ascii_lowercase, k=6)); PW = 'E2eSchool2083'
email_o = f'office-{tag}@e2e.basta.test'; email_p = f'parent-{tag}@e2e.basta.test'
def shot(page, name, full=True): page.screenshot(path=f'{OUT}/{name}.png', full_page=full)
def overflow(page): return page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/'); page.wait_for_selector('text=packed in one bag'); time.sleep(1.2)
    ok('home loads with title', 'Basta' in page.title(), page.title())
    btn = page.get_by_role('button', name=re.compile('Aarav')); btn.click()
    ok('roll-call demo toggles', btn.get_attribute('aria-pressed') == 'true')
    shot(page, 'd-home-top', full=False)
    for y in range(0, 9000, 700): page.mouse.wheel(0, 700); time.sleep(0.12)
    time.sleep(0.8); shot(page, 'd-home-full')
    page.get_by_role('tab', name=re.compile('Parent')).first.click(); ok('role switcher works', page.get_by_text('Report card with letter grades').count() > 0)
    page.fill('#students', '200') if False else None
    # register a school
    page.goto(BASE + '/register'); page.fill('#school_name', f'E2E Test Academy {tag}'); page.fill('#name', 'E2E Office'); page.fill('#remail', email_o); page.fill('#rpw', PW)
    page.get_by_role('button', name='Create school account').click(); ok('register blocks without terms', page.get_by_text('Please accept the Terms').count() > 0)
    page.check('input[type=checkbox]'); page.get_by_role('button', name='Create school account').click()
    page.wait_for_url('**/app', timeout=20000); ok('register lands on /app', page.url.endswith('/app'))
    page.goto(BASE + '/app/settings'); page.wait_for_selector('#cn'); page.fill('#cn', 'Grade 1'); page.fill('#cf', '2500'); page.get_by_role('button', name='Add', exact=True).click()
    page.wait_for_selector('text=Rs 2,500'); ok('class added with fee', True)
    page.fill('#tn', 'E2E Teacher'); page.fill('#te', f'teacher-{tag}@e2e.basta.test'); page.get_by_role('button', name='Add teacher').click(); page.wait_for_selector('text=First password'); ok('teacher account created', True)
    page.goto(BASE + '/app/students'); page.get_by_role('button', name='Add student').click(); page.fill('#sn', 'Sita Tamang'); page.fill('#sr', '1'); page.fill('#gn', 'Hari Tamang'); page.fill('#gp', '9801234567')
    page.get_by_role('dialog').get_by_role('button', name='Add student').click(); page.wait_for_selector('text=Added to the bag')
    code = page.locator('.tracking-\\[0\\.2em\\]').inner_text().strip(); ok('family code shown', re.fullmatch(r'[A-Z0-9]{8}', code), code)
    page.keyboard.press('Escape')
    page.get_by_role('button', name='Paste a list').click(); page.fill('#br', 'Ram Thapa, 2, Gopal Thapa, 9811111111\nGita Rai, 3, Maya Rai, 9822222222'); page.get_by_role('button', name='Add 2 students').click()
    page.wait_for_selector('text=2 students added'); page.wait_for_selector('td >> text=Ram Thapa'); ok('bulk paste adds students', True)
    page.goto(BASE + '/app/attendance'); page.wait_for_selector('text=Not saved yet'); time.sleep(0.5)
    if page.get_by_role('button', name=re.compile('Ram Thapa')).count() == 0: print('DEBUG', page.locator('main').inner_text()[:500])
    page.get_by_role('button', name=re.compile('Ram Thapa')).click()
    page.get_by_role('button', name='Save roll call').click(); page.wait_for_selector('text=Saved · 1 absent'); ok('roll call saved', True)
    page.get_by_role('tab', name='Month register').click(); page.wait_for_selector('text=Columns are days'); ok('month register renders', True)
    page.goto(BASE + '/app/fees'); page.wait_for_selector('text=fees are not generated yet'); page.get_by_role('button', name='Monthly fees').click(); page.get_by_role('button', name='Add monthly fees').click()
    page.wait_for_selector('text=monthly fees added'); page.wait_for_selector('text=Who owes (3)'); ok('monthly fees generated', True)
    page.get_by_role('button', name='Take payment').first.click(); page.get_by_role('button', name=re.compile('Issue receipt')).click(); page.wait_for_selector('text=Receipt issued')
    page.get_by_role('dialog').get_by_role('link', name='Print', exact=True).click(); page.wait_for_selector('text=Two Thousand Five Hundred'); ok('receipt with amount in words', True); shot(page, 'd-e2e-receipt')
    page.goto(BASE + '/app/notices'); page.get_by_role('button', name='New notice').click(); page.fill('#nt', 'Sports day'); page.fill('#nb', 'Wear house colours on Friday.'); page.get_by_role('button', name='Post notice').click()
    page.wait_for_selector('text=0 of 0 guardians opened'); ok('notice posted', True)
    page.goto(BASE + '/app/results'); page.get_by_role('button', name='Add an exam').click(); page.fill('#en', 'First Terminal'); page.get_by_role('button', name='Add exam').click()
    page.wait_for_selector('#sbn'); page.fill('#sbn', 'Maths'); page.get_by_role('button', name='Add subject').click(); page.wait_for_selector('text=of 100')
    inp = page.get_by_label('Sita Tamang Maths'); inp.fill('120'); page.get_by_role('button', name='Save marks').click(); page.wait_for_selector('text=Please check the marks'); ok('marks above full refused', True)
    inp.fill('92'); page.get_by_label('Ram Thapa Maths').fill('64'); page.get_by_label('Gita Rai Maths').fill('30'); page.get_by_role('button', name='Save marks').click(); page.wait_for_selector('text=Marks saved')
    page.get_by_role('button', name='Publish to parents').click(); page.wait_for_selector('text=Parents can see it'); ok('marks saved + published', True)
    page.get_by_role('button', name='Sign out').click(); page.wait_for_url(BASE + '/')
    # parent registers with the family code
    page.goto(BASE + '/register?as=parent'); page.fill('#name', 'Hari Tamang'); page.fill('#remail', email_p); page.fill('#rpw', PW); page.fill('#fc', code); page.check('input[type=checkbox]')
    page.get_by_role('button', name='Create parent account').click(); page.wait_for_url('**/family', timeout=20000); page.wait_for_selector('text=Sita Tamang')
    ok('parent sees linked child', page.get_by_text('Present').count() > 0)
    page.get_by_role('tab', name=re.compile('Notices')).click(); page.get_by_text('Sports day').click(); time.sleep(1)
    page.get_by_role('tab', name=re.compile('Results')).click(); page.get_by_text('Open report card').click(); page.wait_for_selector('text=Progress report'); ok('parent opens published report card', page.get_by_text('A+').count() > 0)
    page.goto(BASE + '/app/fees'); time.sleep(3); pth = page.evaluate('location.pathname'); ok('parent bounced from office pages to /family', pth == '/family', pth)
    r = page.request.get(BASE + '/api/fees'); ok('parent API forbidden on fees', r.status == 403, r.status)
    page.goto(BASE + '/'); page.get_by_role('link', name=re.compile('Open my family')).click(); page.get_by_role('button', name='Sign out').click()
    # office sees read receipt
    page.goto(BASE + '/login'); page.fill('#email', email_o); page.fill('#password', PW); page.get_by_role('button', name='Sign in').click(); page.wait_for_url('**/app')
    page.goto(BASE + '/app/notices'); page.wait_for_selector('text=1 of 1 guardians opened'); ok('notice read receipt counts the parent', True)
    page.get_by_role('button', name='Sign out').click()
    # demo office screenshots
    page.goto(BASE + '/login'); page.get_by_role('button', name='Office').click(); page.wait_for_url('**/app'); page.wait_for_selector('text=Classes today'); time.sleep(1.2)
    ok('demo banner visible', page.get_by_text('Demo school with made-up students').count() > 0)
    shot(page, 'd-demo-today')
    for path, wait, name in [('/app/students', 'Aarav Shrestha', 'd-demo-students'), ('/app/attendance', 'Save roll call', 'd-demo-rollcall'), ('/app/fees', 'Who owes', 'd-demo-fees'), ('/app/notices', 'School closed for Tihar', 'd-demo-notices'), ('/app/results', 'GPA', 'd-demo-results'), ('/app/settings', 'Classes and monthly fees', 'd-demo-settings')]:
        page.goto(BASE + path); page.wait_for_selector(f'text={wait}'); time.sleep(0.8); shot(page, name); ok('demo office ' + path, True)
    page.goto(BASE + '/app/students'); page.get_by_role('link', name='Aarav Shrestha').first.click(); page.wait_for_selector('text=Family code for the parent app'); time.sleep(0.6); shot(page, 'd-demo-student'); ok('student profile', True)
    page.goto(BASE + '/app/results'); page.get_by_role('link', name=re.compile('Report card for')).first.click(); page.wait_for_selector('text=Progress report'); time.sleep(0.5); shot(page, 'd-demo-report'); ok('report card page', True)
    page.goto(BASE + '/app/attendance'); page.get_by_role('tab', name='Month register').click(); page.wait_for_selector('text=Columns are days'); shot(page, 'd-demo-register')
    for w in [375, 768, 1024, 1440]:
        page.set_viewport_size({'width': w, 'height': 900})
        for path in ['/app', '/app/fees', '/app/students', '/app/results']:
            page.goto(BASE + path); time.sleep(1.0); ok(f'no overflow {path} @{w}', overflow(page) <= 0, overflow(page))
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(BASE + '/'); page.get_by_role('button', name=re.compile('Sign out|Open my')).first.click() if False else None
    # teacher demo RBAC
    page.request.post(BASE + '/api/auth/logout', headers={'Content-Type': 'application/json'}, data='{}')
    page.goto(BASE + '/login'); page.get_by_role('button', name='Teacher').click(); page.wait_for_url('**/app'); page.wait_for_selector('text=Classes today')
    ok('teacher has no Fees tab', page.locator('nav[aria-label="School sections"] >> text=Fees').count() == 0)
    r = page.request.get(BASE + '/api/fees'); ok('teacher API forbidden on fees', r.status == 403, r.status)
    page.request.post(BASE + '/api/auth/logout', headers={'Content-Type': 'application/json'}, data='{}')
    page.goto(BASE + '/login'); page.get_by_role('button', name='Parent').click(); page.wait_for_url('**/family'); page.wait_for_selector('text=Aarav Shrestha'); time.sleep(1); shot(page, 'd-demo-parent')
    page.get_by_role('tab', name=re.compile('Fees')).click(); time.sleep(0.4); shot(page, 'd-demo-parent-fees')
    # admin
    if KEYF:
        key = open(KEYF).read().strip(); ae = f'admin-{tag}@e2e.basta.test'
        r = page.request.post(BASE + '/api/setup', headers={'Content-Type': 'application/json'}, data=json.dumps({'key': key, 'email': 'admin@basta-school.np', 'name': 'Platform Admin', 'password': open(KEYF.replace('setup_key.txt', 'admin_pw.txt')).read().strip()}))
        ok('admin setup with key', r.status == 200, r.status)
        page.request.post(BASE + '/api/auth/logout', headers={'Content-Type': 'application/json'}, data='{}')
        page.goto(BASE + '/login'); page.fill('#email', 'admin@basta-school.np'); page.fill('#password', open(KEYF.replace('setup_key.txt', 'admin_pw.txt')).read().strip()); page.get_by_role('button', name='Sign in').click()
        page.wait_for_url('**/admin'); page.wait_for_selector('text=Active students'); shot(page, 'd-admin'); ok('admin overview', True)
        page.goto(BASE + '/admin/schools'); page.wait_for_selector(f'text=E2E Test Academy {tag}'); ok('admin sees new school', True)
        page.goto(BASE + '/admin/audit'); page.wait_for_selector('text=payment.add'); shot(page, 'd-admin-audit'); ok('admin audit trail', True)
    # legal + 404
    for path, txt in [('/terms', 'What Basta is not'), ('/privacy', 'What we do not do')]:
        page.goto(BASE + path); page.wait_for_selector(f'text={txt}'); ok('legal ' + path, True)
    resp = page.goto(BASE + '/no-such-page'); ok('404 status for unknown route', resp.status == 404, resp.status)
    ctx.close()
    # mobile
    m = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); mp = m.new_page()
    mp.on('pageerror', lambda e: errors.append(str(e)))
    mp.goto(BASE + '/'); mp.wait_for_selector('text=packed in one bag'); time.sleep(1); shot(mp, 'm-home-top', full=False)
    for y in range(0, 12000, 700): mp.mouse.wheel(0, 700); time.sleep(0.1)
    shot(mp, 'm-home-full'); ok('mobile home no overflow', overflow(mp) <= 0, overflow(mp))
    mp.get_by_role('button', name='Open menu').click(); time.sleep(0.4); shot(mp, 'm-menu', full=False); ok('mobile menu opens', mp.locator('#mnav').count() == 1); mp.get_by_role('button', name='Close menu').click()
    mp.goto(BASE + '/login'); mp.get_by_role('button', name='Office').click(); mp.wait_for_url('**/app'); mp.wait_for_selector('text=Classes today'); time.sleep(1); shot(mp, 'm-demo-today'); ok('mobile office no overflow', overflow(mp) <= 0, overflow(mp))
    mp.goto(BASE + '/app/attendance'); mp.wait_for_selector('text=Save roll call'); time.sleep(0.6); shot(mp, 'm-demo-rollcall', full=False)
    mp.goto(BASE + '/app/fees'); mp.wait_for_selector('text=Who owes'); time.sleep(0.6); shot(mp, 'm-demo-fees'); ok('mobile fees no overflow', overflow(mp) <= 0, overflow(mp))
    mp.request.post(BASE + '/api/auth/logout', headers={'Content-Type': 'application/json'}, data='{}')
    mp.goto(BASE + '/login'); mp.get_by_role('button', name='Parent').click(); mp.wait_for_url('**/family'); mp.wait_for_selector('text=Aarav Shrestha'); time.sleep(1); shot(mp, 'm-demo-parent'); ok('mobile parent no overflow', overflow(mp) <= 0, overflow(mp))
    m.close()
    # reduced motion
    rm = b.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce'); rp = rm.new_page(); rp.goto(BASE + '/'); rp.wait_for_selector('text=packed in one bag')
    op = rp.evaluate("getComputedStyle(document.querySelector('.reveal')).opacity"); ok('reduced motion shows reveal content', op == '1', op)
    rm.close(); b.close()
real_errors = [e for e in errors if 'Failed to load resource' not in e]
ok('no JS errors in console', not real_errors, real_errors[:3])
json.dump({'base': BASE, 'passed': sum(r['pass'] for r in results), 'total': len(results), 'results': results, 'console_errors': errors[:20]}, open(f'{OUT}/e2e-result.json', 'w'), indent=1)
print('E2E', sum(r['pass'] for r in results), '/', len(results))
