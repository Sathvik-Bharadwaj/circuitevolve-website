/* circuitEvolve — site interactions (no dependencies) */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* mobile menu */
  var menu = $('.menu'), links = $('#navlinks');
  if (menu && links) {
    menu.addEventListener('click', function () {
      var open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open));
      links.classList.toggle('open', open);
    });
    $$('a', links).forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }); });
  }

  /* glass nav: deepen once the page scrolls */
  var navEl = $('.nav');
  var onScroll = function () { if (navEl) navEl.classList.toggle('scrolled', window.scrollY > 24); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* reveal on scroll — content is visible by default; this only animates it in */
  var revealAll = function () { $$('[data-reveal], .stat').forEach(function (el) { el.classList.add('in'); }); };
  if ('IntersectionObserver' in window && !reduced) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal], .stat').forEach(function (el) { rio.observe(el); });
    setTimeout(revealAll, 6000); // failsafe: never leave content hidden
  } else revealAll();

  /* counters */
  if ('IntersectionObserver' in window && !reduced) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; cio.unobserve(e.target);
        var el = e.target, end = parseFloat(el.dataset.count), dec = el.dataset.count.indexOf('.') >= 0;
        var sup = el.querySelector('sup'), supHtml = sup ? sup.outerHTML : '', t0 = 0;
        (function tick(t) { t0 = t0 || t; var u = Math.min(1, (t - t0) / 1400), v = end * (1 - Math.pow(1 - u, 4)); el.innerHTML = (dec ? v.toFixed(1) : Math.round(v)) + supHtml; if (u < 1) requestAnimationFrame(tick); })(performance.now());
      });
    }, { threshold: 0.5 });
    $$('[data-count]').forEach(function (el) { cio.observe(el); });
  }

  /* card spotlight */
  $$('.card').forEach(function (el) {
    el.addEventListener('pointermove', function (e) { var b = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - b.left) + 'px'); el.style.setProperty('--my', (e.clientY - b.top) + 'px'); });
  });

  /* dashboard tabs */
  var tabs = $$('[data-chart]');
  function selectTab(btn) {
    tabs.forEach(function (t) {
      var on = t === btn, pane = document.getElementById('chart-' + t.dataset.chart), sim = pane && pane.querySelector('[data-ce-sim]');
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      if (pane) pane.hidden = !on;
      if (sim && sim.__ceSim) {
        if (on) requestAnimationFrame(function () { sim.__ceSim.resize(); if (!window.ceMotionPaused && !reduced) sim.__ceSim.play(); });
        else sim.__ceSim.pause();
      }
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault();
      var n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; tabs[n].focus(); selectTab(tabs[n]);
    });
  });

  /* how-it-works steps: click to choose, otherwise auto-advance */
  var steps = $$('.step');
  if (steps.length) {
    var cur = 0, hold = 0;
    var set = function (i) {
      cur = i;
      steps.forEach(function (s, k) {
        var on = k === i; s.classList.toggle('on', on); s.setAttribute('aria-pressed', String(on));
        var bar = s.querySelector('.bar i'); if (bar && on) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
      });
      var sc = window.CEScenes && window.CEScenes['loop-scene'];
      if (sc && sc.setActive) sc.setActive(i);
    };
    steps.forEach(function (s, k) { s.addEventListener('click', function () { hold = Date.now() + 12000; set(k); }); });
    var waitScene = setInterval(function () { if (window.CEScenes && window.CEScenes['loop-scene']) { clearInterval(waitScene); set(cur); } }, 200);
    setTimeout(function () { clearInterval(waitScene); }, 8000);
    set(0);
    if (!reduced) setInterval(function () { if (!window.ceMotionPaused && Date.now() > hold && !document.hidden) set((cur + 1) % steps.length); }, 4000);
  }

  /* video */
  var video = $('video'), vbtn = $('.vbtn');
  if (video) {
    var tryPlay = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (es[0].isIntersecting && !window.ceMotionPaused && !reduced) tryPlay(); else video.pause(); }, { threshold: 0.2 }).observe(video);
    if (vbtn) vbtn.addEventListener('click', function () { if (video.paused) tryPlay(); else video.pause(); });
    video.addEventListener('play', function () { if (vbtn) vbtn.textContent = 'Pause'; });
    video.addEventListener('pause', function () { if (vbtn) vbtn.textContent = 'Play'; });
  }

  /* motion toggle */
  var mt = $('.motion-toggle');
  if (mt) mt.addEventListener('click', function () {
    window.ceMotionPaused = !window.ceMotionPaused;
    document.body.classList.toggle('motion-paused', window.ceMotionPaused);
    mt.setAttribute('aria-pressed', String(window.ceMotionPaused));
    mt.innerHTML = window.ceMotionPaused ? 'Resume motion <span aria-hidden="true">▷</span>' : 'Pause motion <span aria-hidden="true">Ⅱ</span>';
    $$('[data-ce-sim]').forEach(function (el) { var s = el.__ceSim; if (!s) return; if (window.ceMotionPaused) s.pause(); else if (s._inView && !s._static && !el.closest('[hidden]')) s.play(); });
    if (video) { if (window.ceMotionPaused) video.pause(); else if (!reduced) video.play().catch(function () {}); }
    document.dispatchEvent(new Event('ce:motion'));
  });

  /* contact form → prefilled email (static hosting has no server) */
  var form = $('#contact-form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(form);
    var body = 'Name: ' + d.get('first') + ' ' + d.get('last') + '\nEmail: ' + d.get('email') + '\nCompany: ' + d.get('company') + '\nRole: ' + d.get('role') + '\nPurpose: ' + d.get('purpose') + '\n\n' + d.get('details');
    window.location.href = 'mailto:hello@circuitevolve.com?subject=' + encodeURIComponent('OPTIM demo request: ' + d.get('company')) + '&body=' + encodeURIComponent(body);
    var st = $('#form-status'); if (st) st.textContent = 'Your email draft is ready. Send it from your email app to reach the team.';
  });

  /* year */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
