/* circuitEvolve · 3D scenes (three.js r149)
   landscape — a design space; a population of candidates descends it generation by generation
   loop      — the four-step OPTIM loop as an orbit; scroll selects the active step
   cube      — 216 PVT corners as a 6 × 6 × 6 lattice swept every generation
   netgen    — a netlist graph built by orchestrator agents that route around failures
   waves     — a field of analog waveforms settling into a clean signal
   Each scene renders only while visible, pauses with the site's motion toggle and
   draws one still frame under prefers-reduced-motion. */
(function () {
  'use strict';
  if (!window.THREE) return;
  var T = THREE;
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // electric palette: cyan = live signal, blue = structure, amber = the best / peak, coral = failure
  var COL = {
    paper: 0xF5F5F5, ink: 0xF5F5F5, lime: 0x3D7BFF, green: 0x8A8A8A, amber: 0xFFFFFF,
    night: 0x000000, panel: 0x111111, soft: 0x9A9A9A, fail: 0x5A5A5A, mint: 0x7FA8FF,
  };
  function glGood() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  if (!glGood()) { document.documentElement.classList.add('no-webgl'); return; }

  function rng(seed) { var a = seed >>> 0 || 1; var r = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; r.g = function () { var u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); }; return r; }
  var glowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    var t = new T.CanvasTexture(c); return t;
  })();
  var easeIO = function (t) { t = Math.max(0, Math.min(1, t)); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* ── stage: renderer, camera, visibility, pointer, labels ── */
  function Stage(host, o) {
    o = o || {};
    this.host = host; this.o = o;
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    r.setClearColor(0x000000, 0);
    r.domElement.className = 'scene-canvas';
    r.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(r.domElement);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(o.fov || 38, 1, 0.1, 300);
    this.t = 0; this.visible = false; this.raf = 0; this.last = 0;
    this.px = 0; this.py = 0; this.tx = 0; this.ty = 0;
    this.labels = [];
    var self = this;
    this.resize = function () {
      var b = host.getBoundingClientRect(), w = Math.max(1, b.width), h = Math.max(1, b.height);
      r.setSize(w, h, false); self.w = w; self.h = h;
      self.camera.aspect = w / h; self.camera.updateProjectionMatrix();
      if (self.onResize) self.onResize(w, h);
      if (!self.raf) self.frame(0);
    };
    if (window.ResizeObserver) new ResizeObserver(this.resize).observe(host); else window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', function (e) {
      var b = host.getBoundingClientRect();
      self.tx = ((e.clientX - b.left) / b.width - 0.5) * 2;
      self.ty = ((e.clientY - b.top) / b.height - 0.5) * 2;
    }, { passive: true });
    new IntersectionObserver(function (es) { es.forEach(function (e) { self.visible = e.isIntersecting; self.kick(); }); }, { rootMargin: '120px 0px' }).observe(host);
    document.addEventListener('visibilitychange', function () { self.kick(); });
    document.addEventListener('ce:motion', function () { self.kick(); });
  }
  Stage.prototype.kick = function () {
    var self = this;
    if (REDUCED || window.ceMotionPaused || document.hidden || !this.visible) { cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; return; }
    if (!this.raf) this.raf = requestAnimationFrame(function (t) { self.loop(t); });
  };
  Stage.prototype.loop = function (now) {
    var self = this;
    var dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.frame(dt);
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
  };
  Stage.prototype.frame = function (dt) {
    this.t += dt;
    this.px += (this.tx - this.px) * Math.min(1, dt * 2.5);
    this.py += (this.ty - this.py) * Math.min(1, dt * 2.5);
    if (this.update) this.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };
  Stage.prototype.label = function (el, pos) { this.labels.push({ el: el, pos: pos }); };
  var _v = new T.Vector3();
  Stage.prototype.placeLabels = function () {
    for (var i = 0; i < this.labels.length; i++) {
      var L = this.labels[i];
      _v.copy(L.pos);
      if (L.obj) L.obj.localToWorld(_v);
      _v.project(this.camera);
      var x = (_v.x * 0.5 + 0.5) * this.w, y = (-_v.y * 0.5 + 0.5) * this.h;
      if (L.el.classList.contains('loop-label')) {
        var ew = L.el.offsetWidth, eh = L.el.offsetHeight;
        x = Math.max(6, Math.min(this.w - ew - 6, x - ew / 2)); y = y - eh / 2;
      }
      L.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      L.el.style.opacity = _v.z < 1 ? '' : '0';
    }
  };
  Stage.prototype.still = function (sec) { for (var t = 0; t < sec; t += 1 / 30) { if (this.update) this.update(1 / 30, this.t += 1 / 30); } this.renderer.render(this.scene, this.camera); this.placeLabels(); };

  function hud(host, key) { return host.parentNode.querySelector('[data-hud="' + key + '"]') || host.querySelector('[data-hud="' + key + '"]'); }
  function setText(el, v) { if (el && el.textContent !== v) el.textContent = v; }

  /* ═══ A. design-space landscape ═══ */
  function landscape(host) {
    var S = new Stage(host, { fov: 34 });
    var sc = S.scene, cam = S.camera;
    sc.fog = new T.Fog(COL.night, 20, 52);
    var R = 12, N = 96;
    var gx = 3.2, gz = -2.4;
    function H(x, z) {
      return 1.25 * Math.sin(x * 0.42) * Math.cos(z * 0.36) + 0.55 * Math.sin((x - z) * 0.62 + 1.3)
        + 0.3 * Math.cos(x * 1.1 + z * 0.4) - 3.4 * Math.exp(-((x - gx) * (x - gx) + (z - gz) * (z - gz)) / 7)
        - 1.4 * Math.exp(-((x + 5) * (x + 5) + (z - 4) * (z - 4)) / 5) + 0.006 * (x * x + z * z);
    }
    var hmin = Infinity, hmax = -Infinity;
    for (var i = 0; i <= 60; i++) for (var j = 0; j <= 60; j++) { var hh = H(-R + 2 * R * i / 60, -R + 2 * R * j / 60); hmin = Math.min(hmin, hh); hmax = Math.max(hmax, hh); }
    var score = function (h) { return 1 - (h - hmin) / (hmax - hmin); };
    var cLow = new T.Color(COL.lime), cMid = new T.Color(COL.green), cHigh = new T.Color(0x1e1e1e);
    function hcol(h, out) { var s = score(h); if (s > 0.7) out.copy(cMid).lerp(cLow, (s - 0.7) / 0.3); else out.copy(cHigh).lerp(cMid, s / 0.7); return out; }
    // filled surface (occludes back lines)
    var pg = new T.PlaneGeometry(2 * R, 2 * R, N, N); pg.rotateX(-Math.PI / 2);
    var pp = pg.attributes.position;
    for (i = 0; i < pp.count; i++) pp.setY(i, H(pp.getX(i), pp.getZ(i)));
    pg.computeVertexNormals();
    var surf = new T.Mesh(pg, new T.MeshBasicMaterial({ color: COL.night, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    sc.add(surf);
    // contour-style grid lines
    var pos = [], col = [], c = new T.Color(), STEP = 48, SUB = 160;
    for (var k = 0; k <= STEP; k++) {
      var fixed = -R + 2 * R * k / STEP;
      for (var dir = 0; dir < 2; dir++) {
        for (var s = 0; s < SUB; s++) {
          var a = -R + 2 * R * s / SUB, b = -R + 2 * R * (s + 1) / SUB;
          var x0 = dir ? fixed : a, z0 = dir ? a : fixed, x1 = dir ? fixed : b, z1 = dir ? b : fixed;
          var h0 = H(x0, z0), h1 = H(x1, z1);
          pos.push(x0, h0 + 0.01, z0, x1, h1 + 0.01, z1);
          hcol(h0, c); col.push(c.r, c.g, c.b); hcol(h1, c); col.push(c.r, c.g, c.b);
        }
      }
    }
    var lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    lg.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    sc.add(new T.LineSegments(lg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 })));

    // population
    var P = 72, r = rng(7);
    var pop = [], geo = new T.BufferGeometry(), parr = new Float32Array(P * 3), carr = new Float32Array(P * 3);
    geo.setAttribute('position', new T.BufferAttribute(parr, 3));
    geo.setAttribute('color', new T.BufferAttribute(carr, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({ size: 0.55, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    sc.add(pts);
    // trails
    var TR = P * 3, tpos = new Float32Array(TR * 6), tcol = new Float32Array(TR * 6);
    var tg = new T.BufferGeometry();
    tg.setAttribute('position', new T.BufferAttribute(tpos, 3));
    tg.setAttribute('color', new T.BufferAttribute(tcol, 3));
    var trails = new T.LineSegments(tg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    sc.add(trails);
    var trailList = [];
    // best marker
    var beamG = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, 4.2, 0)]);
    var beam = new T.Line(beamG, new T.LineBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.8 }));
    sc.add(beam);
    var ringPts = []; for (i = 0; i <= 64; i++) { var an = i / 64 * Math.PI * 2; ringPts.push(new T.Vector3(Math.cos(an) * 0.55, 0, Math.sin(an) * 0.55)); }
    var ring = new T.Line(new T.BufferGeometry().setFromPoints(ringPts), new T.LineBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.95 }));
    sc.add(ring);
    var bestSprite = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: COL.amber, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    bestSprite.scale.set(1.6, 1.6, 1); sc.add(bestSprite);
    var tagEl = host.querySelector('.scene-tag');
    var tagPos = new T.Vector3();
    if (tagEl) S.label(tagEl, tagPos);

    var gen = 0, G = 18, clock = 0, phase = 'hop', hold = 0, sigma = 4, best = null;
    function seed() {
      pop = []; gen = 0; sigma = 4.2; trailList = [];
      for (var i = 0; i < P; i++) { var x = (r() * 2 - 1) * R * 0.85, z = (r() * 2 - 1) * R * 0.85; pop.push({ x: x, z: z, fx: x, fz: z, tx: x, tz: z, h: H(x, z) }); }
      best = pop[0]; pop.forEach(function (p) { if (p.h < best.h) best = p; });
    }
    function nextGen() {
      gen++;
      var sorted = pop.slice().sort(function (a, b) { return a.h - b.h; });
      var elite = sorted.slice(0, Math.max(4, Math.round(P * 0.18)));
      sigma = Math.max(0.22, sigma * 0.8);
      trailList = trailList.filter(function (t) { return gen - t.gen < 3; });
      pop.forEach(function (p, i) {
        var par = i < elite.length ? elite[i] : elite[Math.floor(Math.pow(r(), 1.7) * elite.length)];
        var nx = Math.max(-R, Math.min(R, par.tx + r.g() * sigma)), nz = Math.max(-R, Math.min(R, par.tz + r.g() * sigma));
        if (i < elite.length) { nx = par.tx; nz = par.tz; }
        p.fx = p.tx; p.fz = p.tz; p.tx = nx; p.tz = nz; p.h = H(nx, nz);
        if (i >= elite.length) trailList.push({ ax: par.tx, az: par.tz, bx: nx, bz: nz, gen: gen });
      });
      best = pop[0]; pop.forEach(function (p) { if (p.h < best.h) best = p; });
      if (S.onGen) S.onGen(gen, score(best.h));
    }
    seed();
    var hudGen = hud(host, 'gen'), hudBest = hud(host, 'best'), hudState = hud(host, 'state');
    S.onGen = function (g, s) { setText(hudGen, String(g).padStart(2, '0')); setText(hudBest, s.toFixed(4)); setText(hudState, g >= G ? 'CONVERGED' : 'CONVERGING'); };
    S.onGen(0, score(best.h));
    var cw = new T.Color(0x8a8a8a), cl = new T.Color(COL.lime), ca = new T.Color(COL.amber), tmp = new T.Color();

    S.update = function (dt, t) {
      clock += dt;
      if (phase === 'hop') {
        if (clock > 1.05) { clock = 0; if (gen < G) nextGen(); else { phase = 'hold'; hold = 0; } }
      } else { hold += dt; if (hold > 3.2) { phase = 'hop'; clock = 0; seed(); S.onGen(0, score(best.h)); } }
      var k = easeIO(clock / 0.8);
      for (var i = 0; i < P; i++) {
        var p = pop[i];
        p.x = p.fx + (p.tx - p.fx) * k; p.z = p.fz + (p.tz - p.fz) * k;
        var y = H(p.x, p.z) + 0.22 + Math.sin(Math.PI * Math.min(1, k)) * 0.9 * (k < 1 ? 1 : 0);
        parr[i * 3] = p.x; parr[i * 3 + 1] = y; parr[i * 3 + 2] = p.z;
        var isBest = p === best;
        tmp.copy(cw).lerp(cl, Math.pow(score(p.h), 4)); if (isBest) tmp.copy(ca);
        var f = isBest ? 1.6 : 0.9;
        carr[i * 3] = tmp.r * f; carr[i * 3 + 1] = tmp.g * f; carr[i * 3 + 2] = tmp.b * f;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      var n = 0;
      for (var j = 0; j < trailList.length && n < TR; j++, n++) {
        var tr = trailList[j], age = gen - tr.gen + (phase === 'hop' ? clock / 1.05 : 1), a = Math.max(0, 1 - age / 2.6) * 0.55;
        var grow = tr.gen === gen ? k : 1;
        var bx = tr.ax + (tr.bx - tr.ax) * grow, bz = tr.az + (tr.bz - tr.az) * grow;
        tpos[n * 6] = tr.ax; tpos[n * 6 + 1] = H(tr.ax, tr.az) + 0.12; tpos[n * 6 + 2] = tr.az;
        tpos[n * 6 + 3] = bx; tpos[n * 6 + 4] = H(bx, bz) + 0.12; tpos[n * 6 + 5] = bz;
        for (var q = 0; q < 2; q++) { tcol[n * 6 + q * 3] = 0.24 * a; tcol[n * 6 + q * 3 + 1] = 0.48 * a; tcol[n * 6 + q * 3 + 2] = 1.0 * a; }
      }
      tg.setDrawRange(0, n * 2); tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true;
      var by = H(best.x, best.z);
      beam.position.set(best.x, by, best.z); ring.position.set(best.x, by + 0.05, best.z);
      var pulse = 1 + 0.25 * Math.sin(t * 4);
      ring.scale.set(pulse, 1, pulse);
      bestSprite.position.set(best.x, by + 0.25, best.z);
      tagPos.set(best.x, by + 4.4, best.z);
      // camera
      var ang = t * 0.035 + S.px * 0.25;
      cam.position.set(Math.sin(ang) * 21, 10.5 - S.py * 1.6, Math.cos(ang) * 21);
      cam.lookAt(0.8, -1.2, 0);
    };
    if (REDUCED) { for (var g = 0; g < G; g++) nextGen(); clock = 1; phase = 'hold'; S.resize(); S.still(0.1); }
    return S;
  }

  /* ═══ B. the OPTIM loop (light section) ═══ */
  function loop(host) {
    var S = new Stage(host, { fov: 34 });
    var sc = S.scene, cam = S.camera;
    var g = new T.Group(); sc.add(g);
    var RAD = 3.7;
    function circle(rad, n, y) { var a = []; for (var i = 0; i <= n; i++) { var t = i / n * Math.PI * 2; a.push(new T.Vector3(Math.cos(t) * rad, y || 0, Math.sin(t) * rad)); } return new T.BufferGeometry().setFromPoints(a); }
    g.add(new T.Line(circle(RAD, 256), new T.LineBasicMaterial({ color: COL.lime, transparent: true, opacity: 0.55 })));
    var dash = new T.Line(circle(RAD + 0.55, 256), new T.LineDashedMaterial({ color: COL.green, dashSize: 0.12, gapSize: 0.2, transparent: true, opacity: 0.7 }));
    dash.computeLineDistances(); g.add(dash);
    g.add(new T.Line(circle(RAD - 0.6, 256), new T.LineBasicMaterial({ color: COL.soft, transparent: true, opacity: 0.18 })));
    // ticks
    var tk = []; for (var i = 0; i < 72; i++) { var a = i / 72 * Math.PI * 2, l = i % 18 === 0 ? 0.5 : 0.18; tk.push(new T.Vector3(Math.cos(a) * (RAD - 0.6), 0, Math.sin(a) * (RAD - 0.6)), new T.Vector3(Math.cos(a) * (RAD - 0.6 - l), 0, Math.sin(a) * (RAD - 0.6 - l))); }
    g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(tk), new T.LineBasicMaterial({ color: COL.soft, transparent: true, opacity: 0.35 })));
    // stations
    var stations = [], labels = host.querySelectorAll('.loop-label');
    for (i = 0; i < 4; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 2;
      var m = new T.Mesh(new T.SphereGeometry(0.2, 24, 16), new T.MeshBasicMaterial({ color: COL.soft }));
      m.position.set(Math.cos(ang) * RAD, 0, Math.sin(ang) * RAD); g.add(m);
      var halo = new T.Mesh(new T.RingGeometry(0.34, 0.38, 48), new T.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0, side: T.DoubleSide }));
      halo.rotation.x = -Math.PI / 2; halo.position.copy(m.position); g.add(halo);
      stations.push({ m: m, halo: halo, ang: ang });
      if (labels[i]) { var lp = new T.Vector3(Math.cos(ang) * RAD, 1.05, Math.sin(ang) * RAD); S.labels.push({ el: labels[i], pos: lp, obj: g }); }
    }
    // centre cloud: candidates converge at step 3
    var CN = 420, cr = rng(3), base = new Float32Array(CN * 3), cp = new Float32Array(CN * 3);
    for (i = 0; i < CN; i++) { var u = cr() * 2 - 1, th = cr() * Math.PI * 2, rr = Math.cbrt(cr()) * 2.6, s2 = Math.sqrt(1 - u * u); base[i * 3] = s2 * Math.cos(th) * rr; base[i * 3 + 1] = u * rr * 0.6; base[i * 3 + 2] = s2 * Math.sin(th) * rr; }
    var cg = new T.BufferGeometry(); cg.setAttribute('position', new T.BufferAttribute(cp, 3));
    var cloud = new T.Points(cg, new T.PointsMaterial({ color: COL.lime, size: 0.08, map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending }));
    g.add(cloud);
    var core = new T.Mesh(new T.IcosahedronGeometry(0.5, 1), new T.MeshBasicMaterial({ color: COL.amber, wireframe: true, transparent: true, opacity: 0.6 }));
    g.add(core);
    // packets
    var PK = 3, pk = [];
    for (i = 0; i < PK; i++) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: COL.lime, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      sp.scale.set(0.7, 0.7, 1); g.add(sp); pk.push({ s: sp, off: i / PK });
    }
    var active = 0, act = [1, 0, 0, 0], spread = 1;
    S.setActive = function (i) { active = i; S.kick(); if (!S.raf) S.frame(0); };
    S.update = function (dt, t) {
      for (var i = 0; i < 4; i++) {
        act[i] += ((i === active ? 1 : 0) - act[i]) * Math.min(1, dt * 5);
        var st = stations[i], k = act[i];
        st.m.scale.setScalar(1 + k * 0.9);
        st.m.material.color.setHex(k > 0.5 ? COL.amber : COL.soft);
        st.halo.material.opacity = k * (0.6 + 0.4 * Math.sin(t * 4));
        st.halo.scale.setScalar(1 + k * (0.6 + 0.3 * Math.sin(t * 4)));
        if (labels[i]) labels[i].classList.toggle('on', i === active);
      }
      var target = active === 0 ? 1 : active === 1 ? 0.8 : active === 2 ? 0.22 : 0.12;
      spread += (target - spread) * Math.min(1, dt * 2);
      for (i = 0; i < CN; i++) {
        var w = 1 + 0.04 * Math.sin(t * 1.5 + i);
        cp[i * 3] = base[i * 3] * spread * w; cp[i * 3 + 1] = base[i * 3 + 1] * spread * w; cp[i * 3 + 2] = base[i * 3 + 2] * spread * w;
      }
      cg.attributes.position.needsUpdate = true;
      cloud.material.color.setHex(active >= 2 ? COL.lime : 0x777777);
      core.rotation.y += dt * 0.4; core.rotation.x += dt * 0.2;
      core.scale.setScalar(0.8 + (1 - spread) * 0.9);
      pk.forEach(function (p) {
        var a = -Math.PI / 2 + ((t * 0.12 + p.off) % 1) * Math.PI * 2;
        p.s.position.set(Math.cos(a) * RAD, 0, Math.sin(a) * RAD);
      });
      g.rotation.y = -active * Math.PI / 2 * 0 + S.px * 0.25 + Math.sin(t * 0.2) * 0.05;
      var fit = Math.max(1, 1.2 / Math.max(0.5, S.w / S.h)); cam.position.set(0, (8.8 - S.py * 0.8) * fit, 14.4 * fit);
      cam.lookAt(0, -0.4, 0);
    };
    if (REDUCED) { S.resize(); S.still(1); }
    return S;
  }

  /* ═══ C. 216-corner PVT cube ═══ */
  function cube(host) {
    var S = new Stage(host, { fov: 30 });
    var sc = S.scene, cam = S.camera, n = 6, gap = 1.12;
    sc.add(new T.HemisphereLight(0xffffff, 0x000000, 0.62));
    var dl = new T.DirectionalLight(0xffffff, 0.55); dl.position.set(5, 9, 6); sc.add(dl);
    var dl2 = new T.DirectionalLight(0x3d7bff, 0.25); dl2.position.set(-6, -3, 4); sc.add(dl2);
    var grp = new T.Group(); sc.add(grp);
    var box = new T.BoxGeometry(0.7, 0.7, 0.7);
    var mat = new T.MeshStandardMaterial({ roughness: 0.42, metalness: 0.08 });
    var mesh = new T.InstancedMesh(box, mat, n * n * n);
    grp.add(mesh);
    var off = (n - 1) * gap / 2, dummy = new T.Object3D(), r = rng(5);
    var cells = [];
    for (var x = 0; x < n; x++) for (var y = 0; y < n; y++) for (var z = 0; z < n; z++) cells.push({ x: x, y: y, z: z, noise: r.g() * 0.025, m: 0, shown: 0, hit: -9 });
    var outline = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(n * gap + 0.3, n * gap + 0.3, n * gap + 0.3)), new T.LineBasicMaterial({ color: COL.lime, transparent: true, opacity: 0.35 }));
    grp.add(outline);
    var plane = new T.Mesh(new T.PlaneGeometry(n * gap + 0.8, n * gap + 0.8), new T.MeshBasicMaterial({ color: COL.lime, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false }));
    plane.rotation.y = Math.PI / 2; grp.add(plane);
    var planeEdge = new T.LineSegments(new T.EdgesGeometry(plane.geometry), new T.LineBasicMaterial({ color: COL.lime, transparent: true, opacity: 0.8 }));
    plane.add(planeEdge);
    var PO = [0.1, 0.06, -0.1, 0.02, -0.04, -0.05], TO = [0.03, 0.04, 0.05, 0.03, -0.03, -0.09], VO = [-0.07, -0.02, 0.02, 0.025, 0.015, 0.0];
    var G = 12, gen = 0, st = 0, state = 'sweep';
    function margin(c, g) { var b = -0.17 + 0.27 * (1 - Math.pow(1 - g / G, 3)); var m = b + PO[c.x] + TO[c.y] + VO[c.z] + c.noise * (1 - g / G * 0.7); if (g === G) m = Math.max(m, 0.012); return m; }
    cells.forEach(function (c) { c.m = c.shown = margin(c, 0); });
    var cF = new T.Color(COL.fail), cP = new T.Color(COL.lime), cL = new T.Color(0xffffff), cW = new T.Color(0xbdbdbd), tmp = new T.Color();
    function colorOf(m) { if (m < 0) return tmp.copy(cF).multiplyScalar(0.72 + Math.min(0.28, -m * 2)); if (m < 0.025) return tmp.copy(cW); return tmp.copy(cP).lerp(cL, Math.min(1, m * 5)); }
    var hPass = hud(host, 'pass'), hGen = hud(host, 'gen'), hBar = hud(host, 'bar');
    var axisEls = host.querySelectorAll('.axis-label');
    var axes = [new T.Vector3(0, -off - 1.1, off + 1.1), new T.Vector3(-off - 1.1, 0, off + 1.1), new T.Vector3(off + 1.1, -off - 1.1, 0)];
    axisEls.forEach(function (el, i) { if (axes[i]) S.labels.push({ el: el, pos: axes[i], obj: grp }); });
    S.update = function (dt, t) {
      st += dt;
      var sweepX = -1;
      if (state === 'sweep') {
        var k = easeIO(st / 1.5); sweepX = k * (n + 1) - 0.5;
        if (gen > 0) cells.forEach(function (c) { if (c.x <= sweepX && c.hit < gen) { c.hit = gen; c.m = margin(c, gen); c.pop = 0; } });
        if (st > 1.5) { state = 'rest'; st = 0; }
      } else if (state === 'rest') { if (st > 0.5) { if (gen < G) { gen++; state = 'sweep'; st = 0; } else { state = 'hold'; st = 0; } } }
      else if (state === 'hold') { if (st > 4) { gen = 0; cells.forEach(function (c) { c.m = margin(c, 0); c.hit = -9; }); state = 'sweep'; st = 0; } }
      plane.visible = state === 'sweep' && gen > 0;
      plane.position.x = sweepX * gap - off;
      var pass = 0;
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        c.shown += (c.m - c.shown) * Math.min(1, dt * 8);
        if (c.m >= 0) pass++;
        if (c.pop != null) c.pop += dt;
        var s = c.pop != null && c.pop < 0.45 ? 1 + 0.35 * (1 - c.pop / 0.45) : 1;
        dummy.position.set(c.x * gap - off, c.y * gap - off, c.z * gap - off);
        dummy.scale.setScalar(s * (c.shown < 0 ? 0.86 : 1));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, colorOf(c.shown));
      }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      setText(hPass, String(pass)); setText(hGen, String(gen).padStart(2, '0'));
      if (hBar) hBar.style.transform = 'scaleX(' + (pass / 216).toFixed(3) + ')';
      grp.rotation.y = t * 0.16 + S.px * 0.5;
      grp.rotation.x = 0.42 + S.py * 0.15;
      cam.position.set(0, 0.4, 23); cam.lookAt(0, 0, 0);
    };
    if (REDUCED) { gen = G; cells.forEach(function (c) { c.m = c.shown = margin(c, G); }); state = 'hold'; S.resize(); S.still(0.1); }
    return S;
  }

  /* ═══ D. NetGen — orchestrator agents building a netlist ═══ */
  function netgen(host) {
    var S = new Stage(host, { fov: 36, lift: +(host.dataset.lift || 0), dist: +(host.dataset.dist || 12.5) });
    var sc = S.scene, cam = S.camera, grp = new T.Group(); sc.add(grp);
    var wide = function () { return S.w > 900; };
    var r = rng(21), N = 34, nodes = [];
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.39996;
      var R = 4 + r.g() * 0.4;
      nodes.push(new T.Vector3(Math.cos(th) * rad * R, y * R * 0.82, Math.sin(th) * rad * R));
    }
    var kinds = nodes.map(function (_, i) { return i % 7 === 0 ? 'port' : i % 3 === 0 ? 'passive' : 'mos'; });
    // candidate edges: k nearest
    var edges = [];
    nodes.forEach(function (a, i) {
      var d = nodes.map(function (b, j) { return { j: j, d: a.distanceTo(b) }; }).filter(function (o) { return o.j !== i; }).sort(function (p, q) { return p.d - q.d; }).slice(0, 3);
      d.forEach(function (o) { if (!edges.some(function (e) { return (e.a === i && e.b === o.j) || (e.a === o.j && e.b === i); })) edges.push({ a: i, b: o.j, state: 0, t: 0 }); });
    });
    // node meshes
    var nm = { mos: new T.MeshBasicMaterial({ color: COL.green }), passive: new T.MeshBasicMaterial({ color: COL.soft }), port: new T.MeshBasicMaterial({ color: COL.lime }) };
    var shapes = { mos: new T.BoxGeometry(0.26, 0.26, 0.26), passive: new T.OctahedronGeometry(0.2), port: new T.SphereGeometry(0.18, 16, 12) };
    var meshes = nodes.map(function (p, i) { var m = new T.Mesh(shapes[kinds[i]], nm[kinds[i]]); m.position.copy(p); grp.add(m); return m; });
    // edge geometry
    var E = edges.length, ep = new Float32Array(E * 6), ec = new Float32Array(E * 6);
    edges.forEach(function (e, k) { var a = nodes[e.a], b = nodes[e.b]; ep.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6); });
    var eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(ep, 3)); eg.setAttribute('color', new T.BufferAttribute(ec, 3));
    grp.add(new T.LineSegments(eg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })));
    // agents
    var agents = [];
    for (i = 0; i < 3; i++) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: COL.amber, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      sp.scale.set(0.7, 0.7, 1); grp.add(sp);
      agents.push({ s: sp, at: i * 11, to: -1, e: -1, k: 0 });
    }
    var cGhost = new T.Color(0x222222), cOk = new T.Color(COL.mint), cNew = new T.Color(COL.lime), cFail = new T.Color(0xffffff), c = new T.Color();
    var built = 0, failed = 0, hB = hud(host, 'built'), hF = hud(host, 'fixed');
    function pickEdge(ag) {
      var opts = []; edges.forEach(function (e, k) { if (e.a === ag.at || e.b === ag.at) opts.push(k); });
      var fresh = opts.filter(function (k) { return edges[k].state === 0; });
      var k = (fresh.length ? fresh : opts)[Math.floor(r() * (fresh.length ? fresh : opts).length)];
      ag.e = k; ag.to = edges[k].a === ag.at ? edges[k].b : edges[k].a; ag.k = 0;
    }
    agents.forEach(pickEdge);
    S.update = function (dt, t) {
      agents.forEach(function (ag) {
        ag.k += dt * 1.25;
        var a = nodes[ag.at], b = nodes[ag.to];
        ag.s.position.lerpVectors(a, b, easeIO(Math.min(1, ag.k)));
        if (ag.k >= 1) {
          var e = edges[ag.e];
          if (e.state === 0) {
            if (r() < 0.16) { e.state = 2; e.t = t; failed++; } else { e.state = 1; e.t = t; built++; }
          } else if (e.state === 2 && t - e.t > 0.8) { e.state = 1; e.t = t; built++; }
          ag.at = ag.to; pickEdge(ag);
        }
      });
      if (built >= edges.length * 0.92) { edges.forEach(function (e) { e.state = 0; }); built = 0; failed = 0; }
      edges.forEach(function (e, k) {
        var age = t - e.t;
        if (e.state === 0) c.copy(cGhost);
        else if (e.state === 2) c.copy(cFail).multiplyScalar(0.7 + 0.3 * Math.sin(t * 12));
        else c.copy(cOk).lerp(cNew, Math.max(0, 1 - age / 1.2));
        ec.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
      });
      eg.attributes.color.needsUpdate = true;
      meshes.forEach(function (m, i) { m.rotation.y = t * 0.6 + i; m.rotation.x = t * 0.4; });
      setText(hB, String(built)); setText(hF, String(failed));
      grp.rotation.y = t * 0.1 + S.px * 0.4; grp.rotation.x = S.py * 0.2; grp.position.x = wide() ? +(host.dataset.x || 0) : 0;
      cam.position.set(0, S.o.lift || 0, S.o.dist || 12.5); cam.lookAt(0, S.o.lift || 0, 0);
    };
    if (REDUCED) { edges.forEach(function (e) { e.state = 1; e.t = -9; }); built = edges.length; S.resize(); S.still(0.1); }
    return S;
  }

  /* ═══ E. analog waveforms ═══ */
  function waves(host) {
    var S = new Stage(host, { fov: 40 });
    var sc = S.scene, cam = S.camera;
    sc.fog = new T.Fog(COL.night, 14, 34);
    var L = 16, P = 240, lines = [];
    var cA = new T.Color(0x2a2a2a), cB = new T.Color(COL.lime);
    for (var i = 0; i < L; i++) {
      var g = new T.BufferGeometry(), arr = new Float32Array(P * 3);
      g.setAttribute('position', new T.BufferAttribute(arr, 3));
      var k = i / (L - 1);
      var ln = new T.Line(g, new T.LineBasicMaterial({ color: new T.Color().copy(cA).lerp(cB, Math.pow(k, 2.2)), transparent: true, opacity: 0.25 + 0.75 * Math.pow(k, 1.5) }));
      ln.position.z = -14 + i * 0.95; sc.add(ln);
      lines.push({ arr: arr, g: g, f: 0.35 + (i % 5) * 0.11, ph: i * 0.7, amp: 0.6 + (i % 3) * 0.35 });
    }
    var dots = new T.BufferGeometry(), da = new Float32Array(12 * 3); dots.setAttribute('position', new T.BufferAttribute(da, 3));
    sc.add(new T.Points(dots, new T.PointsMaterial({ map: glowTex, color: COL.amber, size: 0.55, transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
    S.update = function (dt, t) {
      var settle = 0.5 + 0.5 * Math.cos(t * 0.35);
      lines.forEach(function (ln, i) {
        var front = i === L - 1;
        for (var p = 0; p < P; p++) {
          var x = -13 + 26 * p / (P - 1);
          var y = Math.sin(x * ln.f + t * 0.9 + ln.ph) * ln.amp + Math.sin(x * ln.f * 2.7 - t * 1.3 + ln.ph) * ln.amp * 0.35 * (front ? settle : 1)
            + Math.sin(x * 4.1 + t * 3 + i) * 0.08 * (front ? settle : 1);
          ln.arr[p * 3] = x; ln.arr[p * 3 + 1] = y - 1; ln.arr[p * 3 + 2] = 0;
        }
        ln.g.attributes.position.needsUpdate = true;
        if (front) for (var d = 0; d < 12; d++) { var q = Math.floor(((t * 0.06 + d / 12) % 1) * (P - 1)); da[d * 3] = ln.arr[q * 3]; da[d * 3 + 1] = ln.arr[q * 3 + 1]; da[d * 3 + 2] = -14 + i * 0.95; }
      });
      dots.attributes.position.needsUpdate = true;
      cam.position.set(S.px * 1.2, 2.6 - S.py * 0.6, 9.5); cam.lookAt(0, -0.6, -4);
    };
    if (REDUCED) { S.resize(); S.still(0.1); }
    return S;
  }

  var MAKERS = { landscape: landscape, loop: loop, cube: cube, netgen: netgen, waves: waves };
  window.CEScenes = {};
  document.querySelectorAll('[data-scene]').forEach(function (el) {
    var f = MAKERS[el.getAttribute('data-scene')];
    if (!f) return;
    try { var s = f(el); el.__scene = s; window.CEScenes[el.id || el.getAttribute('data-scene')] = s; el.classList.add('scene-ready'); }
    catch (e) { console.error('[scenes]', e); el.classList.add('scene-failed'); }
  });
})();
