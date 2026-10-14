/* ============================================================
   FANNTÓFELL — "Brúnin"
   Rib-raster canvas engine, hero intro + scroll dissolve, scroll
   reveals and the directory photo preview. Vanilla JS, no deps.

   Discipline (barujarn-design-system):
   - Canvas is drawn ONCE per size, on ResizeObserver only.
   - The scroll handler NEVER touches canvas pixels. It only writes
     the hero photo's opacity, once per animation frame, so the ribs
     beneath show through as the hero leaves. Grep for
     "getImageData" and "addEventListener('scroll'" to verify.
   ============================================================ */
(function () {
  'use strict';

  var clamp = function (n, min, max) { return n < min ? min : n > max ? max : n; };
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = motionQuery.matches;

  /* ---------------- Nav ---------------- */
  var nav = document.getElementById('site-nav');
  var toggle = nav && nav.querySelector('.nav-toggle');
  if (toggle) {
    var mobileNav = document.getElementById('nav-mobile');
    mobileNav.inert = true;
    function closeMenu() { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); mobileNav.inert = true; }
    document.addEventListener('keydown', function(e) { if(e.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); toggle.focus(); } });
    nav.querySelector('.nav-logo').addEventListener('click', closeMenu);
    nav.querySelector('.nav-cta').addEventListener('click', closeMenu);
    window.addEventListener('resize', function() { if(window.innerWidth > 1024) closeMenu(); });
    toggle.addEventListener('click', function (e) {
      nav.classList.toggle('keyboard-open', e.detail === 0);
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      mobileNav.inert = !open;
    });
    nav.querySelectorAll('.nav-mobile a').forEach(function (a) {
      a.addEventListener('click', function () {
        closeMenu();
      });
    });
  }

  /* ---------------- Rib canvas engine ---------------- */
  var RIB_GAP = 7;      // px, within the 6-9 band
  var ROW_STEP = 3;     // px
  var MIN_W = 0.5;      // px
  var GAMMA = 0.78;      // below 1, per system spec
  var DPR_CAP = 1.6;

  function RibCanvas(container) {
    this.container = container;
    this.img = container.querySelector('.rib-photo');
    this.canvas = container.querySelector('.rib-canvas');
    if (!this.img || !this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.imgReady = false;
    this._pendingDraw = null;

    var self = this;
    if (this.img.complete && this.img.naturalWidth) {
      this.imgReady = true;
    } else {
      this.img.addEventListener('load', function () {
        self.imgReady = true;
        self.scheduleDraw();
      });
    }
    this.img.addEventListener('error', function () {
      // Tainted or missing image: never leave a blank panel. Hide the
      // canvas and let the plain <img> (or its own broken-image box)
      // stand alone.
      self.canvas.style.display = 'none';
    });

    this.ro = new ResizeObserver(function () { self.scheduleDraw(); });
    this.ro.observe(container);

    if (this.imgReady) this.scheduleDraw();
  }

  RibCanvas.prototype.scheduleDraw = function () {
    var self = this;
    if (this._pendingDraw) cancelAnimationFrame(this._pendingDraw);
    this._pendingDraw = requestAnimationFrame(function () {
      self._pendingDraw = null;
      self.draw();
    });
  };

  // Draw is called ONLY from ResizeObserver (via scheduleDraw). It is
  // never called from the scroll/rAF ticker below.
  RibCanvas.prototype.draw = function () {
    if (!this.imgReady) return;
    var rect = this.img.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (w < 2 || h < 2) return;

    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    var cols = Math.max(1, Math.round(w / RIB_GAP));
    var rows = Math.max(1, Math.round(h / ROW_STEP));

    var off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    var octx = off.getContext('2d', { willReadFrequently: true });

    var iw = this.img.naturalWidth, ih = this.img.naturalHeight;
    if (!iw || !ih) return;
    var containerRatio = w / h, imgRatio = iw / ih;
    var sx, sy, sw, sh;
    var position = getComputedStyle(this.img).objectPosition.split(" ");
    var px = clamp(parseFloat(position[0]) / 100 || .5, 0, 1);
    var py = clamp(parseFloat(position[1]) / 100 || .5, 0, 1);
    if (imgRatio > containerRatio) {
      sh = ih; sw = ih * containerRatio; sx = (iw - sw) * px; sy = 0;
    } else {
      sw = iw; sh = iw / containerRatio; sx = 0; sy = (ih - sh) * py;
    }

    var data;
    try {
      octx.drawImage(this.img, sx, sy, sw, sh, 0, 0, cols, rows);
      data = octx.getImageData(0, 0, cols, rows).data;
    } catch (e) {
      // getImageData threw (tainted canvas). Fall back to the plain
      // photograph rather than a blank panel.
      this.canvas.style.display = 'none';
      this.container.style.setProperty('--resolve', 1);
      return;
    }

    // Rib colour is sampled live from this image's own buffer, not a
    // hardcoded token: average colour, deepened into an ink tone. Each
    // material band therefore draws in its own colour.
    var rSum = 0, gSum = 0, bSum = 0, n = cols * rows;
    for (var i = 0; i < data.length; i += 4) {
      rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
    }
    var deepen = function (c) { return Math.round((c / n) * 0.6); };
    var ribColor = 'rgb(' + deepen(rSum) + ',' + deepen(gSum) + ',' + deepen(bSum) + ')';

    var ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ribColor;

    for (var cx = 0; cx < cols; cx++) {
      var xCenter = cx * RIB_GAP + RIB_GAP / 2;
      for (var ry = 0; ry < rows; ry++) {
        var idx = (ry * cols + cx) * 4;
        var lum = (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
        var width = MIN_W + Math.pow(lum, GAMMA) * (RIB_GAP - 1 - MIN_W);
        var yTop = ry * ROW_STEP;
        ctx.fillRect(xCenter - width / 2, yTop, width, ROW_STEP + 0.5);
      }
    }

    this.canvas.style.display = '';
    this.ready = true;
  };

  if (!reduceMotion) document.querySelectorAll('.rib-band[data-rib]').forEach(function (el) {
    new RibCanvas(el);
  });

  /* ---------------- Hero: intro, then scroll dissolve back into ribs ----------------
     Rest state is the plain photograph. On load the headline rises and the
     photo develops across the rib raster (CSS, triggered by html.hero-in).
     Leaving the hero, the photo thins out over the ribs again: the canvas is
     drawn once per size and only the photo's opacity changes per frame. */
  var root = document.documentElement;
  var heroMedia = document.querySelector('.hero-media');
  var heroPhoto = heroMedia && heroMedia.querySelector('.rib-photo');
  var heroCanvas = heroMedia && heroMedia.querySelector('.rib-canvas');
  if (heroCanvas) heroCanvas.style.opacity = 1;

  function startHero() { root.classList.add('hero-in'); }
  if (root.classList.contains('rv')) {
    var waits = [document.fonts ? document.fonts.ready : null];
    if (heroPhoto && heroPhoto.decode) waits.push(heroPhoto.decode().catch(function () {}));
    var cap = new Promise(function (r) { setTimeout(r, 1200); });
    Promise.race([Promise.all(waits), cap]).then(function () {
      requestAnimationFrame(function () { requestAnimationFrame(startHero); });
    });
  } else {
    startHero();
  }

  var queued = false;
  function renderResolve() {
    queued = false;
    if (!heroMedia || !heroPhoto) return;
    if (reduceMotion || window.innerWidth < 768) { heroPhoto.style.opacity = ''; return; }
    var r = heroMedia.getBoundingClientRect();
    var out = clamp(-r.top / Math.max(r.height * .75, 1), 0, 1);
    heroPhoto.style.opacity = (1 - .6 * out).toFixed(3);
  }
  function scheduleResolve() { if (!queued) { queued = true; requestAnimationFrame(renderResolve); } }
  window.addEventListener('scroll', scheduleResolve, { passive: true });
  window.addEventListener('resize', scheduleResolve, { passive: true });
  motionQuery.addEventListener('change', function (e) { reduceMotion = e.matches; scheduleResolve(); });
  renderResolve();

  /* ---------------- Scroll reveals ----------------
     Content is visible by default; html.rv (set in <head>) hides only what
     this observer will bring back. Groups stagger their direct reveals. */
  window.__rvReady = true;
  if (root.classList.contains('rv')) {
    document.querySelectorAll('[data-rv-group]').forEach(function (group) {
      var i = 0;
      group.querySelectorAll('[data-rv]').forEach(function (el) {
        el.style.setProperty('--rv-d', (Math.min(i++, 6) * .07).toFixed(2) + 's');
      });
    });
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    document.querySelectorAll('[data-rv]').forEach(function (el) { revealer.observe(el); });
    // Anything the reader jumps past still arrives revealed.
    window.addEventListener('beforeprint', function () { root.classList.remove('rv'); });
  }

  /* ---------------- Directory: photo preview that trails the pointer ---------------- */
  var dir = document.querySelector('.product-links');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (dir && finePointer.matches) {
    var preview = document.createElement('div');
    preview.className = 'dir-preview';
    preview.setAttribute('aria-hidden', 'true');
    var shots = {};
    dir.querySelectorAll('a[data-preview]').forEach(function (a) {
      var src = a.getAttribute('data-preview');
      if (shots[src]) return;
      var img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = src;
      preview.appendChild(img);
      shots[src] = img;
    });
    document.body.appendChild(preview);
    var px = 0, py = 0, tx = 0, ty = 0, raf = 0, live = false;
    function frame() {
      // Eased follow: the card trails the pointer instead of being glued to it.
      var k = reduceMotion ? 1 : .18;
      px += (tx - px) * k; py += (ty - py) * k;
      preview.style.transform = 'translate3d(' + (px + 28).toFixed(1) + 'px,' + (py - 105).toFixed(1) + 'px,0)';
      raf = (live || Math.abs(tx - px) + Math.abs(ty - py) > .5) ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    dir.addEventListener('pointerenter', function (e) { px = tx = e.clientX; py = ty = e.clientY; live = true; kick(); });
    dir.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; kick(); });
    dir.addEventListener('pointerleave', function () { live = false; preview.classList.remove('is-on'); });
    dir.querySelectorAll('a[data-preview]').forEach(function (a) {
      a.addEventListener('pointerenter', function () {
        var want = shots[a.getAttribute('data-preview')];
        Object.keys(shots).forEach(function (k) { shots[k].classList.toggle('is-on', shots[k] === want); });
        preview.classList.add('is-on');
      });
    });
  }

  /* Header scrollspy: mark the section currently in view (ordinal-mono nav). */
  (function spy() {
    var links = document.querySelectorAll('.nav-links a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (a) { a.classList.remove('is-current'); });
          map[en.target.id].classList.add('is-current');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  })();
})();
