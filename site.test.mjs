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
      "pricing-preview",
    ],
    assets: [
      "media/hero-library.png",
      "media/edition-comparison.svg",
      "media/report-extended-editions.svg",
      "media/report-missing-tracks.svg",
    ],
    placeholders: 0,
  },
  {
    path: "/features.html",
    page: "features",
    h1: "From your folders to a collection you can finish.",
    sections: [
      "hero",
      "scan",
      "match",
      "gap",
      "edition-intelligence",
      "next-action",
      "trust",
      "collector-workflow",
    ],
    assets: [
      "media/hero-library.png",
      "media/edition-comparison.svg",
      "media/report-extended-editions.svg",
      "media/report-missing-tracks.svg",
      "media/wishlist-recommendations.svg",
    ],
    placeholders: 0,
  },
  {
    path: "/pricing.html",
    page: "pricing",
    h1: "Pay once for the library you actually run.",
    sections: ["hero", "plans", "faq"],
    assets: [],
  },
];

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
  );
  assert.equal(await page.locator(".site-header [data-release-cta]").count(), 1, "nav CTA should be in the header");
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
    if (viewport.width <= 620) {
      assert.equal(await page.locator("#matrix-scroll-note").evaluate((element) => getComputedStyle(element).display), "block");
    }
  }
  if (definition.page === "home") {
    assert.equal(await page.locator(".hero .btn-ghost").count(), 1, "hero should have edition comparison ghost button");
    assert.equal(await page.locator(".hero .btn-ghost").innerText(), "Find bonus tracks");
    assert.equal(await page.locator("[data-release-cta]").count(), 3, "nav + hero + pricing preview CTAs");
    assert.equal(await page.locator(".hero-wedge").innerText().then((text) => text.includes("Lidarr")), true);
    assert.equal(await page.locator('[data-section="pricing-preview"] [data-tier]').count(), 2);
    assert.equal(
      await page.locator('[data-section="pricing-preview"] .plan-card--pro .plan-card__badge').innerText(),
      "Most collectors choose this",
    );
    assert.equal(
      await page.locator('[data-section="pricing-preview"] .plan-card--pro .plan-card__use').innerText(),
      "Find pressings with bonus tracks, spot incomplete copies, and more.",
    );
    assert.equal(await page.locator('[data-section="pricing-preview"] .btn-primary').count(), 1);
  }
  assert.ok(
    (await page.locator(".cta-install-note, .fine").count()) >= 1,
    `${definition.path} is missing trust or fine-print notes near download`,
  );
  if (definition.page === "features") {
    assert.equal(await page.locator('.report-gallery__hero img[src="media/edition-comparison.svg"]').count(), 1);
    assert.equal(await page.locator(".report-gallery__support img").count(), 2);
    assert.equal(await page.locator('a[href="https://picard.musicbrainz.org/"]').count(), 1);
    assert.deepEqual(
      await page.locator(".kicker").allTextContents(),
      [
        "01 · Start with what you own",
        "02 · Build the complete picture",
        "03 · See the gap",
        "04 · Investigate editions and Reports",
        "05 · Choose what to pursue",
      ],
    );
    // [P3] DOM-first = visually-first at wide viewports. Each `.guide-step`
    // has a copy block (DOM-first) followed by a proof element (DOM-second).
    // Earlier the CSS put `.guide-step__copy { order: 2 }` on `:nth-of-type(even)`,
    // swapping DOM vs visual at >900px. Pin DOM = visual here so a regression
    // cannot re-introduce the order-swap.
    if (viewport.width >= 900) {
      const guideSteps = await page.locator(".guide-step").evaluateAll((steps) =>
        steps.map((step) => {
          const copy = step.querySelector(".guide-step__copy");
          const proof = copy ? copy.nextElementSibling : null;
          if (!copy || !proof) return null;
          const cb = copy.getBoundingClientRect();
          const pb = proof.getBoundingClientRect();
          return { copyLeft: cb.left, proofLeft: pb.left };
        }),
      );
      assert.equal(guideSteps.length, 4, "features.html has 4 .guide-step sections");
      guideSteps.forEach((pos, i) => {
        assert.ok(
          pos !== null && pos.copyLeft < pos.proofLeft,
          `features.html guide-step ${i + 1}: copy (DOM-first) must be visually left of proof at >900px (got copy.x=${pos?.copyLeft}, proof.x=${pos?.proofLeft})`,
        );
      });
    }
  }
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
}

async function main() {
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
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
    }
    await noJsContext.close();

    const media = [
      "/media/hero-library.png",
      "/media/edition-comparison.svg",
      "/media/report-extended-editions.svg",
      "/media/report-missing-tracks.svg",
      "/media/wishlist-recommendations.svg",
    ];
    for (const path of media) {
      const response = await page.request.get(`${baseUrl}${path}`);
      assert.equal(response.status(), 200, `missing proof asset ${path}`);
      assert.ok((await response.body()).length > 1000, `proof asset ${path} is empty`);
    }

    await page.goto(`${baseUrl}/`);
    assert.equal(
      await page.locator("html").getAttribute("data-release-state"),
      "pre-release",
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
    assert.equal(await page.locator('[data-page="pricing"] .plan-head--pro .plan-head__badge').innerText(), "Most collectors choose this");
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
