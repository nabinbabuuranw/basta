# Basta (बस्ता) · DESIGN.md (Day 4)

## 1. Research (industry, audience, purpose)
- Product: fee, attendance, notice and report-card portal for small private schools in Nepal (backlog #4 "Pathshala").
- Name check (search, 4 Nov 2026): "Pathshala" is taken many times in Nepal: Paathshala (paathshala.com.np), Hamro Paathshala (hamropaathshala.com), Smart Pathshala (App Store), Digital Pathshala Nepal (DP-LMS), Paathshala EMIS (Play Store). "Digital Ghanti" also exists, and "Hajiri" is a Nepali attendance-device app. Renamed to **Basta** (बस्ता, the school bag every Nepali child carries). No Nepali school product called Basta was found. Unrelated products with the same word exist abroad (BASTA language app, eBasta e-book platform by C-DAC India).
- Audience: owners, principals and accountants of private schools with 30 to 600 students (Kathmandu Valley and the Terai), class teachers on mid/low-end Android phones, and parents of every literacy level, in Nepali and English. Mobile-first, readable, big tap targets, BS dates.
- Existing tools found (search): Veda, NepalSchoolHub, Natija, Paathshala, Hamro Paathshala, Digital Pathshala, SupportMeNepal, Nimble Infosys, Nexalaris. All are full ERP/LMS suites sold to schools. Opportunity: a free, small, honest tool that does the four daily jobs well.

## 2. UI UX Pro Max (run, output in design-proof/uiuxpromax-*)
`python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "school fee attendance notice parent portal education SaaS nepal" --design-system --persist -p "Basta"`
- Pattern suggested: Feature-Rich Showcase. Style suggested: **Claymorphism** (chunky, tactile, thick borders, best for educational apps). Typography: **Baloo 2** / Comic Neue. Colours suggested: indigo + orange (indigo REJECTED: purple family, anti-AI rule 6).
- Taken: the tactile direction (flattened: solid offset "press" shadows, thick 2px ink borders, no blur, no 3D gradients), Baloo 2 (it also covers Devanagari). Rejected: Comic Neue (replaced by Atkinson Hyperlegible for low-vision readability), indigo palette, social-proof/logos section (we have none and will not fake it).
- Checklist followed: SVG icons (own set), 44px tap targets, focus rings, 4.5:1 text contrast, reduced motion, 375/768/1024/1440.

## 3. 21st.dev (searches saved in design-proof/21st-*)
- Searches: "attendance tracker grid" (24924, 30542, 25158, 15605), "notice board announcement" (539, 674, 23625, 3905), "report card grades" (6153, 30666, 5409, 28344), "school dashboard stats" (19070, 13218, 35089, 28770).
- `21st get 30542` (Heat Calendar, ssychui): used as the idea for the parent's month attendance calendar (coloured day cells, legend, hover readout). Rebuilt from scratch in our tokens; no code copied. 1 of 2 daily gets used.

## 4. Coolors (signed in on Nabin's account, screenshots in design-proof/coolors-*)
- Browsed signed in: trending, popular/green, popular/orange, popular/teal, popular/yellow (5 screenshots). Shortlisted: 264653-2a9d8f-e9c46a-f4a261-e76f51 and 2c6e49-4c956c-fefee3-ffc9b9-d68c45.
- **PICK: "Sunrise Glow" https://coolors.co/palette/233d4d-fe7f2d-fcca46-a1c181-619b8a** (not in palettes_log.md). Pencil yellow, school-bag orange, chalkboard green.
- Mapping: ink/primary #233D4D · accent pumpkin #FE7F2D (fills with ink text, 4.49:1, used on 16px bold buttons and large text; text-safe pumpkin-ink #A8471B 5.4:1) · highlight sun #FCCA46 · present/paid sage #A1C181 (ink text 5.67:1; sage-ink #3F6B2A) · secondary teal #619B8A (fills; text-safe #3F6F61 5.29:1) · background chalk #FBF5E9 (no pure white) · surface card #FFFCF5 · sunk #F3EBDB · border ink 2px / line #E2D7C1 · absent #B23A1E.
- Contrast: ink on chalk 10.48:1, white-ish chalk on ink 11.4:1, ink on sun 7.41:1.

## 5. Typography, tokens, layout plan
- Type: Baloo 2 500–800 (display, Latin + Devanagari, self-hosted woff2) + Atkinson Hyperlegible 400/700 (body). Tabular numbers for money.
- Radius: 10px controls ("key"), 14–16px cards ("tag"/sticker), pills for chips. Shadows: solid 3px offset ink only on primary buttons and stickers (press-down on click). Not used on every card.
- Motif: the **name-label sticker** (dashed inner border, "Name / Class / Roll" ruled lines) used for student profile, report card, family code; **tally marks** (four strokes + orange cross-stroke) for attendance; **binder divider tabs** for dashboard navigation; school bell icon that swings when roll call changes.
- Homepage structure (new): sticky bar with a "satchel strap" scroll-progress line → hero (headline with hand-drawn underline + Nepali line, interactive roll-call widget) → "One school day" 4-bell timeline whose line fills with scroll (reverses on scroll up) → role switcher (Office / Teacher / Parent tabs with product snippets) → report card specimen + grade table on a teal band → pricing slider (student count → Free or Pro) → FAQ disclosures → sun CTA sticker → ink footer with big wordmark.
- Dashboard (new): binder divider tabs attached to a panel (Today, Students, Roll call, Fees, Notices, Results, School); Today = 3 stat tags → classes-today list with tallies + latest notices → 6-month billed/collected bar chart. Parent: single-column child sticker with Today/Fees-due tiles and a 4-segment section bar (Attendance calendar, Fees, Notices, Results). Admin: dark top bar + the same binder tabs.
- Motion: hero fade-up + self-drawing underline, scroll reveal that reverses, timeline fill tied to scroll, role panel pop-in, bar charts grow, calendar cells pop in, button press-down, modal pop-in, bell swing. All disabled under prefers-reduced-motion.
