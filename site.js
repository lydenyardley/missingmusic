/* Missing Music - public-site behaviour.
   Small concerns, zero dependencies:
   1. Scroll reveals (IntersectionObserver adds .in to .observe elements).
   2. Release-state enhancement: every page starts with an honest static
      pre-release state and upgrades only after GitHub returns a stable public
      release.
   3. Small-screen menu: the primary nav collapses behind a real button
      under 620px so nothing is clipped.
   4. Sticky-header scroll state: hairline plus tint once scrolled.
   5. Appearance preview (marketing only; not the app).
   6. Phone tier switch for the pricing matrix: one tap per tier column.
   7. Proof-image lightbox: open screenshots at natural size (capped by
      viewport; never upscaled past intrinsic pixels).

   Section 7 returns early when <dialog> is unavailable, so every other
   concern must stay above it. */
(function () {
  'use strict';

  /* —— 1 · Scroll reveals ———————————————————————————————— */

  var observed = document.querySelectorAll('.observe');
  if ('IntersectionObserver' in window && observed.length) {
    document.documentElement.classList.add('io-ready');
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    observed.forEach(function (el) { io.observe(el); });
  } else {
    observed.forEach(function (el) { el.classList.add('in'); });
  }

  /* —— 2 · Release-state enhancement —————————————————————— */

  var REPO = 'lydenyardley/missingmusic';
  var RELEASES_PAGE = 'https://github.com/' + REPO + '/releases/latest';
  var API = 'https://api.github.com/repos/' + REPO + '/releases?per_page=10';

  function setReleaseLabels(label, title) {
    document.querySelectorAll('[data-release-cta]').forEach(function (el) {
      el.setAttribute('href', RELEASES_PAGE);
      el.setAttribute('title', title);
    });
    document.querySelectorAll('[data-release-cta-label]').forEach(function (el) {
      el.textContent = label;
    });
  }

  function setPreReleaseState() {
    document.documentElement.dataset.releaseState = 'pre-release';
    delete document.documentElement.dataset.releaseVersion;
    setReleaseLabels('Download the demo', 'Download the latest Missing Music demo from GitHub Releases');
    document.querySelectorAll('[data-release-note]').forEach(function (el) {
      el.textContent = '';
    });
  }

  function setLiveReleaseState(version) {
    document.documentElement.dataset.releaseState = 'live';
    document.documentElement.dataset.releaseVersion = version;
    setReleaseLabels('Download the demo', 'Download the latest Missing Music release ' + version);
    document.querySelectorAll('[data-release-note]').forEach(function (el) {
      el.textContent =
        'Latest release ' + version + ' · Verify SHA-256 on GitHub Releases.';
    });
  }

  setPreReleaseState();
  fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('release lookup failed');
      return res.json();
    })
    .then(function (releases) {
      var release = Array.isArray(releases)
        ? releases.find(function (candidate) {
            return candidate && candidate.draft === false && candidate.prerelease !== true;
          })
        : null;
      var version = release && (release.tag_name || release.name);
      if (typeof version === 'string' && version) {
        setLiveReleaseState(version);
      }
    })
    .catch(function () {
      /* The safe pre-release state is already visible; no content disappears. */
    });


  /* —— 3 · Small-screen menu —————————————————————————————— */

  (function initSiteNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    /* Keep in sync with the collapse breakpoint in styles.css. */
    var NARROW = '(max-width: 620px)';
    var narrow = window.matchMedia(NARROW);
    var isNarrow = function () { return narrow.matches; };

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
    }

    /* Closing only does work when something is open, so Escape and the
       resize reset stay quiet on desktop. */
    function close(returnFocus) {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      setOpen(false);
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener('click', function () {
      setOpen(!isNarrow() ? false : toggle.getAttribute('aria-expanded') !== 'true');
    });

    /* A plain activation inside the panel should not leave the panel covering
       the page it just scrolled to; modified clicks keep the menu open. */
    nav.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      close(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      /* A modal dialog (the proof lightbox) owns Escape and focus. */
      if (document.querySelector('dialog[open]')) return;
      close(true);
    });

    document.addEventListener('click', function (event) {
      if (!isNarrow()) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      close(false);
    });

    /* The desktop nav is always visible, so leaving the narrow range has to
       drop the open state rather than strand it on a hidden panel. */
    function onNarrowChange() { if (!isNarrow()) close(false); }
    if (typeof narrow.addEventListener === 'function') {
      narrow.addEventListener('change', onNarrowChange);
    } else if (typeof narrow.addListener === 'function') {
      narrow.addListener(onNarrowChange);
    }
  })();

  /* —— 4 · Sticky-header scroll state ——————————————————————— */

  (function initHeaderScrollState() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var pending = 0;
    function update() {
      pending = 0;
      header.classList.toggle('is-scrolled', window.scrollY > 4);
    }
    window.addEventListener('scroll', function () {
      if (pending) return;
      pending = window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  })();

  /* —— 5 · Appearance preview (marketing only; not the app) ——— */

  (function initAppearancePreview() {
    var root = document.documentElement;
    var themeBtns = document.querySelectorAll("[data-theme-btn]");
    if (!themeBtns.length) return;

    function setTheme(theme) {
      root.setAttribute("data-theme", theme);
      themeBtns.forEach(function (btn) {
        btn.setAttribute(
          "aria-pressed",
          btn.getAttribute("data-theme-btn") === theme ? "true" : "false"
        );
      });
    }

    themeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(btn.getAttribute("data-theme-btn"));
      });
    });

    var swatches = document.querySelectorAll(".swatches button[data-accent]");
    swatches.forEach(function (btn) {
      btn.addEventListener("click", function () {
        swatches.forEach(function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");
        var strong = btn.getAttribute("data-accent");
        var soft = btn.getAttribute("data-soft");
        if (strong) {
          root.style.setProperty("--bronze", strong);
          root.style.setProperty("--color-brand", soft || strong);
        }
        if (soft) {
          root.style.setProperty("--accent", soft);
        }
      });
    });
  })();

  /* —— 5b · Proof slide ——————————————————————————————— */
  /* One shot when the row enters. CSS owns the from/to transform. */

  (function initProofSlide() {
    var rows = document.querySelectorAll('[data-slide]');
    if (!rows.length || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rows.forEach(function (row) { row.classList.add('is-in'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    rows.forEach(function (row) { observer.observe(row); });
  })();

  (function initDiscDemo() {
    var root = document.querySelector('[data-disc-demo]');
    if (!root) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cards = Array.prototype.slice.call(root.querySelectorAll('.disc-demo__grid li'));
    var empty = root.querySelector('.disc-demo__empty');
    var own = 'all';
    var types = {};
    root.querySelectorAll('button[data-type]').forEach(function (btn) {
      types[btn.getAttribute('data-type')] = btn.getAttribute('aria-pressed') === 'true';
    });
    function rowCap() {
      var grid = root.querySelector('.disc-demo__grid');
      var cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      return Math.max(1, cols) * 2;
    }
    function apply(animate) {
      var first = new Map();
      if (animate && !reduce) {
        cards.forEach(function (card) {
          if (!card.hidden) first.set(card, card.getBoundingClientRect());
        });
      }
      var buckets = {};
      var keys = [];
      cards.forEach(function (card) {
        var type = card.getAttribute('data-type');
        var show = types[type] && (own === 'all' || card.getAttribute('data-own') === own);
        if (!show) return;
        if (!buckets[type]) {
          buckets[type] = [];
          keys.push(type);
        }
        buckets[type].push(card);
      });
      var cap = rowCap();
      var chosen = [];
      var round = 0;
      var added = true;
      while (chosen.length < cap && added) {
        added = false;
        keys.forEach(function (key) {
          if (chosen.length >= cap) return;
          var card = buckets[key][round];
          if (!card) return;
          chosen.push(card);
          added = true;
        });
        round += 1;
      }
      var chosenSet = new Set(chosen);
      cards.forEach(function (card) { card.hidden = !chosenSet.has(card); });
      if (empty) empty.hidden = chosen.length !== 0;
      if (!animate || reduce) return;
      cards.forEach(function (card) {
        if (card.hidden) return;
        var prev = first.get(card);
        var next = card.getBoundingClientRect();
        if (!prev) {
          card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
          return;
        }
        var dx = prev.left - next.left;
        var dy = prev.top - next.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        card.animate(
          [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
          { duration: 360, easing: 'cubic-bezier(.22,.8,.2,1)' }
        );
      });
    }
    root.addEventListener('click', function (event) {
      var ownBtn = event.target.closest('button[data-own]');
      if (ownBtn && root.contains(ownBtn)) {
        own = ownBtn.getAttribute('data-own');
        root.querySelectorAll('button[data-own]').forEach(function (btn) {
          btn.setAttribute('aria-pressed', btn === ownBtn ? 'true' : 'false');
        });
        apply(true);
        return;
      }
      var typeBtn = event.target.closest('button[data-type]');
      if (!typeBtn || !root.contains(typeBtn)) return;
      var key = typeBtn.getAttribute('data-type');
      types[key] = !types[key];
      typeBtn.setAttribute('aria-pressed', types[key] ? 'true' : 'false');
      apply(true);
    });
    apply(false);
    var grid = root.querySelector('.disc-demo__grid');
    if (window.ResizeObserver && grid) {
      new ResizeObserver(function () { apply(false); }).observe(grid);
    } else {
      window.addEventListener('resize', function () { apply(false); });
    }
  })();

  /* One name per zoom control (SC26): the accessible name and the tooltip
     carry the same string, and the fallback for a screenshot with no alt is
     the same words the lightbox uses. Declared here, above its first caller. */
  var SCREENSHOT_FALLBACK = 'Missing Music screenshot';

  function viewFullSizeLabel(name) {
    return 'View full size: ' + (name || SCREENSHOT_FALLBACK);
  }

  (function initReportStage() {
    var strip = document.querySelector('[data-report-stage]');
    if (!strip) return;
    var frames = Array.prototype.slice.call(strip.querySelectorAll('.proof-frame'));
    if (frames.length < 2) return;
    var index = 0;
    function syncFrame(frame, role) {
      frame.classList.remove('is-focus', 'is-prev', 'is-next');
      if (role) frame.classList.add(role);
      var img = frame.querySelector('img');
      if (!img) return;
      var base = img.getAttribute('alt') || SCREENSHOT_FALLBACK;
      if (role === 'is-focus') {
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', viewFullSizeLabel(base));
        img.setAttribute('title', viewFullSizeLabel(base));
      } else {
        img.setAttribute('tabindex', '-1');
        img.removeAttribute('role');
        img.removeAttribute('aria-label');
        img.removeAttribute('title');
      }
    }
    function place(next) {
      var len = frames.length;
      index = (next + len) % len;
      frames.forEach(function (frame, n) {
        var role = 'is-next';
        if (n === index) role = 'is-focus';
        else if (n === (index - 1 + len) % len) role = 'is-prev';
        syncFrame(frame, role);
      });
    }
    function arrow(dir, label) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'report-strip__nav report-strip__nav--' + (dir < 0 ? 'prev' : 'next');
      button.setAttribute('aria-label', label);
      button.innerHTML = dir < 0
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg>';
      button.addEventListener('click', function () { place(index + dir); });
      strip.appendChild(button);
    }
    /* The strip walks screenshots, not reports (SC27). */
    arrow(-1, 'Previous screenshot');
    arrow(1, 'Next screenshot');
    place(0);
  })();

  /* —— 6 · Phone tier switch ————————————————————————————— */
  /* A shortcut to a tier column, not a second rendering of it: every cell
     stays in the table, and swiping still moves the same scrollport. */

  (function initMatrixTierSwitch() {
    var wrap = document.querySelector('.plan-matrix-wrap');
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-matrix-tier]'));
    if (!wrap || !buttons.length) return;
    var sticky = wrap.querySelector('.plan-matrix tbody th');
    /* A jump animates through the columns in between; those scroll frames
       must not steal the pressed state on their way past. */
    var programmaticUntil = 0;
    function headFor(button) {
      return wrap.querySelector('.plan-head[data-tier="' + button.getAttribute('data-matrix-tier') + '"]');
    }
    function markActive(active) {
      buttons.forEach(function (button) {
        button.setAttribute('aria-pressed', button === active ? 'true' : 'false');
      });
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var head = headFor(button);
        if (!head) return;
        var offset = sticky ? sticky.getBoundingClientRect().width : 0;
        var delta = head.getBoundingClientRect().left - wrap.getBoundingClientRect().left - offset;
        markActive(button);
        programmaticUntil = Date.now() + 700;
        wrap.scrollTo({ left: wrap.scrollLeft + delta, behavior: 'smooth' });
      });
    });
    /* Keep the pressed state honest when the table is swiped by hand. */
    var pending = 0;
    wrap.addEventListener('scroll', function () {
      if (pending || Date.now() < programmaticUntil) return;
      pending = window.requestAnimationFrame(function () {
        pending = 0;
        var edge = wrap.getBoundingClientRect().left + (sticky ? sticky.getBoundingClientRect().width : 0);
        var best = null;
        var bestDistance = Infinity;
        buttons.forEach(function (button) {
          var head = headFor(button);
          if (!head) return;
          var distance = Math.abs(head.getBoundingClientRect().left - edge);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = button;
          }
        });
        if (best) markActive(best);
      });
    });
  })();

  /* —— 7 · Proof-image lightbox ——————————————————————————— */

  var proofImages = document.querySelectorAll('.proof-frame img');
  if (!proofImages.length || typeof HTMLDialogElement === 'undefined') {
    return;
  }

  var dialog = document.createElement('dialog');
  dialog.className = 'proof-lightbox';
  /* Named for the screenshot it shows, on open (SC26). */
  dialog.setAttribute('aria-label', SCREENSHOT_FALLBACK);
  dialog.innerHTML =
    '<form method="dialog" class="proof-lightbox__chrome">' +
      '<button type="submit" class="proof-lightbox__close" value="close">Close</button>' +
    '</form>' +
    '<div class="proof-lightbox__stage">' +
      '<img class="proof-lightbox__img" alt="" />' +
    '</div>';
  document.body.appendChild(dialog);

  var lightImg = dialog.querySelector('.proof-lightbox__img');
  var stage = dialog.querySelector('.proof-lightbox__stage');

  function applyNaturalCap() {
    var nw = lightImg.naturalWidth || 0;
    var nh = lightImg.naturalHeight || 0;
    if (!nw || !nh) return;
    /* CSS max-width/height fit the viewport; these vars cap at 100% natural. */
    lightImg.style.setProperty('--proof-natural-w', nw + 'px');
    lightImg.style.setProperty('--proof-natural-h', nh + 'px');
  }

  function openProof(sourceImg) {
    lightImg.removeAttribute('src');
    lightImg.style.removeProperty('--proof-natural-w');
    lightImg.style.removeProperty('--proof-natural-h');
    lightImg.alt = sourceImg.getAttribute('alt') || SCREENSHOT_FALLBACK;
    /* The viewer is named by the screenshot it shows, the way the app names its
       own full-image viewer; the zoom controls keep the "View full size" verb. */
    dialog.setAttribute('aria-label', lightImg.alt);
    lightImg.onload = function () {
      applyNaturalCap();
      lightImg.onload = null;
    };
    lightImg.src = sourceImg.currentSrc || sourceImg.src;
    if (lightImg.complete && lightImg.naturalWidth) applyNaturalCap();
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }

  function closeProof() {
    if (dialog.open) dialog.close();
  }

  /* Native <dialog>::backdrop does not receive clicks as event.target.
     The stage fills the dialog, so treat empty stage clicks as dismiss
     (same contract as the in-app fullscreen scrim). */
  stage.addEventListener('click', function (event) {
    if (event.target === stage) closeProof();
  });
  lightImg.addEventListener('click', function (event) {
    event.stopPropagation();
  });

  proofImages.forEach(function (img) {
    img.classList.add('proof-frame__zoomable');
    var stageFrame = img.closest('[data-report-stage] .proof-frame');
    if (!stageFrame) {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', viewFullSizeLabel(img.getAttribute('alt')));
      img.setAttribute('title', viewFullSizeLabel(img.getAttribute('alt')));
    }
    function activate(event) {
      if (img.getAttribute('tabindex') === '-1') return;
      event.preventDefault();
      openProof(img);
    }
    img.addEventListener('click', activate);
    img.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      activate(event);
    });
  });
})();
