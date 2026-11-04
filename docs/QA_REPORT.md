# Basta · QA_REPORT.md (Day 4, 4 Nov 2026)

Live: https://basta-school.sites.tab.bot/ · Source: https://github.com/nabinbabuuranw/basta

## 1. Automated API tests (node:test over an in-memory SQLite D1 stand-in)
`npm test` → **11/11 test groups pass** (about 150 assertions): helpers (money, BS dates, NEB grades, GPA, reminder text, phone), auth (register school/parent, validation, duplicate email, wrong password, HttpOnly Secure SameSite cookie, cross-origin POST refused 403, non-JSON body 415), school setup (classes, students, bulk paste with line errors, cross-school isolation 404), staff RBAC (teacher: attendance yes, fees/payments/new students no, dues hidden), attendance (mark, re-mark, register, future date refused, foreign student refused), fees (generate once, no double billing, class charge, receipt numbering BS-YYYY-0001, amount in words, void + double-void 409, balances), notices + parent portal (family-code link, wrong code 422, read receipts and audience count, isolation), exams (marks above full refused, publish gate for parents, teacher cannot publish, GPA 3.8 check), dashboard + admin (setup key, overview, pause a school, audit trail), demo (3 roles, labelled demo, password change locked), SPA routes + 404 + CSP header.
Production build: `tsc --noEmit` clean, `vite build` OK, worker bundle 67.6 KB, site 613 KB (fonts included).

## 2. Live E2E (Playwright, headless Chromium, against the published site)
Run 3 (the last complete run): **61 of 62 checks passed**. The one failure ("bulk paste adds students") was a race in the test (it counted rows before the list refreshed); the same students were used in the next step (roll call marked "Ram Thapa" absent, which passed), and the check now waits for the table row.
Run 4 (after the fixes) passed the first 16 checks and then stopped at the parent sign-up because the live site's own limit of 10 sign-ups per IP per hour had been reached by my test runs. That is the rate limit working, not a bug; it is noted so the result is not overstated.
Earlier finds fixed during QA: mobile menu overlay covered the close button (z-index), parents opening an office URL now go to their own family page, hero full stop wrapped onto its own line, demo payments now spread over three months so the chart is realistic.

| Check | Result |
|---|---|
| home loads with title | PASS |
| roll-call demo toggles | PASS |
| role switcher works | PASS |
| register blocks without terms | PASS |
| register lands on /app | PASS |
| class added with fee | PASS |
| teacher account created | PASS |
| family code shown | PASS |
| bulk paste adds students | FAIL |
| roll call saved | PASS |
| month register renders | PASS |
| monthly fees generated | PASS |
| receipt with amount in words | PASS |
| notice posted | PASS |
| marks above full refused | PASS |
| marks saved + published | PASS |
| parent sees linked child | PASS |
| parent opens published report card | PASS |
| parent bounced from office pages to /family | PASS |
| parent API forbidden on fees | PASS |
| notice read receipt counts the parent | PASS |
| demo banner visible | PASS |
| demo office /app/students | PASS |
| demo office /app/attendance | PASS |
| demo office /app/fees | PASS |
| demo office /app/notices | PASS |
| demo office /app/results | PASS |
| demo office /app/settings | PASS |
| student profile | PASS |
| report card page | PASS |
| no overflow /app @375 | PASS |
| no overflow /app/fees @375 | PASS |
| no overflow /app/students @375 | PASS |
| no overflow /app/results @375 | PASS |
| no overflow /app @768 | PASS |
| no overflow /app/fees @768 | PASS |
| no overflow /app/students @768 | PASS |
| no overflow /app/results @768 | PASS |
| no overflow /app @1024 | PASS |
| no overflow /app/fees @1024 | PASS |
| no overflow /app/students @1024 | PASS |
| no overflow /app/results @1024 | PASS |
| no overflow /app @1440 | PASS |
| no overflow /app/fees @1440 | PASS |
| no overflow /app/students @1440 | PASS |
| no overflow /app/results @1440 | PASS |
| teacher has no Fees tab | PASS |
| teacher API forbidden on fees | PASS |
| admin setup with key | PASS |
| admin overview | PASS |
| admin sees new school | PASS |
| admin audit trail | PASS |
| legal /terms | PASS |
| legal /privacy | PASS |
| 404 status for unknown route | PASS |
| mobile home no overflow | PASS |
| mobile menu opens | PASS |
| mobile office no overflow | PASS |
| mobile fees no overflow | PASS |
| mobile parent no overflow | PASS |
| reduced motion shows reveal content | PASS |
| no JS errors in console | PASS |

Viewports covered: 1440 desktop full pages, 375/768/1024/1440 overflow on 4 dashboard pages, 390 mobile (home, menu, office today, roll call, fees, parent). Reduced motion: reveal content visible with prefers-reduced-motion. Console: no JS errors recorded.

## 3. Security notes
PBKDF2-SHA256 (100k) password hashes; random 32-byte session tokens stored as SHA-256; HttpOnly + Secure + SameSite=Lax cookie; Origin and Sec-Fetch-Site checks on every write; JSON-only bodies, 20 KB cap; rate limits on login (per IP and per account), sign-up, demo, family-code linking, notices, password change; honeypot field; per-school scoping on every query; parents only through the guardians table; teacher role cannot reach fees; CSP `default-src 'self'`, X-Frame-Options DENY, nosniff; platform admin only via a one-time setup key (hash in code, key kept off the repo); audit log for important actions.

## 4. 30-point anti-AI UI audit
| # | Rule | Result | Note |
|---|---|---|---|
| 1 | Harsh gradients | Pass | No gradients except the skeleton shimmer. |
| 2 | Pure white backgrounds | Pass | Chalk #FBF5E9 page, card #FFFCF5. White only in print. |
| 3 | Rainbow colouring | Pass | 5 Coolors colours with fixed jobs (ink, pumpkin CTA, sun highlight, sage present/paid, teal secondary). |
| 4 | Heavy drop shadows | Pass (intentional style) | Only a solid 3px offset "press" shadow on primary buttons and stickers, no blur. It is the tactile style UI UX Pro Max picked and it presses down on click. |
| 5 | Liquid glass | Pass | None. |
| 6 | Generic purple + black | Pass | Skill suggested indigo; rejected. |
| 7 | Radial orbs | Pass | None. |
| 8 | Excessive neon | Pass | None. |
| 9 | Basic pastel palettes | Pass | Soft tints exist only as state backgrounds derived from the main colours. |
| 10 | Default Lucide icons | Pass | Own 24px icon set (Icons.tsx). |
| 11 | Emojis as UI icons | Pass | None. |
| 12 | Default Inter/Geist/Space Grotesk | Pass | Baloo 2 + Atkinson Hyperlegible, self-hosted. |
| 13 | Unnecessary sparkle icons | Pass | None. |
| 14 | Animated arrows | Pass | None. |
| 15 | Hover animations on every element | Pass | Hover = background tint on buttons and rows; motion is reserved for press, reveal, charts, tabs. |
| 16 | Repetitive three-feature-card layouts | Pass | No feature cards; 4-bell timeline and a role switcher instead. |
| 17 | Coloured left stripes on cards | Pass | None. |
| 18 | Repetitive bento grids | Pass | None. |
| 19 | Unnecessary terminal mockups | Pass | None. |
| 20 | Generic three-tier pricing | Pass | One student-count slider that shows Free or Pro. |
| 21 | Generic soft rounded corners everywhere | Pass (reasoned) | Radii are part of the sticker/school-supplies motif: 10px keys, 16px stickers, binder tabs rounded only on top, square table cells. |
| 22 | Dot-grid backgrounds | Pass | None. |
| 23 | Excessive em dashes | Pass | Copy uses full stops and commas; no em dashes in UI copy. |
| 24 | "It is not X, it is Y" copy | Pass | None. |
| 25 | Repetitive checkmark bullet lists | Pass | Numbered sun badges in the role switcher; no checkmark lists. |
| 26 | Fake testimonials | Pass | None. Demo school, names and notices are labelled demo/made-up. |
| 27 | Missing real product demo | Pass | Interactive roll-call widget on the homepage + one-click demo school as office, teacher or parent (real app, real database). |
| 28 | Missing skeleton loaders | Pass | Skeletons on every data view (SkeletonRows/Skeleton). |
| 29 | Missing Terms of Service | Pass | /terms |
| 30 | Missing Privacy Policy | Pass | /privacy |

Result: 30/30 (2 marked as intentional style with a reason: #4 and #21).

## 5. Design QA
Palette tokens only (tailwind.config.js), Baloo 2 + Atkinson self-hosted, own icon set, focus rings on every control, 44px tap targets, contrast checked (see DESIGN.md). Screenshots in screenshots/.

## 6. Known limits
No online fee payment; no SMS (WhatsApp links instead); Pro is switched on by hand; one school per staff account; report card layout is one design; not connected to IEMIS or any board; the demo school resets every 3 hours.


## 7. Follow-up check (06:28 UTC, Nov 4)
The one failing E2E check (bulk paste) was re-run alone on the live site, signed in as the demo school office: pasting 2 students showed "2 students added" and the new row appeared in the table. PASS. (The two test students sit in the demo school until its 3-hour reset.)
