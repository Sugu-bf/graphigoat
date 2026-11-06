# GraphiGOAT · launch version (Nov. 5, 2026)

## Rep version (Nov. 5, afternoon): replaces the manufacturer page

- **Target:** lighting rep agencies, US and Canada (NSL and Magic Lite reps first). Offer: a free first-screen mockup of
  their new homepage, from their current site, in 48 h, nothing to prepare, theirs to keep.
- **Art direction: "lit like a product".** Light showroom backdrop, the GraphiGOAT emblem as a 3D object under one beam
  (the beam narrows on scroll), the offer as spec callouts around it, then an example mockup on a laptop and a phone
  (clearly marked "Example").
- **Brand files:** `public/brand/emblem.svg`, `emblem-edge.svg` (3D edges), `wordmark.svg`, taken from Mohamed's traced
  logo (the old slogan is left out). Favicon = the emblem.
- **Type:** Work Sans Light for titles, Parkinsans for text (chosen by Mohamed), JetBrains Mono for labels, local woff2 in `src/fonts/` (OFL).
- **Commitment line, not confirmed yet: removed from the published version (Nov. 5).** To restore it once Mohamed says
  yes, add it as a second paragraph in `.price__text`, without `data-tbc`:
  EN "You pay the first stage only after you've approved the mockup." / FR "Vous ne payez la première étape qu'après
  avoir approuvé la maquette."
- **Copy is a working draft:** Mohamed rewrites it. Slogan proposal in the footer: "Win the line. Win the spec. Win the job."
- **Local preview for this version:** server `launch-dev-reps` (port 5197) in `../.claude/launch.json`.

### Work room "Scroll to turn the room" (section 02, after the offer)

- Taken from the archived v2 (`effects/pano`, `effects/work-media`), restyled for this site. Cards are `.wcard`
  (`.card` is the proof cards). Large screens with motion: the room; phones: a vertical list; reduced motion: fixed
  cards (two columns on large screens), videos paused with a Play button. The index under the room is real buttons.
- Fixed from v2: the loops never became visible (`is-playing` is set on the figure, the CSS waited for it on the video).
- Projects: Kaliva (Live), Zyllow (Pre-launch), Nassa Energy Plus (Delivered), a dental clinic (Concept, not a client).
  **Left out:** SEINAR (a real client, permission not given) and GR Motorcycle (needs Mohamed's confirmation).
- The clinic's media were rebuilt from the archived capture with the clinic's name covered (it appeared twice), and
  live in `public/media/work/clinic/`, so the name is not in the URLs either.
- "Datasheet" opens a `<dialog>` filled from a `<template>`; a button without a sheet removes itself. Only verified
  figures (sources read-only): Kaliva 147 back-end tests (`livraison-dev-2026-10-24/LISEZ-MOI-DEV.md`); Zyllow CLS 0 in
  its QA reports; Nassa 8 KB hero and the 8-blocker diagnosis (`neplus/Nassa-Energy-Plus-V2/docs/BRIEF.md`); clinic 73/73
  e2e, 245 KB, axe (`atm-flagship-livraison-v1/docs`). Dropped as unverified: Kaliva 28 routes / 19 notifications,
  Zyllow LCP 1.35 s / 12 runs, Nassa LCP 0.14 s / two social ads.

- **Live (temporary address):** https://graphigoat-launch.netlify.app (FR: `/fr/`, Upwork mode: `?via=upwork`)
- **Netlify site:** `graphigoat-launch` (id `f9a4d344-4678-4dff-a542-488139bff98a`). Custom domain `graphigoat.com` and alias `www.graphigoat.com` are attached. HTTPS starts once the DNS points to Netlify.
- **Forms:** `contact` (EN) and `contact-fr` (FR), detected by Netlify. Submissions appear in Netlify > Forms.
- **Redeploy:** `npm run build`, then `npx netlify-cli@27.16.2 deploy --site f9a4d344-4678-4dff-a542-488139bff98a --prod --dir dist --no-build`

## Switching graphigoat.com to the new site (Cloudflare > DNS)

Before changing anything, take a screenshot of the current records: that is your way back to the old site.

1. Delete the **A** and **AAAA** records for `graphigoat.com` (`@`) and for `www`.
2. Add **A** `@` → `75.2.60.5`, proxy **off** (grey cloud, "DNS only").
3. Add **CNAME** `www` → `graphigoat-launch.netlify.app`, proxy **off**.
4. **Do not touch** the MX records (`mx1/mx2.hostinger.com`) or the TXT records: your email depends on them.

Netlify issues the HTTPS certificate automatically once the records resolve, usually within minutes. The old site stays on Hostinger, untouched.

## Positioning and facts used

- Positioning: "Get your fixtures specified." Target: mid-size architectural lighting manufacturers in the US and Canada that sell by specification. Europe comes later.
- Facts: Upwork, read Nov. 4–5, 2026.
  - Magiclite ltd.: 1,107 h, May 2024 – Dec 2025, 5/5, verbatim review, hired again in May 2026.
  - "Lighting Technical Datasheet Expert (FR/EN)", ongoing since Feb. 2026. The client is not named.
  - Bill 96 and Health Canada packaging contracts. Clients not named.
  - Profile: Top Rated, 77 jobs, 56 reviews, 1,351 h.
- Bill 96 footnote: Mondaq and JD Supra summaries of the June 1, 2025 changes. Not legal advice.
- Promise kept on the site (Mohamed's choice): a free timing audit of the IES file for anyone who sends their site.

## Still to do (next week, with the ICP study)

- Add NSL and other clients, once their facts are known.
- Run the audit of 30 to 50 brands. The ICP study refines the copy.
- Add the v3 signature idea from the concept lab (`../graphic-goat-site/docs/LABORATOIRE.md`).
- Google Search Console: add the domain and request indexing.
