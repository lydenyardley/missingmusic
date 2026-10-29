# Missing Music public site

This directory is the source of truth for the public companion site at https://lydenyardley.github.io/missingmusic/.

The site is static HTML/CSS/vanilla JavaScript. It has no build step and no analytics or advertising SDK.

## Pages

| Path | Purpose |
|---|---|
| `index.html` | Home discography demo, feature index, edition climax, Free CTA |
| `features.html` | Catalogue-first custom + Missing reports, samples, Wishlist, desktop/themes/a11y band, scan-to-reports guide, trust notes |
| `pricing.html` | Lean paid-tier comparison matrix (Standard / Pro / Family), Features link for depth, Free demo card, FAQ |

The shared header contains the Missing Music brand, Features, and Pricing. Under 620px the nav collapses behind a **Menu** button (`[data-nav-toggle]` + `#site-nav`, driven by `site.js`) so nothing is clipped; without JavaScript the nav stays visible and the links never disappear. Download actions live in each page's body so the small-screen navigation stays calm. Every download action says **Download the demo** and points to GitHub's latest-release route; the page keeps the copy honest while no stable installer is available.

Header and hero chrome follow one rule: the hero stack is CTA, then the offer note. The local-files sentence lives in the features Trust card (“Your files stay local…”), not under the home or features hero. The pricing hero carries one merged offer line ("Free 10-artist try · no account, ads or subscription · Windows now, Linux and macOS soon") rather than stacking a trust line and a platform note under the buttons; do not split it again. **Verify SHA-256** lives in the footer’s *Trust and installer notes* link, and the JS-filled release note has exactly one home — a `[data-release-note]` paragraph in the footer. Do not reintroduce an always-empty slot in a hero.

Hero fine print on features and pricing is left-aligned with the buttons. Only copy that is centred on purpose (the home pricing preview) keeps `text-align: center`.

Shot pairs (`features.html`, the edition row on home) bleed to the window edge and no further. Past `--maxw` the frame's peek collapses to `0px` because the gutter alone already spans the distance from the column edge to the window edge; adding the peek pushed the right edge to 1484px at a 1440px window. Keep the bleed inside the clipped page (`html`/`body` carry `overflow-x: clip`) and keep the frame's outer edge at or inside the viewport.

The gap wall (`.disc-demo__grid`) drops to three columns at and below 900px so phones show six tiles in two rows, with titles truncated to one line. Its base grid is declared after the shared breakpoints, so any new column count belongs next to that base rule, not inside the earlier media queries.

## Proof assets

The hero proof is an actual Library UI capture, shipped 2026-09-22 (dark + bronze, owned and missing rows). It is the **full application window**: the 1920×1140 capture, proportionally scaled to **1440×855**, true-color PNG (not a 256-color palette). Window chrome stays intact. The site's hero `alt` text and `og:image` point at this file (former backlog task PS-05).

That 1440×855 file is the crispness ceiling. A 125% or 200% display paints more device pixels than the file contains, so the window looks soft. CSS does not enlarge it past 1440px. A sharper hero needs the unscaled 1920×1140 master, or a new capture at the size the page shows times the display scale.

**Framing rule (owner, 2026-10-09):** every proof is either the **full application window** or a **tight crop of the feature**. A full window may be scaled proportionally. Do not shave the title bar, nav, or window edges to hit 1440×900 or 16:9. A tight crop is the dialog, report table, or popover, with the surrounding window gone, not a window with a few pixels missing.

**Shipped 2026-09-22, edge-trimmed, replace:** edition compare (#2, 1440×900), extended editions report (#3, 1440×900), wishlist desk (#5, 1440×900 and teaser 1440×810), and recommendations (#6, 1440×810). Those files were center-cropped from 1920×1140 masters. The masters are not in the repo, so the pixels cannot be restored. Drop the original full-window PNGs (or a tight feature crop) and they replace these files at a proportional scale. **#3 note:** the capture still shows a Loading full library data strip in the Reports sidebar. **Still interim SVG:** missing-tracks report (#4). Visitor captions name the result in the picture. Alt text may say the file is an example or from the owner's library. Do not put interim or capture-status words in a visitor caption. No personal library or customer screenshot is included by default — **owner exception 2026-09-22: shipped proofs use the owner's real library**, deliberately published by the owner (their data, their site). Any *third-party* library capture stays prohibited.
The same dark session also feeds in-app Standard→Pro teaser proofs under `../static/teasers/` (see [`docs/superpowers/specs/2026-08-29-standard-pro-upgrade-teasers.md`](../docs/superpowers/specs/2026-08-29-standard-pro-upgrade-teasers.md)). Shoot once; export into both trees.

### Current files in `media/`

| Path | Purpose | Status |
|---|---|---|
| `media/hero-library.png` | Full-window Library / Discography hero (dark + bronze, owned and missing; 1440×855) | **Shipped** 2026-09-22 |
| `media/edition-comparison.png` | Edition compare (Bonobo / Fragments GB vs JP); 1440×900 | **Replace** — sides trimmed off the full window |
| `media/report-extended-editions.png` | `ExtendedEditions` report; 1440×900 | **Replace** — sides trimmed; sidebar load strip |
| `media/wishlist-desk.png` | Wishlist desk + detail; 1440×900 (Features proof) | **Replace** — left edge of the list trimmed |
| `media/recommendations.png` | Recommendations + optional samples (copied from static/teasers) | **Replace** — title bar and bottom nav trimmed (1440×810) |
| `media/report-custom.svg` | Interim custom report builder | **Still needed** as PNG (#7) |
| `media/report-missing-tracks.svg` | Interim `MissingTracks` illustration | **Still needed** as PNG (#4) |

### Current files in `../static/teasers/`

| Path | Purpose | Status |
|---|---|---|
| `edition-compare.png` | Pro teaser; 1280×720 | **Replace** with the full window, or a tight crop of the compare sheet |
| `report-extended.png` | Pro teaser; 1280×720 | **Replace** (same #3 caveat) |
| `wishlist-desk.png` | Pro teaser; 1440×810 | **Replace** — height trimmed off the full window |
| `recommendations.png` | Pro teaser; 1440×810 | **Replace** — title bar and bottom nav trimmed |
| `report-missing-tracks.svg` | Interim | **Still needed** as PNG (#4) |
| `report-custom.svg` | Interim | **Still needed** as PNG (#7) |
| `wishlist-popover.svg` | Interim | **Still needed** as PNG (#8) |

### Capture checklist (one dark session)

**Global rules (every shot)**

- Theme: **dark + bronze** (not light mica / first-run light)
- Demo / fixture data by default — no identifiable family photos on sleeves. **Owner exception 2026-09-22:** the owner's real library was deliberately chosen for the shipped hero (their data, their site); third-party captures stay prohibited.
- Prefer well-known catalog art MusicBrainz already serves in the demo fixture
- No Alpha/Beta/Gamma placeholders; hero must not be 100% complete / 0 missing
- Export **PNG**; keep masters; ship compressed copies under the size targets below
- Leave SVGs in place until each PNG is dropped in

**Priority 0 — shoot first (Lemon Squeezy + homepage)**

| # | Shot | App surface | Must show | Must not | Ship to | Size |
|---|---|---|---|---|---|---|
| **1** | Hero discography with gaps | Library / Discography for one real-looking artist | Owned **and** missing rows in the same list; missing count ≠ 0; dark chrome; bronze accent readable; **full app window** (title bar, nav, artists, discography, details) | Complete library, empty canvas, light theme, cropped window chrome | `media/hero-library.png` (Features hero and `og:image` too) | **Full window.** Shipped **1440×855**, a proportional scale of the 1920×1140 capture. No center-crop. |

If only one new PNG ships first, make it **#1**. The edition SVGs can hold the rest.

**Priority 1 — site + teasers (same session)**

| # | Shot | App surface | Must show | Ship to (site → teaser) | Master size |
|---|---|---|---|---|---|
| **2** | Edition compare | Edition sheet → **Compare** tab, sibling editions present | Two pressings aligned; extra tracks marked | `media/edition-comparison.png` → `../static/teasers/edition-compare.png` | **Full window**, same file in both trees. Or a tight crop of the compare sheet only. |
| **3** | Extended editions report | Reports → Editions with extra tracks | List with `+2` / `+3` style extras; owned vs catalog | `media/report-extended-editions.png` → `../static/teasers/report-extended.png` | **Full window**, same file in both trees. |
| **4** | Missing tracks report | Reports → Missing tracks from owned | Owned release with e.g. 8 vs 10 tracks | `media/report-missing-tracks.png` → `../static/teasers/report-missing-tracks.png` | **Full window**, same file in both trees. |
| **5** | Wishlist desk | `/wishlist` with a few saved missing albums; one open with notes | Queue + detail, not a social feed | Features proof + `../static/teasers/wishlist-desk.png` | **Full window**, same file in both trees. |
| **6** | Recommendations | `/recommendations` | Similar artists + albums you don't own; samples clearly optional | `media/recommendations.png` and `../static/teasers/recommendations.png` | **Full window**, same file in both trees. |

**Priority 2 — teasers only (can be day two)**

| # | Shot | Surface | Ship to | Size |
|---|---|---|---|---|
| **7** | Custom report builder | Reports → Custom / Create new with filters visible | `../static/teasers/report-custom.png` | **Full window.** |
| **8** | Want popover | Discography heart → Want teaser chrome *or* a single wishlist row close-up | `../static/teasers/wishlist-popover.png` | **Tight crop** of the popover or one wishlist row. Wide enough to read at 280 px. |

### How to shoot efficiently

1. Force **dark + bronze** before capturing (teasers always show the dark proof even if the user runs light day-to-day).
2. Use the **demo / fixture library** so gaps and editions are predictable.
3. Capture **#1–#6** in one sitting. Each of **#1–#7** ships the **full window** (proportional scale only, same pixels in `media/` and `static/teasers/` when both need the shot). **#8** is the only tight crop.
4. ~~After `#1` lands, update hero alt text and replace `og:image`.~~ Done 2026-09-22: all three pages now point `og:image` at `media/hero-library.png`.
5. **#2, #3, #5, #6** are on the site but edge-trimmed. Replace them from the original full-window captures. Do not center-crop the replacements.
6. Still open: replacements for **#2 #3 #5 #6**, **#4** missing-tracks PNG, **#7** report-custom, **#8** wishlist-popover tight crop.

### Display-scaling note for owners on a scaled monitor (e.g. Windows 125%)

A maximized window on a **1920×1200 desktop at 125%** is a **1536×912 logical** viewport; screenshots capture at 1.25× (**1920×1140 physical**). Do not trust OS window sizes — confirm `GetSystemMetrics(SM_CXFULLSCREEN)`/`SM_CYFULLSCREEN` or take one throwaway shot and check the pixel size first.

**Every full-window shot (#1–#7) is that capture.** Ship the 1920×1140 file as-is, or scale it proportionally (1440 wide → 855 tall). Do not center-crop to 1.6:1 or 16:9. Do not trim the title bar, nav, or window edges. `og:image` uses the hero file. Site and teaser copies of the same shot are the same pixels.

**#8** is the exception: crop tight on the popover or the single row. Leave no sliver of the window around it.

Keep the master. A later compress or palette quantize is fine. A later aspect-ratio crop is not.

### Filename cheat-sheet

```
public-site/media/hero-library.png
public-site/media/edition-comparison.png
public-site/media/report-extended-editions.png
public-site/media/report-missing-tracks.png
public-site/media/wishlist-desk.png
static/teasers/edition-compare.png
static/teasers/wishlist-desk.png
static/teasers/recommendations.png
static/teasers/report-extended.png
static/teasers/report-missing-tracks.png
static/teasers/report-custom.png
static/teasers/wishlist-popover.png
```

## Tier contract

- **Free demo:** full feature surface on a 10-artist scan cap.
- **Standard — £15 / 2 devices:** core tracking, unlimited scanning, dashboard, built-in reports, on-demand match re-checks, and export as Markdown or CSV, plus print; no edition comparison, advanced reports, Wishlist, recommendations, or custom report builder.
- **Pro — £25 / 2 devices:** Standard plus edition comparison, advanced reports, Wishlist, recommendations, and custom report builder.
- **Family — £35 / 5 devices:** all Pro features across five devices.

`ExtendedEditions` (“Editions with extra tracks”) and `MissingTracks` (“Missing tracks from owned releases”) are advanced reports.

On phones the matrix starts with a tier switcher (Standard / Pro / Family) that scrolls the table to that column; every cell stays in the DOM and the table still scrolls by hand, so the hint above it ("Swipe to see Pro and Family — the feature column stays visible") stays true. The label column narrows to 22% and the matrix wraps without JavaScript across all three columns.

Matrix feature names are links to Features but not underlined at rest; hover and focus add a dotted bronze underline. Use the dotted-underlined info treatment only for a label that actually carries a tooltip.

Site prose uses `catalog`, never `catalogue`: it is MusicBrainz’s own word and the app spells it that way in both locales, and `scripts/audit-i18n-apostrophe-guard.mjs` fails the commit on the British spelling at either surface (a 2026-10-21 critique proposed `catalogue`; the terms-of-record guard wins, because one term for the domain cannot be two). The Free demo exposes them within its scan cap; Standard does not. The pricing matrix uses the names “Built-in reports” (every tier) and “Advanced reports” (Pro and Family), alongside the custom report builder (Pro and Family). Do not use the term “bulk actions” on the site. Visitor prose uses “reports” and “devices” in sentence case, not machines, and “tiers”, not plans. Do not capitalise report or device in the middle of a sentence.

## Local validation

From the repository root:

```bash
npm run test:public-site
npm run docs:links
```

The public-site test serves this directory locally, checks all three pages at desktop and narrow widths, verifies body-only release CTAs, checks the tier contract and checkout links, validates internal links and local proof assets, exercises the small-screen menu (collapse, Escape, focus return, no clipped header item), the sticky-header scroll state, the phone tier switcher and three-column gap wall, the shot-pair bleed at 1440px, and the proof-frame hover/focus lift, samples painted pixels to confirm the ambient background wash is visible and stays anchored to the viewport rather than the document, and runs axe.

## Deployment

Edit this directory in the private application repository. `.github/workflows/deploy-public-site.yml` mirrors `public-site/` to the public companion repository when `main` receives a change under `public-site/**`. The manual fallback is `pwsh scripts/push-public-site.ps1`. Do not edit the public companion repository directly.

**Spot-check after publish (R-14):** confirm https://lydenyardley.github.io/missingmusic/ mirrors this folder — especially the pricing matrix (Standard export = Included) and proof assets.

Every Download the demo action points to the official GitHub `/releases/latest` route. Before the first stable non-draft, non-prerelease release exists, the page keeps the same honest pre-release copy; after release, `site.js` names the current version and preserves the latest-release destination.
