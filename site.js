/* Missing Music — public-site behaviour.
   Two small concerns, zero dependencies:
   1. Scroll reveals (IntersectionObserver adds .in to .observe elements).
   2. Release-state enhancement: every page starts with an honest static
      pre-release state and upgrades only after GitHub returns a stable public
      release. */
(function () {
  'use strict';

  /* ── 1 · Scroll reveals ─────────────────────────────────────────────── */

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

  /* ── 2 · Release-state enhancement ─────────────────────────────────── */

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
})();
