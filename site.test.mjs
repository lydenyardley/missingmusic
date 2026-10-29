import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://localhost").pathname,
      );
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const filePath = resolve(ROOT, relative);
      if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${sep}`)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

const PAGES = [
  {
    path: "/",
    page: "home",
    h1: "You built the library. This finds the gaps.",
    sections: [
      "hero",
      "gap",

      "edition-intelligence",
      "feature-bridge",
      "pricing-preview",
    ],
    assets: [
      "media/hero-library.png",
      "media/edition-comparison.png",
      "media/report-extended-editions.png",
      "media/report-missing-tracks.svg",
    ],
    placeholders: 0,
  },
  {
    path: "/features.html",
    page: "features",
    h1: "Reports, edition comparison, artist discovery, Wishlist",
    sections: [
      "hero",
      "at-a-glance",
      "reports",
      "edition-intelligence",
      "samples",
      "wishlist",
      "desktop",
      "collector-workflow",
      "trust",
    ],
    assets: [
      "media/hero-library.png",
      "media/report-custom.svg",
      "media/report-missing-tracks.svg",
      "media/report-extended-editions.png",
      "media/edition-comparison.png",
      "media/recommendations.png",
      "media/wishlist-desk.png",
    ],
    placeholders: 0,
  },
  {
    path: "/pricing.html",
    page: "pricing",
    h1: "Standard, Pro, or Family. Pay once.",
    sections: ["hero", "tiers", "faq"],
    assets: [],
  },
];

const FLAT_BG = [26, 26, 26]; // --bg #1a1a1a, the fill the wash has to lift off

async function readPaintedPixels(page, points) {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      return points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3));
    },
    { data: shot, points },
  );
}

/* The ambient wash is the one thing that keeps the page background from
   reading as a dead flat fill, and no DOM assertion can see it: a
   `background-image` on `body` propagates to the canvas, whose positioning
   area is the whole document (3.7k-7.7kpx tall here) rather than the viewport,
   so `at 10% -4%` resolved above the fold and every page painted as flat
   `--bg`. Read real pixels instead, with content hidden so the sample is the
   background alone, at one fixed viewport point at the fold and at the
   document end: anchored to the viewport, both reads are the same warm tint
   and neither is the flat fill. */
async function assertAmbientWash(page, definition, viewport) {
  const corners = [
    [2, 10],
    [viewport.width - 3, 10],
  ];
  const chrome = "main, .site-header, .site-footer";
  await page.evaluate((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.style.visibility = "hidden";
    });
  }, chrome);
  try {
    const atFold = await readPaintedPixels(page, corners);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    const atEnd = await readPaintedPixels(page, corners);
    await page.evaluate(() => window.scrollTo(0, 0));
    const [topLeft] = atFold;
    const lift = Math.max(...topLeft) - Math.max(...FLAT_BG);
    const warmth = topLeft[0] - topLeft[2];
    assert.ok(
      lift >= 10 && warmth >= 8,
      `${definition.path} paints a flat background at ${viewport.width}px (top-left ${topLeft.join(",")}, flat --bg ${FLAT_BG.join(",")})`,
    );
    const drift = Math.max(
      ...atEnd.flatMap((pixel, i) => pixel.map((channel, c) => Math.abs(channel - atFold[i][c]))),
    );
    assert.ok(
      drift <= 1,
      `${definition.path} background wash scrolls away at ${viewport.width}px (top-left ${topLeft.join(",")} at the fold vs ${atEnd[0].join(",")} at the document end); it must stay anchored to the viewport`,
    );
  } finally {
    await page.evaluate((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.style.visibility = "";
      });
    }, chrome);
  }
}

async function auditPage(page, baseUrl, definition, viewport) {
  await page.setViewportSize(viewport);
  const errors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseUrl}${definition.path}`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response?.status(), 200, `${definition.path} did not return 200`);
  assert.equal(
    await page.locator("body").getAttribute("data-page"),
    definition.page,
  );
  assert.equal(await page.locator("h1").first().innerText(), definition.h1);
  assert.ok(
    (await page.locator("[data-release-cta-label]").allTextContents()).every((text) => text.trim() === "Download the demo"),
    `${definition.path} has an inconsistent download CTA label`,
  );
  assert.ok(
    (await page.locator("[data-release-cta]").evaluateAll((links) => links.every((link) => link.getAttribute("href") === "https://github.com/lydenyardley/missingmusic/releases/latest"))),
    `${definition.path} does not point download CTAs at GitHub latest`,
  );assert.equal(
    await page.locator(".site-header [data-release-cta]").count(), 1, "nav CTA should be in the header"
  );
  assert.equal(
    await page.locator(".wall[tabindex]").count(), 0, "the static gap wall must not be a keyboard focus stop"
  );
  assert.deepEqual(
    await page.locator(".site-header .nav-link").allTextContents(),
    ["Features", "Pricing"],
  );
  assert.equal(
    await page.locator("html").getAttribute("data-release-state"),
    "pre-release",
  );
  for (const section of definition.sections) {
    await assert.doesNotReject(
      page.locator(`[data-section="${section}"]`).waitFor({ state: "attached" }),
      `${definition.path} is missing section ${section}`,
    );
  }
  for (const asset of definition.assets) {
    assert.ok(
      (await page.locator(`img[src="${asset}"]`).count()) > 0,
      `${definition.path} does not render proof asset ${asset}`,
    );
  }
  assert.equal(
    await page.locator("[data-capture-placeholder]").count(),
    definition.placeholders ?? 0,
    `${definition.path} has an unexpected number of capture placeholders`,
  );
  if (definition.page !== "pricing") {
    assert.equal(
      await page.locator("table").count(),
      0,
      `${definition.path} unexpectedly contains a comparison table`,
    );
  } else {
    assert.equal(await page.locator("#matrix-scroll-note").count(), 1);
    assert.equal(await page.locator("[data-matrix-tier]").count(), 3, "the phone tier switch offers all three paid tiers");
    if (viewport.width <= 620) {
      assert.equal(await page.locator("#matrix-scroll-note").evaluate((element) => getComputedStyle(element).display), "block");
      assert.equal(
        await page.locator(".matrix-tier-switch").evaluate((element) => getComputedStyle(element).display),
        "flex",
        "the phone tier switch sits above the matrix",
      );
    }
  }
  if (definition.page === "home") {
    assert.equal(await page.locator(".hero .btn-ghost").count(), 1, "hero should have edition comparison ghost button");assert.equal(
    await page.locator(".hero .btn-ghost").innerText(), "Compare editions"
  );
    assert.equal(
      await page.locator(".hero a[href*=\"features.html#trust\"]").count(),
      0,
      "Verify SHA-256 belongs in the footer/Trust area, not the hero stack",
    );
    assert.equal(await page.locator("[data-release-cta]").count(), 4, "nav + hero + pricing preview + closing CTAs");
    assert.equal(await page.locator(".hero .hero-trust").count(), 0, "local-files claim lives in Trust, not the home hero");
    assert.equal(await page.locator('[data-disc-demo] [data-own="all"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-disc-demo] button[data-type="Album"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-disc-demo] button[data-type="Live"]').getAttribute("aria-pressed"), "true");
    const discCap = await page.locator(".disc-demo__grid").evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length * 2);
    assert.equal(await page.locator('[data-disc-demo] .disc-demo__grid li:not([hidden])').count(), discCap, "the demo shows two rows and no more");
    if (viewport.width <= 620) {
      assert.equal(discCap, 6, "phones keep three readable columns, so six tiles show");
      assert.equal(
        await page.locator(".disc-demo__grid li:not([hidden]) .disc-title").first().evaluate((title) => getComputedStyle(title).whiteSpace),
        "nowrap",
        "phone titles truncate to one line instead of wrapping per word",
      );
    }
    assert.equal(await page.locator('[data-section="incomplete"]').count(), 0, "incomplete highlight is covered by the product shots");
    assert.equal(await page.locator('[data-section="feature-mosaic"]').count(), 0, "Home mosaic must be removed");
    assert.equal(
      await page.locator('[data-section="feature-bridge"] .feature-tile').count(),
      8,
      "home shows eight payoff tiles",
    );
    assert.deepEqual(
      await page.locator('[data-section="feature-bridge"] .feature-tile').evaluateAll((tiles) =>
        tiles.map((tile) => tile.querySelectorAll('h3 a[href^="features.html#"]').length),
      ),
      [1, 1, 1, 1, 1, 1, 1, 1],
      "each tile title links once to its Features anchor",
    );
    assert.equal(
      await page.locator('[data-section="feature-bridge"] a[href="features.html#at-a-glance"]').count(),
      1,
      "the tiles hand off to the full list on Features",
    );
    assert.equal(
      await page.locator('[data-section="edition-intelligence"] [data-section="feature-bridge"]').count(),
      0,
      "the feature index is its own section, not a strip under the edition shots",
    );
    assert.equal(await page.locator('[data-section="personalise"]').count(), 0, "Full personalise band must leave Home");
    assert.equal(await page.locator(".hero-wedge").count(), 0, "the edition row does not narrate the crop");
    assert.equal(await page.locator('[data-disc-demo] button[data-type="Broadcast"]').count(), 0, "Broadcast is not an app release type in the demo");
    assert.equal(await page.locator('[data-disc-demo] button[data-type="Other"]').count(), 1);
    assert.ok(
      (await page.locator(".release-chips-intro").innerText()).toLowerCase().includes("works across every release type"),
      "Home hero should introduce release-type chips as labels",
    );
    assert.equal(
      await page.locator('[data-disc-demo] .disc-demo__types').getAttribute("aria-label"),
      "Release types",
    );
    await page.locator('[data-disc-demo] button[data-type="EP"]').click();
    assert.ok((await page.locator('[data-disc-demo] li[data-type="EP"]:not([hidden])').count()) > 0, "turning on EP shows that type");
    assert.ok(
      (await page.locator('[data-disc-demo] .disc-demo__grid li:not([hidden])').count()) <= discCap,
      "filters never open a third row",
    );
    assert.equal(await page.locator('[data-section="pricing-preview"] [data-tier]').count(), 2);
    assert.equal(
      await page.locator(".plan-card__badge, .plan-head__badge").count(),
      0,
      "unsourced collector-share badges stay off the page",
    );
    assert.equal(
      await page.locator('[data-section="pricing-preview"] .plan-card--pro .plan-card__use').innerText(),
      "Find pressings with bonus tracks, spot incomplete copies, and save a Wishlist.",
    );
    // SC7: the body states the boundary the heading cannot — what the cap
    // covers and what stays unlimited.
    assert.ok(
      (await page.locator('[data-section="pricing-preview"] .section-lede').innerText())
        .includes("Only the scan is capped, at 10 artists."),
      "the demo section's lede states what the 10-artist cap covers (SC7)",
    );
    assert.equal(await page.locator('[data-section="pricing-preview"] .btn-primary').count(), 1);
    assert.ok(
      (await page.locator('[data-section="pricing-preview"] .platform-note').innerText()).includes("Linux"),
      "pricing preview should mention Linux/macOS coming soon",
    );
    // Centred section copy must stay on the section's centre line even though
    // h2 and .section-lede carry a display max-width.
    const centreOffset = await page.evaluate(() => {
      const section = document.querySelector('[data-section="pricing-preview"]');
      const mid = (el) => {
        const box = el.getBoundingClientRect();
        return (box.left + box.right) / 2;
      };
      const target = mid(section);
      return ["h2", ".section-lede", ".platform-note"].map((selector) =>
        Math.abs(mid(section.querySelector(selector)) - target),
      );
    });
    assert.ok(
      centreOffset.every((offset) => offset <= 1),
      `pricing-preview centred copy drifts off the centre line (offsets: ${centreOffset.join(", ")})`,
    );
  }
  assert.ok(
    (await page.locator(".cta-install-note, .fine, .hero-cta-note").count()) >= 1,
    `${definition.path} is missing trust or fine-print notes near download`,
  );
  assert.equal(
    await page.locator(".hero [data-release-note], .page-hero [data-release-note]").count(),
    0,
    `${definition.path} keeps an empty release-note slot in the hero stack`,
  );
  assert.equal(
    await page.locator(".site-footer [data-release-note]").count(),
    1,
    `${definition.path} should carry exactly one release note in the footer`,
  );
  if (definition.page === "features") {
    assert.equal(await page.locator('[data-section="reports"]').count(), 1, "reports must lead the Features catalogue");
    const featureOrder = await page.locator("main [data-section]").evaluateAll((sections) => sections.map((section) => section.dataset.section));
    assert.ok(
      featureOrder.indexOf("collector-workflow") < featureOrder.indexOf("reports"),
      "the scan workflow explains the flow before the report catalogue",
    );
    assert.notEqual(
      await page.locator('[data-page="features"] .page-hero .platform-note').evaluate((note) => getComputedStyle(note).textAlign),
      "center",
      "hero fine print follows the buttons instead of centring under them",
    );
    assert.equal(await page.locator("#at-a-glance .feature-glance__list a").count(), 13, "Features at a glance lists every feature");
    for (const id of ["at-a-glance", "upcoming-releases", "scan-and-match", "missing-visibility", "priority-updates", "missing-tracks", "editions-extra-tracks", "export", "edition-intelligence", "wishlist", "samples", "reports", "custom-reports"]) {
      assert.equal(await page.locator(`#${id}`).count(), 1, `features.html needs #${id} for pricing deep links`);
    }
    assert.equal(await page.locator('img[src="media/recommendations.png"]').count(), 1, "recommendation samples reuse teaser PNG");
    assert.equal(await page.locator('img[src="media/report-custom.svg"]').count(), 1);
    assert.equal(await page.locator("#trust").getByText("Your files stay local").count(), 1, "local-files claim lives in Trust");
    assert.equal(await page.locator('[data-section="desktop"] .trust-card').count(), 0, "desktop access is one section, not three cards");
    assert.equal(await page.locator("#trust").getByRole("heading", { name: "Keyboard and screen readers" }).count(), 0, "Trust does not repeat the desktop access claim");
    assert.equal(await page.getByText("This is not a WCAG conformance claim.").count(), 1, "the non-claim is stated once");
    assert.equal(await page.locator('a[href="https://picard.musicbrainz.org/"]').count(), 1);
    // One kicker slot per page, and it carries a claim (SC3). The reports
    // section is named by its own heading instead of a second kicker (SC9).
    assert.deepEqual(
      await page.locator(".eyebrow").allTextContents(),
      ["What it finds, and what it never touches."],
    );
    assert.equal(await page.locator(".kicker").count(), 0, "the reports section needs no kicker of its own");
    assert.ok(
      (await page.locator('[data-section="collector-workflow"] .section-lede').innerText())
        .includes("From your folders to your reports"),
      "the workflow section says what it covers instead of where it sits (SC12)",
    );
    // One name per zoom control (SC26): the accessible name and the tooltip
    // carry the same string, and the strip's arrows step screenshots (SC27).
    const focusImg = page.locator("[data-report-stage] .proof-frame.is-focus img").first();
    const focusAlt = await focusImg.getAttribute("alt");
    const zoomLabel = `View full size: ${focusAlt}`;
    assert.equal(await focusImg.getAttribute("role"), "button", "the focused screenshot is the zoom control");
    assert.equal(await focusImg.getAttribute("aria-label"), zoomLabel);
    assert.equal(await focusImg.getAttribute("title"), zoomLabel);
    assert.deepEqual(
      (
        await page
          .locator("[data-report-stage] .report-strip__nav")
          .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))
      ).sort(),
      ["Next screenshot", "Previous screenshot"],
    );
    // Wide features: compare and wishlist keep copy left of the window; samples keeps the window left of the copy.
    if (viewport.width >= 900) {
      const pairs = await page.locator("#edition-intelligence .shot-pair, #samples .shot-pair, #wishlist .shot-pair").evaluateAll((rows) =>
        rows.map((row) => {
          const copy = row.querySelector("figcaption");
          const proof = row.querySelector(".shot-pair__frame");
          if (!copy || !proof) return null;
          return { copyLeft: copy.getBoundingClientRect().left, proofLeft: proof.getBoundingClientRect().left };
        }),
      );
      assert.equal(pairs.length, 3, "compare, samples, and wishlist each sit beside their window");
      pairs.forEach((pos, i) => {
        const copyOnLeft = i % 2 === 0;
        assert.ok(
          pos !== null && (copyOnLeft ? pos.copyLeft < pos.proofLeft : pos.proofLeft < pos.copyLeft),
          `features shot-pair ${i + 1} should ${copyOnLeft ? "keep copy left of the window" : "keep the window left of the copy"}`,
        );
      });
    }
  }
  assert.ok(
    !(await page.locator("body").innerText()).toLowerCase().includes("bulk action"),
    `${definition.path} uses "bulk actions"; name the export formats instead`,
  );
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.equal(layout.documentWidth, layout.viewportWidth, `${definition.path} overflows horizontally at ${viewport.width}px`);
  const internalHrefs = await page.locator("a[href]").evaluateAll((links) =>
    links
      .map((link) => {
        const url = new URL(link.href);
        url.hash = '';
        return url.href;
      })
      .filter((href) => href.startsWith(window.location.origin)),
  );
  for (const href of new Set(internalHrefs)) {
    const internalResponse = await page.request.get(href);
    assert.equal(
      internalResponse.status(),
      200,
      `${definition.path} has a broken internal link: ${href}`,
    );
  }
  await page.locator('.observe').evaluateAll((elements) => {
    elements.forEach((element) => element.classList.add('in'));
  });
  await page.locator('.reveal').evaluateAll((elements) => {
    elements.forEach((element) => {
      element.style.animation = 'none';
      element.style.opacity = '1';
      element.style.transform = 'none';
    });
  });
  await page.waitForTimeout(600);
  const revealedLayout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.equal(revealedLayout.documentWidth, revealedLayout.viewportWidth, `${definition.path} overflows after reveals at ${viewport.width}px`);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
    .analyze();
  assert.deepEqual(axe.violations, [], `${definition.path} has accessibility violations`);
  assert.deepEqual(errors, [], `${definition.path} raised page errors`);
  await assertAmbientWash(page, definition, viewport);
}

// ADR-0109: every raster in media/ is derived from an uncropped master in
// ../screenshots/masters/ whose file stem prefixes the derived name.
// Files shipped before the rule are grandfathered; drop an entry once its master lands.
const GRANDFATHERED = new Set([
  "edition-comparison.png",
  "hero-library.png",
  "recommendations.png",
  "report-extended-editions.png",
  "wishlist-desk.png",
]);

async function checkScreenshotMasters() {
  const { readdir } = await import("node:fs/promises");
  const listRasters = async (dir) =>
    (await readdir(dir).catch(() => [])).filter((name) => /\.(png|jpe?g|webp|avif)$/i.test(name));
  const masterStems = (await listRasters(resolve(ROOT, "..", "screenshots", "masters"))).map((name) =>
    name.replace(/\.[^.]+$/, ""),
  );
  const orphans = (await listRasters(resolve(ROOT, "media"))).filter(
    (name) => !GRANDFATHERED.has(name) && !masterStems.some((stem) => name.startsWith(stem)),
  );
  assert.deepEqual(
    orphans,
    [],
    `media/ images without a master in screenshots/masters/ (ADR-0109): ${orphans.join(", ")}`,
  );
}

async function main() {
  await checkScreenshotMasters();
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  // Deterministic a11y audit: force the site's prefers-reduced-motion branch so
  // .reveal/.observe elements sit at final opacity from first paint. Without it
  // the .observe transition (500ms + per-element --d stagger up to ~0.35s) can
  // still be mid-fade when axe samples, producing a transient color-contrast
  // (wcag143) violation that is a test artifact, not a page defect.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.route("https://api.github.com/**", (route) => route.abort());
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      for (const definition of PAGES) {
        await auditPage(page, baseUrl, definition, viewport);
      }
    }

    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();
    for (const definition of PAGES) {
      await noJsPage.setViewportSize({ width: 375, height: 812 });
      await noJsPage.goto(`${baseUrl}${definition.path}`, { waitUntil: "domcontentloaded" });
      assert.equal(await noJsPage.locator("body").getAttribute("data-page"), definition.page);
      assert.equal(await noJsPage.locator("h1").first().innerText(), definition.h1);
      assert.equal(
        await noJsPage.evaluate(() => document.documentElement.scrollWidth),
        375,
        `${definition.path} overflows horizontally without JavaScript`,
      );
      // `overflow-x: clip` keeps scrollWidth honest even when the header row is
      // clipped, so assert on real header-item geometry instead.
      assert.equal(
        await noJsPage.locator(".site-header__inner").evaluate((el) =>
          Array.from(el.querySelectorAll("button, a")).filter((child) => {
            const rect = child.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
          }).length,
        ),
        0,
        `${definition.path} clips a header item without JavaScript`,
      );
      assert.equal(
        await noJsPage.locator("[data-nav-toggle]").evaluate((el) => getComputedStyle(el).display),
        "none",
        `${definition.path} shows a dead menu button without JavaScript`,
      );
    }
    await noJsContext.close();

    const media = [
      "/media/hero-library.png",
      "/media/edition-comparison.png",
      "/media/report-extended-editions.png",
      "/media/report-missing-tracks.svg",
      "/media/report-custom.svg",
      "/media/recommendations.png",
      "/media/wishlist-desk.png",
    ];
    for (const path of media) {
      const response = await page.request.get(`${baseUrl}${path}`);
      assert.equal(response.status(), 200, `missing proof asset ${path}`);
      assert.ok((await response.body()).length > 1000, `proof asset ${path} is empty`);
    }


    // Proof lightbox: open at natural size (capped by viewport; never upscaled).
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const heroImg = page.locator(".hero-proof.proof-frame img").first();
    await heroImg.click();
    const lightbox = page.locator("dialog.proof-lightbox");
    await lightbox.waitFor({ state: "visible" });
    assert.equal(await lightbox.evaluate((el) => el.open), true);
    assert.equal(
      await lightbox.getAttribute("aria-label"),
      await heroImg.getAttribute("alt"),
      "the viewer is named by the screenshot it shows (SC26)",
    );
    const lightImg = lightbox.locator(".proof-lightbox__img");
    await lightImg.waitFor({ state: "visible" });
    const sizing = await lightImg.evaluate((img) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      naturalW: img.style.getPropertyValue("--proof-natural-w").trim(),
      naturalH: img.style.getPropertyValue("--proof-natural-h").trim(),
    }));
    assert.ok(sizing.naturalWidth > 0, "lightbox image should load");
    assert.equal(sizing.naturalW, `${sizing.naturalWidth}px`);
    assert.equal(sizing.naturalH, `${sizing.naturalHeight}px`);
    assert.ok(
      sizing.clientWidth <= sizing.naturalWidth + 1,
      `lightbox must not upscale past natural width (got ${sizing.clientWidth} > ${sizing.naturalWidth})`,
    );
    assert.ok(
      sizing.clientHeight <= sizing.naturalHeight + 1,
      `lightbox must not upscale past natural height (got ${sizing.clientHeight} > ${sizing.naturalHeight})`,
    );
    await page.locator(".proof-lightbox__stage").click({ position: { x: 12, y: 12 } });
    await page.waitForFunction(() => !document.querySelector("dialog.proof-lightbox")?.open);
    assert.equal(await lightbox.evaluate((el) => el.open), false);

    await page.locator(".hero-proof.proof-frame img").first().click();
    await lightbox.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog.proof-lightbox")?.open);
    assert.equal(await lightbox.evaluate((el) => el.open), false);

    // T-24 · the primary nav collapses under 620px behind a real button, and
    // nothing in the header row is clipped at ~390px.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const navToggle = page.locator("[data-nav-toggle]");
    const siteNav = page.locator("#site-nav");
    await navToggle.waitFor({ state: "visible" });
    assert.equal(await navToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await siteNav.evaluate((el) => getComputedStyle(el).display), "none");
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
      "Home must not overflow horizontally at 390px",
    );
    const clippedHeaderItems = await page
      .locator(".site-header__inner")
      .evaluate((el) =>
        Array.from(el.querySelectorAll("button, a")).filter((child) => {
          const rect = child.getBoundingClientRect();
          /* Zero-size items are inside the collapsed panel, not clipped. */
          if (rect.width === 0 || rect.height === 0) return false;
          return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
        }).length,
      );
    assert.equal(clippedHeaderItems, 0, "no header item may be clipped at 390px");
    const toggleBox = await navToggle.boundingBox();
    assert.ok(
      toggleBox && toggleBox.height >= 40,
      "the small-screen menu button needs a usable touch target",
    );

    await navToggle.click();
    assert.equal(await navToggle.getAttribute("aria-expanded"), "true");
    assert.equal(await siteNav.evaluate((el) => getComputedStyle(el).display), "flex");
    assert.deepEqual(await siteNav.locator("a").allTextContents(), [
      "Features",
      "Pricing",
      "Download the demo",
    ]);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
      "the open menu must not overflow horizontally at 390px",
    );

    await page.keyboard.press("Escape");
    assert.equal(await navToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await siteNav.evaluate((el) => getComputedStyle(el).display), "none");
    assert.equal(
      await page.evaluate(() => document.activeElement?.hasAttribute("data-nav-toggle") === true),
      true,
      "Escape should hand focus back to the menu button",
    );

    // Desktop keeps the flat navigation and no toggle.
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await navToggle.evaluate((el) => getComputedStyle(el).display), "none");
    assert.equal(await siteNav.evaluate((el) => getComputedStyle(el).display), "flex");

    // 27 · at 1440px the shot columns bleed to the window edge and stop there.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const shotEdges = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".shot-pair__frame"), (frame) => {
        const box = frame.getBoundingClientRect();
        return { left: box.left, right: box.right, viewport: window.innerWidth };
      }),
    );
    assert.ok(shotEdges.length >= 3, "the home page keeps its shot pairs");
    assert.ok(
      shotEdges.every((box) => box.left >= -0.5 && box.right <= box.viewport + 0.5),
      `a home screenshot leaves the window at 1440px (${shotEdges
        .map((box) => `${Math.round(box.left)}-${Math.round(box.right)}`)
        .join(", ")})`,
    );

    // T-22 · sticky header earns a hairline and a tint on scroll, never height.
    await page.setViewportSize({ width: 1280, height: 700 });
    const headerBox = () =>
      page.locator(".site-header").evaluate((el) => ({
        scrolled: el.classList.contains("is-scrolled"),
        height: el.getBoundingClientRect().height,
      }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      () => !document.querySelector(".site-header")?.classList.contains("is-scrolled"),
    );
    const headerAtTop = await headerBox();
    assert.equal(headerAtTop.scrolled, false, "the header starts flat");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() =>
      document.querySelector(".site-header")?.classList.contains("is-scrolled"),
    );
    const headerScrolled = await headerBox();
    assert.equal(
      headerScrolled.height,
      headerAtTop.height,
      "the sticky header must not grow when scrolled",
    );

    // T-20 · screenshot frames lift on focus/hover; the lightbox stays the zoom.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.locator(".hero-proof.proof-frame img").first().waitFor({ state: "visible" });
    const heroFrame = page.locator(".hero-proof.proof-frame");
    const frameTransform = () =>
      heroFrame.evaluate((el) => getComputedStyle(el).transform);
    const restTransform = await frameTransform();
    await page.locator(".hero-proof.proof-frame img").first().focus();
    await page.waitForTimeout(250);
    assert.notEqual(
      await frameTransform(),
      restTransform,
      "a focused screenshot frame must lift",
    );
    await page.locator(".hero-proof.proof-frame img").first().blur();
    await page.waitForTimeout(250);
    assert.equal(
      await frameTransform(),
      restTransform,
      "the screenshot frame must settle back when focus leaves",
    );

    await page.goto(`${baseUrl}/`);
    assert.equal(
      await page.locator("html").getAttribute("data-release-state"),
      "pre-release",
    );
    // T-27 · the footer release note is the one release-state slot; empty in
    // the pre-release state it must not leave a visible gap.
    assert.equal(
      await page.locator(".site-footer [data-release-note]").isVisible(),
      false,
      "an empty release note must not render a placeholder",
    );
    assert.equal(
      await page.locator("[data-release-cta-label]").first().innerText(),
      "Download the demo",
    );
    assert.equal(
      await page.locator("[data-release-cta]").first().getAttribute("href"),
      "https://github.com/lydenyardley/missingmusic/releases/latest",
    );

    await page.unroute("https://api.github.com/**");
    await page.route("https://api.github.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ tag_name: "v0.1.0-rc1", draft: true, prerelease: true }]),
      }),
    );
    await page.goto(`${baseUrl}/`);
    await page.waitForTimeout(100);
    assert.equal(
      await page.locator("html").getAttribute("data-release-state"),
      "pre-release",
    );
    assert.equal(
      await page.locator("[data-release-cta-label]").first().innerText(),
      "Download the demo",
    );

    await page.unroute("https://api.github.com/**");
    await page.route("https://api.github.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ tag_name: "v0.1.0", draft: false, prerelease: false }]),
      }),
    );
    for (const definition of PAGES) {
      await page.goto(`${baseUrl}${definition.path}`);
      await page.waitForFunction(
        () => document.documentElement.dataset.releaseState === "live",
      );
      assert.equal(
        await page.locator("html").getAttribute("data-release-state"),
        "live",
      );
      assert.equal(
        await page.locator("html").getAttribute("data-release-version"),
        "v0.1.0",
      );
      assert.ok(
        (await page.locator("[data-release-cta-label]").allTextContents()).every(
          (text) => text.trim() === "Download the demo",
        ),
        `${definition.path} did not upgrade its release CTA`,
      );
      assert.ok(
        await page.locator(".site-footer [data-release-note]").isVisible(),
        `${definition.path} release note stays hidden once a live release exists`,
      );
      assert.ok(
        (await page.locator(".site-footer [data-release-note]").innerText()).includes("v0.1.0"),
        `${definition.path} release note should name the live version`,
      );
    }

    const standardEdition = page.locator(
      '[data-page="pricing"] [data-tier="standard"][data-feature="edition-comparison"]',
    );
    const standardAdvanced = page.locator(
      '[data-page="pricing"] [data-tier="standard"][data-feature="advanced-reports"]',
    );
    const proAdvanced = page.locator(
      '[data-page="pricing"] [data-tier="pro"][data-feature="advanced-reports"]',
    );
    assert.equal(await page.locator('[data-page="pricing"] .plan-head__badge, [data-page="pricing"] .plan-card__badge').count(), 0, "unsourced collector-share badges stay off Pricing");
    assert.equal(await page.locator('[data-page="pricing"] .plan-head__desc').count(), 0, "Pricing stays lean: no tier benefit essays");
    assert.ok(
      (await page.locator('[data-page="pricing"] a[href="features.html"], [data-page="pricing"] a[href^="features.html#"]').count()) >= 1,
      "Pricing must link into Features for catalogue depth",
    );
    const pricingHeroFine = page.locator('[data-page="pricing"] .page-hero .fine');
    assert.equal(
      (await pricingHeroFine.innerText()).trim(),
      "Free 10-artist try · no account, ads or subscription · Windows now, Linux and macOS soon.",
      "the pricing hero makes its offer once, in one line",
    );
    assert.equal(
      await pricingHeroFine.evaluate((note) => getComputedStyle(note).textAlign),
      "left",
      "pricing hero notes align with the buttons",
    );
    assert.equal(await page.locator('[data-page="pricing"] .plan-matrix tbody tr').count(), 11, "keep the full comparison matrix rows");
    const matrixFeatureHrefs = await page.locator('[data-page="pricing"] .plan-matrix tbody th a.matrix-feature-link').evaluateAll((links) =>
      links.map((link) => ({ text: link.textContent.replace(/\s+/g, " ").trim(), href: link.getAttribute("href") })),
    );
    assert.equal(matrixFeatureHrefs.length, 11, "every matrix feature row links to Features");
    assert.equal(
      await page.locator('[data-page="pricing"] .matrix-feature-link').first().evaluate((link) => getComputedStyle(link).textDecorationLine),
      "none",
      "matrix feature names read as copy, not as underlined links",
    );
    assert.deepEqual(
      matrixFeatureHrefs.map((row) => row.href),
      [
        "features.html#scan-and-match",
        "features.html#missing-visibility",
        "features.html#priority-updates",
        "features.html#reports",
        "features.html#editions-extra-tracks",
        "features.html#missing-tracks",
        "features.html#custom-reports",
        "features.html#edition-intelligence",
        "features.html#wishlist",
        "features.html#samples",
        "features.html#export",
      ],
    );
    // SC19: the link convention is stated once in the caption, not eleven
    // times as an sr-only suffix after every row.
    assert.ok(
      (await page.locator('[data-page="pricing"] .plan-matrix caption').innerText())
        .includes("Every feature links to its details on Features."),
      "the matrix caption states the link convention once (SC19)",
    );
    assert.equal(
      await page.locator('[data-page="pricing"] .matrix-feature-link .sr-only').count(),
      0,
      "no matrix row repeats the details suffix for screen readers",
    );
    assert.equal(await page.locator('[data-page="pricing"] .plan-matrix thead th.plan-head').count(), 3, "three paid tier columns, ascending");
    assert.equal(await page.locator('[data-page="pricing"] .plan-matrix tfoot td').count(), 3, "one checkout CTA per paid tier column");
    assert.equal(await page.locator('[data-page="pricing"] .demo-box .plan-card--mini[data-tier="free"]').count(), 1, "demo card sits below the table");
    assert.equal(await standardEdition.innerText(), "Not included");
    assert.deepEqual(
      (await standardAdvanced.allTextContents()).map((text) => text.trim()),
      ["Not included", "Not included"],
    );
    assert.deepEqual(
      (await proAdvanced.allTextContents()).map((text) => text.trim()),
      ["Included", "Included"],
    );
    const priorityUpdates = page.locator(
      '[data-page="pricing"] [data-feature="priority-updates"]',
    );
    assert.deepEqual(
      (await priorityUpdates.allTextContents()).map((text) => text.trim()),
      ["Included", "Included", "Included"],
    );
    // One treatment per state: every Included cell carries matrix-included,
    // every Not included cell carries matrix-excluded, and the decorative
    // tick or dash renders identically across rows (no per-feature colour).
    const matrixCells = await page.locator('[data-page="pricing"] .plan-matrix tbody td').evaluateAll((cells) =>
      cells.map((cell) => {
        const before = getComputedStyle(cell, "::before");
        return {
          feature: cell.dataset.feature,
          text: cell.textContent.trim(),
          className: cell.className,
          marker: `${before.content}|${before.color}`,
        };
      }),
    );
    assert.equal(matrixCells.length, 33, "11 rows by 3 paid tiers");
    for (const cell of matrixCells) {
      const expected = cell.text.startsWith("Included") ? "matrix-included" : "matrix-excluded";
      assert.ok(
        cell.text.startsWith("Included") || cell.text === "Not included",
        `${cell.feature} cell reads "${cell.text}"; use Included or Not included`,
      );
      assert.equal(cell.className, expected, `${cell.feature} "${cell.text}" needs only the ${expected} class`);
    }
    for (const state of ["matrix-included", "matrix-excluded"]) {
      const markers = new Set(matrixCells.filter((cell) => cell.className === state).map((cell) => cell.marker));
      assert.equal(markers.size, 1, `every ${state} cell shares one marker treatment (got ${[...markers].join(", ")})`);
    }
    // The tick and dash carry empty CSS alt text, so screen readers hear the
    // words alone.
    const matrix = page.locator('[data-page="pricing"] .plan-matrix');
    assert.equal(
      await matrix.getByRole("cell", { name: "Not included", exact: true }).count(),
      matrixCells.filter((cell) => cell.className === "matrix-excluded").length,
      "Not included cells are announced without the dash",
    );
    assert.equal(
      await matrix.getByRole("cell", { name: "Included", exact: true }).count(),
      matrixCells.filter((cell) => cell.text === "Included").length,
      "Included cells are announced without the tick",
    );
    const exportRow = page.locator(
      '[data-page="pricing"] [data-feature="export"]',
    );
    assert.deepEqual(
      (await exportRow.allTextContents()).map((text) => text.trim()),
      ["Included", "Included", "Included"],
      "Standard includes export as Markdown or CSV, and print (MONETIZATION.md)",
    );
    assert.deepEqual(
      (await page.locator('[data-page="pricing"] [data-feature="built-in-reports"]').allTextContents()).map((text) => text.trim()),
      ["Included", "Included", "Included"],
      "built-in reports are on every tier",
    );
    const checkoutLinks = page.locator(
      '[data-page="pricing"] a[href*="lemonsqueezy.com/checkout/buy/"]',
    );
    assert.deepEqual(
      await checkoutLinks.evaluateAll((links) =>
        links.map((link) => ({
          href: link.getAttribute("href"),
          target: link.getAttribute("target"),
          rel: link.getAttribute("rel"),
        })),
      ),
      [
        {
          href: "https://missingmusic.lemonsqueezy.com/checkout/buy/97d36ad4-747a-4faa-bc60-33a40ae05907?discount=0",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        {
          href: "https://missingmusic.lemonsqueezy.com/checkout/buy/540d79f5-cb9a-4787-b54b-be2e9cc401df?discount=0",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        {
          href: "https://missingmusic.lemonsqueezy.com/checkout/buy/a267668c-b837-4261-833c-c7be9577792f?discount=0",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      ],
    );
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
