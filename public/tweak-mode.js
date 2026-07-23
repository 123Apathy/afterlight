/*!
 * tweak-mode.js -- click-drag-move + pull-to-resize overlay for landing.html.
 * Not the shared TweakPanel (form-based colour/text/size editing) -- that
 * tool has no direct-manipulation mode. This is a scoped prototype of that
 * missing piece, built for this page; if it proves useful it's a candidate
 * to fold into TweakPanel (HQ Vault/projects/tweakpanel) later.
 *
 * Activate with Ctrl+Shift+M (matches TweakPanel's Ctrl+Shift+E convention).
 * Inert until activated -- zero visual/behavioural impact on real visitors.
 *
 * Workflow: pick element(s) -> drag body to move, drag a handle to resize
 * -> "Copy CSS" grabs the resulting rules. These are PIXEL values at
 * whatever viewport size you were dragging at -- paste them into chat and
 * they'll get translated into the page's real fluid (clamp/vw) CSS, not
 * pasted in verbatim (that would undo the responsive scaling).
 */
(function () {
  'use strict';

  var active = false;
  var host, shadow, root;
  var selection = []; // { el, selector, startRect, overlay }
  var groupMode = false;
  var picking = false;
  var drag = null; // { kind: 'move'|'resize', handle, startX, startY, items:[{el,startRect}], groupStartRect }
  var changed = new Set(); // elements with a live edit, for CSS export

  function init() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        toggle();
      }
    });
  }

  function toggle() { active ? deactivate() : activate(); }

  function activate() {
    active = true;
    buildUI();
    document.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('resize', refreshOverlays);
    toast('Tweak mode on -- pick an element, drag to move, drag a handle to resize.');
  }

  function deactivate() {
    active = false;
    clearSelection();
    document.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('resize', refreshOverlays);
    if (host) { host.remove(); host = null; shadow = null; root = null; }
  }

  // ---- UI ---------------------------------------------------------------
  function buildUI() {
    host = document.createElement('div');
    host.id = 'tweak-mode-host';
    host.style.cssText = 'position:fixed;inset:auto;z-index:2147483647;';
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    root = document.createElement('div');
    root.className = 'panel';
    root.innerHTML =
      '<div class="hd"><b>Tweak Mode</b><span class="hint">Ctrl+Shift+M to exit</span></div>' +
      '<div class="row">' +
        '<button class="pickbtn" id="pick">Pick element</button>' +
        '<button class="pickbtn" id="pickmore" style="display:none">+ Add to group</button>' +
      '</div>' +
      '<div class="row" id="levelRow" style="display:none">' +
        '<button class="pickbtn" id="up">&uarr; Select parent</button>' +
        '<button class="pickbtn" id="down">&darr; Select child</button>' +
      '</div>' +
      '<div class="sel" id="sel">Nothing selected.</div>' +
      '<div class="row hint" id="tip"></div>' +
      '<div class="ft">' +
        '<button class="btn ghost" id="clear">Clear</button>' +
        '<button class="btn primary" id="copy">Copy CSS</button>' +
      '</div>';
    shadow.appendChild(root);

    shadow.getElementById('pick').addEventListener('click', function () { startPicking(false); });
    shadow.getElementById('pickmore').addEventListener('click', function () { startPicking(true); });
    shadow.getElementById('clear').addEventListener('click', clearSelection);
    shadow.getElementById('copy').addEventListener('click', copyCSS);
    shadow.getElementById('up').addEventListener('click', function () { stepLevel(1); });
    shadow.getElementById('down').addEventListener('click', function () { stepLevel(-1); });
  }

  // Re-targets the MOST RECENTLY selected item to its parent (dir=1) or the
  // child it was originally picked from (dir=-1, one step of undo). Handles
  // auto-climbing to the wrong ancestor without needing more size-matching
  // special cases -- same pattern as a real devtools element picker.
  function stepLevel(dir) {
    if (!selection.length) return;
    var item = selection[selection.length - 1];
    var target = dir > 0 ? item.el.parentElement : item.originalEl;
    if (!target || target === document.body) return;
    if (dir < 0 && target === item.el) return;
    if (!item.originalEl) item.originalEl = item.el;
    item.overlay.remove();
    (item.handles || []).forEach(function (h) { h.remove(); });
    item.el = target;
    item.selector = selectorFor(target);
    buildOverlayFor(item);
    updateSelInfo();
  }

  var CSS = [
    ':host{all:initial;}',
    '*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
    '.panel{position:fixed;right:18px;bottom:18px;width:280px;background:#0f1117;color:#e5e7eb;',
      'border:1px solid #1f2430;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);',
      'font-size:13px;z-index:2147483647;}',
    '.hd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1f2430;}',
    '.hd b{font-size:13px;}',
    '.hint{color:#6b7280;font-size:11px;}',
    '.row{padding:10px 14px 0;display:flex;gap:8px;}',
    '.pickbtn{flex:1;padding:9px;border:1px dashed #3a4252;border-radius:8px;background:#161a23;color:#cbd5e1;cursor:pointer;font-weight:600;font-size:12px;}',
    '.pickbtn.active{border-color:#6d28d9;color:#c4b5fd;}',
    '.sel{margin:10px 14px 0;font-size:11px;color:#a5b4fc;word-break:break-all;background:#161a23;padding:8px 9px;border-radius:7px;max-height:80px;overflow:auto;}',
    '#tip{padding:8px 14px 0;}',
    '.ft{display:flex;gap:8px;padding:12px 14px;}',
    '.btn{flex:1;padding:9px;border:0;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;}',
    '.btn.primary{background:#6d28d9;color:#fff;}',
    '.btn.ghost{background:#1c2230;color:#cbd5e1;}',
    '.toast{position:fixed;right:18px;bottom:230px;z-index:2147483647;background:#111827;color:#fff;',
      'padding:9px 14px;border-radius:8px;font-size:12px;box-shadow:0 6px 20px rgba(0,0,0,.3);',
      'max-width:280px;opacity:0;transform:translateY(6px);transition:all .18s;}',
    '.toast.show{opacity:1;transform:translateY(0);}',
    '.ov{position:fixed;z-index:2147483646;border:2px solid #6d28d9;background:rgba(109,40,217,.08);',
      'box-sizing:border-box;cursor:move;}',
    '.h{position:fixed;z-index:2147483647;width:10px;height:10px;background:#6d28d9;border:2px solid #fff;',
      'border-radius:50%;box-sizing:border-box;}',
    '.h.nw,.h.se{cursor:nwse-resize;} .h.ne,.h.sw{cursor:nesw-resize;}',
    '.h.n,.h.s{cursor:ns-resize;} .h.e,.h.w{cursor:ew-resize;}'
  ].join('');

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    shadow.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 200); }, 3200);
  }

  // ---- picking ------------------------------------------------------------
  function startPicking(adding) {
    picking = true;
    groupMode = adding;
    if (!adding) clearSelection();
    shadow.getElementById('pick').classList.add('active');
    document.body.style.cursor = 'crosshair';
    var hilite = document.createElement('div');
    hilite.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;border:2px dashed #6d28d9;background:rgba(109,40,217,.10);';
    shadow.appendChild(hilite);

    // Real page CSS can set pointer-events:none on things worth tweaking
    // (e.g. this page's .phone-mock, so it never blocks the cursor effect
    // underneath it) -- that makes elementsFromPoint hit-test straight
    // through them during a normal pick. Force everything hit-testable
    // for the duration of picking only.
    var forceHit = document.createElement('style');
    forceHit.textContent = '*{pointer-events:auto !important;}';
    document.head.appendChild(forceHit);

    function onMove(e) {
      var el = elAt(e.clientX, e.clientY);
      if (!el) { hilite.style.display = 'none'; return; }
      var r = el.getBoundingClientRect();
      hilite.style.display = 'block';
      hilite.style.left = r.left + 'px'; hilite.style.top = r.top + 'px';
      hilite.style.width = r.width + 'px'; hilite.style.height = r.height + 'px';
    }
    function onClick(e) {
      e.preventDefault(); e.stopPropagation();
      var el = elAt(e.clientX, e.clientY);
      cleanup();
      if (el) addToSelection(el);
    }
    function cleanup() {
      picking = false;
      document.body.style.cursor = '';
      hilite.remove();
      forceHit.remove();
      shadow.getElementById('pick').classList.remove('active');
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
    }
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
  }

  function elAt(x, y) {
    var els = document.elementsFromPoint(x, y);
    var el = null;
    for (var i = 0; i < els.length; i++) {
      if (els[i] === document.body || els[i] === document.documentElement) continue;
      if (host && host.contains(els[i])) continue;
      el = els[i];
      break;
    }
    if (!el) return null;
    // elementsFromPoint returns the innermost painted element (e.g. an <img>
    // deep inside .phone-mock's markup). Climb up while the parent's box is
    // ~the same size -- that walks out to the outer wrapper a person means
    // when they click "the phone", and stops once a parent is meaningfully
    // bigger (e.g. .hero-content, which shouldn't be swept in).
    var cur = el;
    while (cur.parentElement && cur.parentElement !== document.body) {
      var r1 = cur.getBoundingClientRect();
      var r2 = cur.parentElement.getBoundingClientRect();
      var closeEnough = Math.abs(r1.width - r2.width) < 12 && Math.abs(r1.height - r2.height) < 12;
      if (!closeEnough) break;
      cur = cur.parentElement;
    }
    return cur;
  }

  function selectorFor(el) {
    if (el.id) return '#' + el.id;
    var path = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      var sel = node.tagName.toLowerCase();
      if (node.classList.length) sel += '.' + Array.from(node.classList).join('.');
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (c) { return c.tagName === node.tagName; });
        if (siblings.length > 1) sel += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      }
      path.unshift(sel);
      node = parent;
    }
    return path.join(' > ');
  }

  function addToSelection(el) {
    if (selection.some(function (s) { return s.el === el; })) return;
    var item = { el: el, originalEl: el, selector: selectorFor(el) };
    selection.push(item);
    buildOverlayFor(item);
    updateSelInfo();
    shadow.getElementById('pickmore').style.display = selection.length ? 'flex' : 'none';
    shadow.getElementById('levelRow').style.display = selection.length ? 'flex' : 'none';
  }

  function clearSelection() {
    selection.forEach(function (s) {
      if (s.overlay) s.overlay.remove();
      (s.handles || []).forEach(function (h) { h.remove(); });
    });
    selection = [];
    if (shadow) {
      updateSelInfo();
      shadow.getElementById('pickmore').style.display = 'none';
      shadow.getElementById('levelRow').style.display = 'none';
    }
  }

  function updateSelInfo() {
    var sel = shadow.getElementById('sel');
    if (!selection.length) { sel.textContent = 'Nothing selected.'; return; }
    sel.textContent = selection.map(function (s) { return s.selector; }).join('\n');
  }

  // ---- overlay + handles --------------------------------------------------
  var HANDLE_POS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function buildOverlayFor(item) {
    var ov = document.createElement('div');
    ov.className = 'ov';
    shadow.appendChild(ov);
    item.overlay = ov;
    item.handles = HANDLE_POS.map(function (pos) {
      var h = document.createElement('div');
      h.className = 'h ' + pos;
      shadow.appendChild(h);
      h.addEventListener('mousedown', function (e) { startResize(e, pos); });
      return h;
    });
    ov.addEventListener('mousedown', function (e) { startMove(e); });
    positionOverlay(item);
  }

  function positionOverlay(item) {
    var r = item.el.getBoundingClientRect();
    var ov = item.overlay;
    ov.style.left = r.left + 'px'; ov.style.top = r.top + 'px';
    ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px';
    var mid = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    var coords = {
      nw: [r.left, r.top], n: [mid.x, r.top], ne: [r.right, r.top],
      e: [r.right, mid.y], se: [r.right, r.bottom], s: [mid.x, r.bottom],
      sw: [r.left, r.bottom], w: [r.left, mid.y]
    };
    item.handles.forEach(function (h, i) {
      var pos = HANDLE_POS[i];
      var c = coords[pos];
      h.style.left = (c[0] - 5) + 'px';
      h.style.top = (c[1] - 5) + 'px';
    });
  }

  function refreshOverlays() { selection.forEach(positionOverlay); }

  // ---- move / resize --------------------------------------------------------
  function startMove(e) {
    e.preventDefault(); e.stopPropagation();
    var items = selection.map(function (s) {
      var r = s.el.getBoundingClientRect();
      var cs = getComputedStyle(s.el);
      var m = cs.transform && cs.transform !== 'none' ? new DOMMatrix(cs.transform) : new DOMMatrix();
      return { s: s, startRect: r, baseX: m.m41, baseY: m.m42 };
    });
    var startX = e.clientX, startY = e.clientY;

    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      items.forEach(function (it) {
        it.s.el.style.transform = 'translate(' + (it.baseX + dx) + 'px,' + (it.baseY + dy) + 'px)';
        changed.add(it.s);
        positionOverlay(it.s);
      });
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startResize(e, handlePos) {
    e.preventDefault(); e.stopPropagation();
    // A grid/flex item with justify-self:center or align-self:stretch (this
    // page uses both) re-centers/re-stretches itself within its cell the
    // instant an explicit width/height is set, which silently moves the
    // OPPOSITE corner too -- not just the one being dragged. Pin alignment
    // to start/start so the box's current on-screen position becomes its
    // own anchor -- but do it in the SAME breath as locking in its current
    // explicit width/height (and killing any CSS aspect-ratio), because
    // stretch/center with no explicit size resolves to min-content: without
    // this, the box visibly collapses to a few px the instant you grab a
    // handle, before you've even started dragging.
    selection.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      s.el.style.justifySelf = 'start';
      s.el.style.alignSelf = 'start';
      s.el.style.width = r.width + 'px';
      s.el.style.height = r.height + 'px';
      s.el.style.aspectRatio = 'auto';
    });
    var items = selection.map(function (s) {
      return { s: s, startRect: s.el.getBoundingClientRect() };
    });
    // group bbox for proportional multi-select resize
    var gLeft = Math.min.apply(null, items.map(function (i) { return i.startRect.left; }));
    var gTop = Math.min.apply(null, items.map(function (i) { return i.startRect.top; }));
    var gRight = Math.max.apply(null, items.map(function (i) { return i.startRect.right; }));
    var gBottom = Math.max.apply(null, items.map(function (i) { return i.startRect.bottom; }));
    var g0 = { left: gLeft, top: gTop, width: gRight - gLeft, height: gBottom - gTop };
    var startX = e.clientX, startY = e.clientY;

    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      var g = { left: g0.left, top: g0.top, width: g0.width, height: g0.height };
      if (handlePos.indexOf('w') !== -1) { g.left = g0.left + dx; g.width = g0.width - dx; }
      if (handlePos.indexOf('e') !== -1) { g.width = g0.width + dx; }
      if (handlePos.indexOf('n') !== -1) { g.top = g0.top + dy; g.height = g0.height - dy; }
      if (handlePos.indexOf('s') !== -1) { g.height = g0.height + dy; }
      if (g.width < 20) g.width = 20;
      if (g.height < 20) g.height = 20;
      var sx = g.width / g0.width, sy = g.height / g0.height;

      items.forEach(function (it) {
        var r = it.startRect;
        // this item's fractional position/size within the ORIGINAL group bbox
        var relLeft = (r.left - g0.left) * sx;
        var relTop = (r.top - g0.top) * sy;
        var newLeft = g.left + relLeft;
        var newTop = g.top + relTop;
        var newW = r.width * sx;
        var newH = r.height * sy;
        var el = it.s.el;
        el.style.aspectRatio = 'auto'; // free resize wins over any CSS aspect-ratio
        el.style.width = newW + 'px';
        el.style.height = newH + 'px';
        // compensate position via transform delta from this item's own start position
        el.style.transform = 'translate(' + (newLeft - r.left) + 'px,' + (newTop - r.top) + 'px)';
        changed.add(it.s);
        positionOverlay(it.s);
      });
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ---- click gate (don't let picks/drags trigger page links etc.) --------
  function onMouseDown(e) {
    if (!active || picking) return;
    // clicks on our own overlays/handles are handled by their own listeners;
    // everything else outside the panel while a selection exists should not
    // navigate the underlying page (e.g. clicking the CTA button by mistake).
    if (host && host.contains(e.target)) return;
    var onOverlay = selection.some(function (s) { return s.overlay === e.target || (s.handles || []).indexOf(e.target) !== -1; });
    if (onOverlay) return;
    if (selection.length) e.preventDefault();
  }

  // ---- export -----------------------------------------------------------
  function copyCSS() {
    if (!changed.size) { toast('Nothing changed yet.'); return; }
    var seen = new Set();
    var blocks = [];
    changed.forEach(function (s) {
      if (seen.has(s.selector)) return;
      seen.add(s.selector);
      var cs = getComputedStyle(s.el);
      var lines = [];
      if (cs.transform && cs.transform !== 'none') lines.push('  transform: ' + cs.transform + ';');
      if (s.el.style.width) lines.push('  width: ' + s.el.style.width + ';');
      if (s.el.style.height) lines.push('  height: ' + s.el.style.height + ';');
      if (s.el.style.aspectRatio) lines.push('  aspect-ratio: ' + s.el.style.aspectRatio + ';');
      if (lines.length) blocks.push(s.selector + ' {\n' + lines.join('\n') + '\n}');
    });
    var css = blocks.join('\n\n');
    navigator.clipboard.writeText(css).then(function () {
      toast('Copied ' + blocks.length + ' rule(s). These are PIXEL values at this viewport -- paste them into chat and they will be translated into proper fluid CSS.');
    }, function () {
      toast('Clipboard blocked -- open devtools console: window.__tweakModeCSS');
      window.__tweakModeCSS = css;
    });
  }

  init();
})();
