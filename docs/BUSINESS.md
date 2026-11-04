# Basta · BUSINESS.md (Day 4)

## Customers
Private (institutional) schools in Nepal with roughly 30 to 600 students, especially pre-primary to grade 8 schools that still run on a fee register, an attendance copy and a diary. Decision maker: owner/principal; daily users: accountant, class teachers; viewers: parents.

## Problems
- Fee collection is the school's cash flow, and dues are tracked in paper ledgers; reminders are phone calls.
- Parents ask "was my child in school today?" and "how much do I owe?" by phone.
- Notices go in diaries that are not read; nobody knows who saw them.
- Report cards are typed by hand in Word/Excel; grade/GPA mistakes happen.

## Competitors seen (search, Nov 4 2026; prices not checked)
Veda, NepalSchoolHub (NSH LMS), Natija, Paathshala / Paathshala EMIS, Hamro Paathshala, Digital Pathshala (DP-LMS), SupportMeNepal, Nimble Infosys, Nexalaris. They are full ERP/LMS suites, usually sold with setup and training. Basta does not try to match them feature for feature.

## USP
- Free for a school with up to 60 students, no card, no setup visit.
- Four daily jobs only (roll call, fees + receipts, notices with read counts, report cards), set up in about 15 minutes.
- Teachers cannot see money; parents see only their own child (role-based by design).
- WhatsApp reminders in Nepali or English from the office's own phone: no SMS cost.
- Bikram Sambat dates throughout, NEB/CDC letter grades, receipts with amount in words.

## Pricing (NPR)
- Basta Free: Rs 0, up to 60 active students, every feature.
- Basta Pro: Rs 1,499 per month per school (or Rs 14,990 per year), up to 600 students, priority WhatsApp help. Switched on manually by the platform admin; no online checkout yet.
- Possible add-ons later: printed ID-card / report-card layouts, SMS credits at cost, data import service (one-time Rs 2,000 to 5,000).

## Monetization and recurring potential (targets, not guarantees)
NPR 30,000/month = about 20 Pro schools. NPR 100,000/month = about 67 Pro schools. Nepal has thousands of institutional schools, so the market is large enough; the hard part is distribution and trust.

## Acquisition
- Door-to-door demos in one area (e.g. Inaruwa/Itahari, then Kathmandu Valley) with the live demo school on a phone.
- Private school associations (PABSON/N-PABSON) meetups and Facebook groups of school owners.
- Referral: one month of Pro for each referred school.
- Parents as a channel: the parent app makes the school look modern, which is the owner's selling point to parents.

## Operating cost
$0 on the current free hosting tier (one Cloudflare Worker + D1 database through Tab's publishing). No paid APIs, no SMS, no domain. Free-tier limits (requests, D1 storage) would need a paid tier only after many schools join; this will be flagged before any spend.

## Limits and honesty
Not connected to IEMIS or any board; grade bands follow the published letter-grading table and must be checked against the board's latest rules. No online fee payment (needs a payment-provider agreement). Expenses so far $0. Revenue Rs 0.
