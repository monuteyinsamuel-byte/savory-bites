/* Shared helpers for the public site and the admin dashboard (no dependencies). */
(() => {
  'use strict';

  // Respect reduced-motion without a non-breakpoint media query in the stylesheets.
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('reduce-motion');

  const PALETTES = [
    ['#c89a5b', '#e9d3a3', '#6b7a3a'], ['#e2775a', '#f3b08a', '#5e8a3c'], ['#8a4b26', '#d9a441', '#5e8a3c'],
    ['#d9663a', '#f2d7a0', '#7a9a45'], ['#9b4a32', '#e0a66a', '#6b8f3c'], ['#f4efe3', '#d9483b', '#4f8a3c'],
    ['#e0a82e', '#d9553a', '#4f8a3c'], ['#3b1d10', '#e9d3a3', '#c9a45c']
  ];
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  // Safe DOM builder: text is always inserted as text nodes, never as HTML.
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  // Fallback illustration (fixed template; no user content is placed inside the SVG string).
  function art(seed) {
    const [a, b, g] = PALETTES[hash(seed) % PALETTES.length];
    const dots = [[78, 84], [118, 92], [96, 120], [124, 124], [84, 108]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${7 + (i % 3) * 2}" fill="${i % 2 ? b : g}"/>`).join('');
    const box = h('div', { class: 'art' });
    box.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="104" r="94" fill="rgba(0,0,0,.25)"/><circle cx="100" cy="100" r="94" fill="#f6efe3" stroke="#c9a45c" stroke-width="2"/><circle cx="100" cy="100" r="72" fill="none" stroke="#e5d6b8" stroke-width="2"/><ellipse cx="100" cy="102" rx="46" ry="40" fill="${a}"/><ellipse cx="92" cy="92" rx="26" ry="18" fill="${b}" opacity=".55"/>${dots}<path d="M60 60q40-26 80 0" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
    return box;
  }

  // Real image when available; falls back to the illustration if missing or broken.
  function picture(url, alt) {
    const box = h('div', { class: 'picture' });
    const fallback = () => box.replaceChildren(art(alt));
    if (!url) { fallback(); return box; }
    const img = h('img', { src: url, alt, loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', fallback, { once: true });
    box.append(img);
    return box;
  }

  function formatPrice(n, currency) {
    const num = Number(n);
    const body = Number.isInteger(num) ? num.toLocaleString('en-US') : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency || ''}${body}`;
  }

  // fetch wrapper: JSON in/out, FormData supported, CSRF header always sent.
  async function request(url, { method = 'GET', json, form } = {}) {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'fetch' };
    let body;
    if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    else if (form) body = form;
    let res;
    try { res = await fetch(url, { method, headers, body, credentials: 'same-origin' }); }
    catch { const e = new Error('Network error. Check your connection and try again.'); e.status = 0; throw e; }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) { const e = new Error((data && data.error) || `Request failed (${res.status}).`); e.status = res.status; e.errors = data && data.errors; throw e; }
    return data;
  }

  window.SB = { h, art, picture, formatPrice, request };
})();
