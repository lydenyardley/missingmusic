# Missing Music public site

This directory is the source of truth for the public companion site at https://lydenyardley.github.io/missingmusic/.

The site is static HTML/CSS/vanilla JavaScript. It has no build step and no analytics or advertising SDK.

## Pages

| Path | Purpose |
|---|---|
| `index.html` | Homepage thesis, gap wall, edition proofs, Demo vs Pro close |
| `features.html` | Numbered scan → match → gap → edition comparison / reports → wishlist tour, Picard-then-scan workflow, trust and installer notes |
| `pricing.html` | Paid-tier comparison table (Standard → Pro → Family) with per-column pricing headers and checkout CTAs, standalone demo card, mobile comparison guidance, and FAQ |

The shared header contains the Missing Music brand, Features, and Pricing. Download actions live in each page's body so the small-screen navigation stays calm. Every download action says **Download the demo** and points to GitHub's latest-release route; the page keeps the copy honest while no stable installer is available.

## Proof assets

The hero proof is an actual Library UI capture. Recapture it in dark + bronze with missing rows; the current file is a temporary stand-in. Edition, report, and wishlist frames use the dark demo SVGs in `media/` until those PNG captures land. No personal library or customer screenshot is included.

| Path | Purpose |
|---|---|
| `media/hero-library.png` | Library / Discography hero evidence (replace with a dark capture that shows gaps) |
| `media/edition-comparison.svg` | Interim edition-comparison illustration |
| `media/report-extended-editions.svg` | Interim `ExtendedEditions` illustration |
| `media/report-missing-tracks.svg` | Interim `MissingTracks` illustration |
| `media/wishlist-recommendations.svg` | Interim Wishlist illustration |

When replacing those assets, match the site (dark + bronze), not first-run light:

| Shot | What it must show | What it must not show |
|---|---|---|
| Hero / Library | Dark theme, bronze accent, a real-looking artist, owned and missing rows in the same discography, a missing count that is not zero | 100% complete, 0 missing, Alpha/Beta/Gamma, light mica, empty canvas |
| Edition comparison | Two pressings, track alignment, extra tracks marked | A settings-looking empty panel |
| Editions with extra tracks | A report list with `+2` / `+3` extras, owned vs catalog edition | A generic dashboard |
| Missing tracks from owned | `8 tracks` vs `10 tracks` on a release that is marked owned | Only missing *releases* |
| Wishlist (Features only) | One saved missing release, recommendations clearly optional | A social feed |

If only one new PNG ships first, make it the hero discography with gaps. The edition SVGs can hold the rest.

## Tier contract

- **Free demo:** full feature surface on a 10-artist scan cap.
- **Standard — £15 / 2 machines:** core tracking, unlimited scanning, dashboard, basic saved Reports, and on-demand match re-checks; no edition comparison or advanced Reports.
- **Pro — £25 / 2 machines:** Standard plus edition comparison, advanced Reports, Wishlist, recommendations, bulk actions, and rich export.
- **Family — £35 / 5 machines:** all Pro features across five machines.

`ExtendedEditions` (“Editions with extra tracks”) and `MissingTracks` (“Missing tracks from owned releases”) are advanced Reports. The Free demo exposes them within its scan cap; Standard does not.

## Local validation

From the repository root:

```bash
npm run test:public-site
npm run docs:links
```

The public-site test serves this directory locally, checks all three pages at desktop and narrow widths, verifies body-only release CTAs, checks the plan contract and checkout links, validates internal links and local proof assets, and runs axe.

## Deployment

Edit this directory in the private application repository. `.github/workflows/deploy-public-site.yml` mirrors `public-site/` to the public companion repository when `main` receives a change under `public-site/**`. The manual fallback is `pwsh scripts/push-public-site.ps1`. Do not edit the public companion repository directly.

Every Download the demo action points to the official GitHub `/releases/latest` route. Before the first stable non-draft, non-prerelease release exists, the page keeps the same honest pre-release copy; after release, `site.js` names the current version and preserves the latest-release destination.
