// Mod Menu (2D wave shooter) — fixed hooks + hotkey + drag + watermark
// - Uses fixed positioning (no canvas-scale offset)
// - Single hotkey (default KeyH) with changeable binding
// - Buttons call live hooks from window.SapphireHooks (no load-order issues)

(function () {
  const STORAGE_KEY = 'sapphire_state_v1';

  const defaults = {
    open: true,
    hotkey: 'KeyH',
    pos: { x: 120, y: 120 },
    state: {
      // Combat
      godMode: false,
      infiniteAmmo: false,
      noReload: false,
      infiniteGrenades: false,
      oneHitKill: false,
      noRecoil: false,
      // Movement / QoL
      noclip: false,
      speedMult: 1.0,
      fastUse: false,
      autoPickup: false,
      showEnemyHp: false,
      unlimitedDash: false,
      autoHeal: false
    }
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaults);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(defaults),
        ...parsed,
        state: { ...defaults.state, ...(parsed.state || {}) }
      };
    } catch {
      return structuredClone(defaults);
    }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
  }

  // Internal state
  let app = loadState();
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  let lastTs = performance.now();

  // Live Hooks proxy (reads the latest window.SapphireHooks every call)
  const Hook = new Proxy({}, {
    get(_, prop) {
      const h = (window.SapphireHooks && typeof window.SapphireHooks === 'object') ? window.SapphireHooks : {};
      const v = h[prop];
      if (typeof v === 'function') return v.bind(h);
      // Fallback no-op
      return () => {};
    }
  });

  // Elements
  let root, chip, win, hdr, body, footer, modWatermark;

  // Utils
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function keyCodeToLabel(code) {
    if (!code) return '?';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }
  function formatNumber(n) {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2);
  }

  function buildUI() {
    // Root
    root = document.createElement('div');
    root.id = 'sapphire-root';
    document.body.appendChild(root);

    // Corner watermark (below HUD text — adjust top if you need more clearance)
    modWatermark = document.createElement('div');
    modWatermark.textContent = 'MODDED! Using Sapphire by Groovy, Cleaned up by ApollonGorilla';
    modWatermark.style.cssText = `
      position: fixed;
      top: 265px;   /* move down as needed to clear HUD */
      left: 12px;
      z-index: 1000001;
      color: #6cf;
      font-weight: bold;
      font-size: 18px;
font-family: Tahoma, monospace, sans-serif;
      text-shadow: 2px 2px 8px #000, 0 1px 2px #005;
      pointer-events: none;
      user-select: none;
    `;
    document.body.appendChild(modWatermark);

    // Window
    win = el('div', 'sapphire-window');
    win.style.position = 'fixed';
    win.style.left = app.pos.x + 'px';
    win.style.top = app.pos.y + 'px';

    // Header
    hdr = el('div', 'sapphire-header');
    const title = el('div', 'sapphire-title', 'Sapphire');
    const controls = el('div', 'sapphire-controls');

    const btnHotkey = el('button', 'sapphire-btn', 'Change Hotkey');
    btnHotkey.addEventListener('click', changeHotkeyFlow);

    const btnToggle = el('button', 'sapphire-btn', 'Toggle');
    btnToggle.addEventListener('click', () => setOpen(!app.open));

    const btnMin = el('button', 'sapphire-btn', '–');
    btnMin.title = 'Minimize';
    btnMin.addEventListener('click', () => setOpen(false));

    controls.appendChild(btnHotkey);
    controls.appendChild(btnToggle);
    controls.appendChild(btnMin);

    hdr.appendChild(title);
    hdr.appendChild(controls);
    win.appendChild(hdr);

    // Body
    body = el('div', 'sapphire-body');

    // Movement
    const secMove = el('div', 'sapphire-section');
    secMove.appendChild(sectionHeader('Movement & Camera'));
    secMove.appendChild(rowRange(
      'Speed Multiplier',
      'speedMult',
      0.2, 5, 0.1,
      app.state.speedMult,
      (val) => {
        app.state.speedMult = val;
        Hook.setSpeedMultiplier(val);
        saveState();
      }
    ));
    body.appendChild(secMove);

    // Cheats
    const secCheats = el('div', 'sapphire-section');
    secCheats.appendChild(sectionHeader('Cheats'));
    secCheats.appendChild(rowToggle('God Mode', 'godMode', app.state.godMode, v => { setCheat('godMode', v); Hook.setHealthInfinite(v); }));
    secCheats.appendChild(rowToggle('Infinite Ammo', 'infiniteAmmo', app.state.infiniteAmmo, v => { setCheat('infiniteAmmo', v); Hook.setAmmoInfinite(v); }));
    secCheats.appendChild(rowToggle('No Reload', 'noReload', app.state.noReload, v => setCheat('noReload', v)));
    secCheats.appendChild(rowToggle('Infinite Grenades', 'infiniteGrenades', app.state.infiniteGrenades, v => setCheat('infiniteGrenades', v)));
    secCheats.appendChild(rowToggle('One-Hit Kill', 'oneHitKill', app.state.oneHitKill, v => setCheat('oneHitKill', v)));
    secCheats.appendChild(rowToggle('No Recoil', 'noRecoil', app.state.noRecoil, v => setCheat('noRecoil', v)));
    secCheats.appendChild(rowToggle('Noclip', 'noclip', app.state.noclip, v => { setCheat('noclip', v); Hook.setNoclip(v); }));
    body.appendChild(secCheats);

    // QoL
    const secQoL = el('div', 'sapphire-section');
    secQoL.appendChild(sectionHeader('Quality of Life'));
    secQoL.appendChild(rowToggle('Fast Use', 'fastUse', app.state.fastUse, v => setCheat('fastUse', v)));
    secQoL.appendChild(rowToggle('Auto-Pickup', 'autoPickup', app.state.autoPickup, v => setCheat('autoPickup', v)));
    secQoL.appendChild(rowToggle('Show Enemy HP', 'showEnemyHp', app.state.showEnemyHp, v => setCheat('showEnemyHp', v)));
    secQoL.appendChild(rowToggle('Unlimited Dash', 'unlimitedDash', app.state.unlimitedDash, v => setCheat('unlimitedDash', v)));
    secQoL.appendChild(rowToggle('Auto Heal', 'autoHeal', app.state.autoHeal, v => setCheat('autoHeal', v)));
    body.appendChild(secQoL);

    win.appendChild(body);

    // Footer
    footer = el('div', 'sapphire-footer');
    const kv = el('div', 'sapphire-kv');
    kv.textContent = `Hotkey: ${keyCodeToLabel(app.hotkey)}  •  Drag by header`;
    const right = el('div', 'sapphire-kv');
    right.textContent = 'Sapphire v1.0';
    footer.appendChild(kv);
    footer.appendChild(right);
    win.appendChild(footer);

    // Dragging
    hdr.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);

    // Minimized chip
    chip = document.createElement('div');
    chip.id = 'sapphire-chip';
    chip.textContent = 'Menu';
    chip.addEventListener('click', () => setOpen(true));
    document.body.appendChild(chip);

    root.appendChild(win);
    setOpen(app.open);

    // Apply initial effects via live hooks
    Hook.setHealthInfinite(app.state.godMode);
    Hook.setAmmoInfinite(app.state.infiniteAmmo);
    Hook.setNoclip(app.state.noclip);
    Hook.setSpeedMultiplier(app.state.speedMult);
  }

  // Rows
  function rowToggle(label, key, value, onChange) {
    const row = el('div', 'sapphire-row');
    const wrap = el('label', 'sapphire-toggle');
    const span = el('span', null, label);
    const sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.className = 'sapphire-switch';
    sw.checked = !!value;
    sw.addEventListener('change', () => onChange(sw.checked));
    wrap.appendChild(span);
    wrap.appendChild(sw);
    row.appendChild(wrap);
    return row;
  }

  function rowRange(label, key, min, max, step, value, onChange) {
    const row = el('div', 'sapphire-row');
    const left = el('div', null, label);
    const right = el('div');
    right.style.minWidth = '140px';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sapphire-range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    const val = el('span', 'sapphire-kv', formatNumber(value));
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      val.textContent = formatNumber(v);
      onChange(v);
    });
    right.appendChild(slider);
    right.appendChild(val);
    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function sectionHeader(title) {
    const h = document.createElement('h4');
    h.textContent = title;
    return h;
  }
  function setCheat(key, val) {
    app.state[key] = val;
    // Call the latest onToggle every time
    try { Hook.onToggle(key, val, app.state); } catch {}
    saveState();
  }

  // Drag (viewport coords; fixed positioning)
  function startDrag(e) {
    dragging = true;
    const rect = win.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
  }
  function onDrag(e) {
    if (!dragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    win.style.left = x + 'px';
    win.style.top = y + 'px';
  }
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    const rect = win.getBoundingClientRect();
    app.pos = { x: Math.round(rect.left), y: Math.round(rect.top) };
    saveState();
  }

  // Open/close
  function setOpen(flag) {
    app.open = !!flag;
    if (app.open) {
      chip.classList.add('sapphire-hidden');
      win.classList.remove('sapphire-hidden');
      root.appendChild(win);
    } else {
      win.classList.add('sapphire-hidden');
      chip.classList.remove('sapphire-hidden');
    }
    saveState();
  }

  // Hotkey change
  function changeHotkeyFlow() {
    alert('Press a key to set the new menu hotkey (Esc to cancel).');
    const listener = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.code === 'Escape') {
        window.removeEventListener('keydown', listener, true);
        return;
      }
      app.hotkey = ev.code;
      saveState();
      if (footer) {
        const left = footer.querySelector('.sapphire-kv');
        if (left) left.textContent = `Hotkey: ${keyCodeToLabel(app.hotkey)}  •  Drag by header`;
      }
      window.removeEventListener('keydown', listener, true);
    };
    window.addEventListener('keydown', listener, true);
  }

  // Tick
  function tick(now) {
    const dt = Math.max(0, Math.min(0.1, (now - lastTs) / 1000));
    lastTs = now;
    try { Hook.onTick(app.state, dt); } catch {}
    requestAnimationFrame(tick);
  }

  // Single hotkey handler
  function onKeyDown(ev) {
    if (ev.code === app.hotkey) {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(!app.open);
    }
  }

  // Public API
  window.Sapphire = {
    init() {
      if (document.getElementById('sapphire-root')) return;
      buildUI();
      document.addEventListener('keydown', onKeyDown, true);
      requestAnimationFrame(tick);
    },
    setState(patch) {
      Object.assign(app.state, patch || {});
      try { Hook.setHealthInfinite(app.state.godMode); } catch {}
      try { Hook.setAmmoInfinite(app.state.infiniteAmmo); } catch {}
      try { Hook.setNoclip(app.state.noclip); } catch {}
      try { Hook.setSpeedMultiplier(app.state.speedMult); } catch {}
      saveState();
    },
    getState() { return JSON.parse(JSON.stringify(app.state)); },
    setOpen,
    setHotkey(code) { app.hotkey = code; saveState(); },
    isOpen() { return !!app.open; },
    version: '1.0.0'
  };

  // Auto-init
  if (document.readyState !== 'loading') {
    window.Sapphire.init();
  } else {
    document.addEventListener('DOMContentLoaded', () => window.Sapphire.init());
  }
})();
