/* Savory Bites public site: loads all content from the API and renders it safely. */
(() => {
  'use strict';
  const { h, art, picture, formatPrice } = window.SB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const state = { site: null, menu: [], category: 'All' };

  const whatsappNumber = String(window.SB_CONFIG.whatsappNumber || '').replace(/\D/g, '');
  const formatWhatsapp = number => {
    const match = /^234(\d{3})(\d{3})(\d{4})$/.exec(number);
    return match ? `+234 ${match[1]} ${match[2]} ${match[3]}` : `+${number}`;
  };
  const waLink = text => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  const supabase = () => window.SB.supabaseClient();
  const unwrap = ({ data, error }) => {
    if (error) throw new Error(error.message || 'The request could not be completed.');
    return data;
  };
  const bind = (key, value) => $$(`[data-bind="${key}"]`).forEach(el => { el.textContent = value; });
  const show = (el, on) => { el.hidden = !on; };

  /* ---------- state helpers ---------- */
  const skeletons = (n = 4) => Array.from({ length: n }, () => h('div', { class: 'card skeleton', 'aria-hidden': 'true' }, h('div', { class: 'pic' }), h('div', { class: 'body' }, h('i'), h('i'), h('i'))));
  const emptyState = (title, text) => h('div', { class: 'state' }, h('strong', { text: title }), h('p', { text }));
  const errorState = (text, retry) => h('div', { class: 'state error', role: 'alert' }, h('strong', { text: 'Something went wrong' }), h('p', { text }), h('button', { class: 'btn dark small', type: 'button', onclick: retry }, 'Try again'));

  /* ---------- render ---------- */
  function renderSite(s) {
    s = {
      ...s,
      name: s.name || 'Savory Bites',
      tagline: s.tagline || '',
      introduction: s.introduction || '',
      description: s.description || '',
      hours: Array.isArray(s.hours) ? s.hours : [],
      address: s.address || '',
      mapUrl: s.mapUrl || '',
      email: s.email || '',
      phone: s.phone || '',
      currency: s.currency || '',
      notice: s.notice || '',
      whatsappNumber,
      whatsappDisplay: formatWhatsapp(whatsappNumber)
    };
    state.site = s;
    document.title = `${s.name} — Fine Dining & Order via WhatsApp`;
    const [first, ...rest] = s.name.split(' ');
    bind('logoFirst', first); bind('logoRest', rest.join(' '));
    bind('name', s.name);
    bind('tagline', s.tagline);
    bind('welcomeTitle', `Welcome to ${s.name}`);
    bind('aboutTitle', `About ${s.name}`);
    bind('introduction', s.introduction);
    bind('whatsappDisplay', s.whatsappDisplay);
    $('#aboutText').replaceChildren(...s.description.split(/\n{2,}/).filter(Boolean).map(p => h('p', { text: p })));
    $('#hoursBody').replaceChildren(...s.hours.map(r => h('tr', null, h('td', { text: r.day }), h('td', { text: r.time }))));
    $('#addressText').textContent = s.address || 'Address coming soon.';
    const dir = $('#directions'); show(dir, !!s.mapUrl); if (s.mapUrl) dir.href = s.mapUrl;
    show($('#emailRow'), !!s.email); if (s.email) { const a = $('#emailLink'); a.textContent = s.email; a.href = `mailto:${s.email}`; }
    show($('#phoneRow'), !!s.phone); $('#phoneText').textContent = s.phone;
    $('#notice').textContent = s.notice;
    const msg = `Hello ${s.name}! I'd like to place an order. Could you please share today's availability?`;
    $$('[data-wa]').forEach(a => { a.href = waLink(msg); a.target = '_blank'; a.rel = 'noopener'; });
  }

  function dishCard(d) {
    d = { ...d, image: d.imageUrl || d.image || '' };
    const order = `Hello ${state.site.name}! I'd like to order: 1 x ${d.name} (${formatPrice(d.price, state.site.currency)}).`;
    return h('article', { class: 'card reveal' },
      h('div', { class: 'pic' }, picture(d.image, d.name)),
      h('div', { class: 'body' },
        h('div', { class: 'row' }, h('h3', { text: d.name }), h('span', { class: 'price', text: formatPrice(d.price, state.site.currency) })),
        d.description && h('p', { text: d.description }),
        h('a', { class: 'btn dark small', href: waLink(order), target: '_blank', rel: 'noopener', 'aria-label': `Order ${d.name} on WhatsApp` }, 'Order this')));
  }

  function renderMenu() {
    const popular = state.menu.filter(d => d.isPopular).slice(0, 8);
    const grid = $('#popularGrid');
    grid.replaceChildren(...(popular.length ? popular.map(dishCard) : [emptyState('No popular dishes yet', 'Check the full menu below.')]));

    const cats = ['All', ...new Set(state.menu.map(d => d.category).filter(Boolean))];
    if (!cats.includes(state.category)) state.category = 'All';
    $('#chips').replaceChildren(...(cats.length > 2 ? cats.map(c => h('button', { type: 'button', class: `chip${c === state.category ? ' on' : ''}`, role: 'tab', 'aria-selected': String(c === state.category), onclick: () => { state.category = c; renderMenu(); } }, c)) : []));
    const items = state.menu.filter(d => state.category === 'All' || d.category === state.category);
    $('#menuGrid').replaceChildren(...(items.length ? items.map(dishCard) : [emptyState('The menu is being updated', 'Please check back soon, or message us on WhatsApp.')]));
    observeReveals();
  }

  function renderGallery(items) {
    const grid = $('#galleryGrid');
    if (!items.length) { grid.replaceChildren(emptyState('Gallery coming soon', 'Photos of our dishes will appear here.')); return; }
    grid.replaceChildren(...items.map(g => h('figure', { class: 'tile reveal' }, picture(g.image, g.caption || 'Savory Bites dish'), g.caption && h('figcaption', { text: g.caption }))));
    observeReveals();
  }

  /* ---------- loading ---------- */
  async function loadMenu() {
    $('#popularGrid').replaceChildren(...skeletons(4));
    $('#menuGrid').replaceChildren(...skeletons(4));
    try {
      const rows = unwrap(await supabase().from('menu_items').select('*').eq('is_active', true)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }));
      state.menu = window.SB.fromSupabase(rows).map(item => ({ ...item, image: item.imageUrl || item.image || '' }));
      renderMenu();
    }
    catch (e) { const retry = () => loadMenu(); $('#popularGrid').replaceChildren(errorState(e.message, retry)); $('#menuGrid').replaceChildren(errorState(e.message, retry)); }
  }
  async function loadGallery() {
    $('#galleryGrid').replaceChildren(...skeletons(3));
    try {
      const rows = unwrap(await supabase().from('gallery_items').select('*')
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }));
      renderGallery(window.SB.fromSupabase(rows).map(item => ({ ...item, image: item.imageUrl || item.image || '' })));
    }
    catch (e) { $('#galleryGrid').replaceChildren(errorState(e.message, loadGallery)); }
  }
  async function init() {
    $('#heroArt').prepend(art('Herb-Crusted Lamb Rack'));
    $('#aboutArt').append(art('Saffron Seafood Paella'));
    try {
      const row = unwrap(await supabase().from('restaurant_settings').select('*').limit(1).maybeSingle());
      if (!row) throw new Error('Restaurant information has not been added yet.');
      renderSite(window.SB.fromSupabase(row));
    }
    catch (e) {
      const box = $('#siteError'); box.hidden = false; box.className = 'site-error';
      box.replaceChildren(errorState(`Could not load restaurant details. ${e.message}`, () => location.reload()));
      return;
    }
    loadMenu(); loadGallery();
  }

  /* ---------- nav, reveal, form ---------- */
  const burger = $('#burger'), list = $('#menuList'), header = $('header');
  const setMenu = open => { list.classList.toggle('open', open); burger.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); };
  burger.addEventListener('click', () => setMenu(!list.classList.contains('open')));
  $$('#menuList a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  const onScroll = () => header.classList.toggle('solid', window.scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  let io = null;
  function observeReveals() {
    const els = $$('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
    io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.1 });
    els.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
  }

  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!state.site) return;
    const name = $('#fname').value.trim(), message = $('#fmsg').value.trim();
    $('#fnameErr').textContent = name ? '' : 'Please enter your name.';
    $('#fmsgErr').textContent = message ? '' : 'Please enter a message.';
    if (!name || !message) return;
    const status = $('#formStatus');
    const text = `Hello ${state.site.name}, I'm ${name}. ${message}`;
    // Open WhatsApp synchronously (inside the click) so mobile browsers don't block it.
    window.open(waLink(text), '_blank', 'noopener');
    status.textContent = 'Opening WhatsApp…';
    if ($('#fweb').value) {
      status.textContent = 'Thank you! Your message was saved and WhatsApp is opening.';
      e.target.reset();
      return;
    }
    Promise.resolve().then(() => supabase().from('enquiries').insert({ name, message, status: 'new' }))
      .then(({ error }) => {
        if (error) throw new Error(error.message || 'The enquiry could not be saved.');
        status.textContent = 'Thank you! Your message was saved and WhatsApp is opening.';
        e.target.reset();
      })
      .catch(err => { status.textContent = `WhatsApp is opening, but we could not save your message: ${err.message}`; });
  });

  $('#year').textContent = new Date().getFullYear();
  observeReveals();
  init();
})();
