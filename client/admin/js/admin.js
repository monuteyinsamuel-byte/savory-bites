/* Savory Bites admin dashboard. Supabase RLS protects every database and storage operation. */
(() => {
  'use strict';
  document.body.hidden = true;
  const { h, picture, formatPrice, supabaseClient, fromSupabase, toSupabase } = window.SB;
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view'), dlg = $('#dlg');
  const state = { me: null, settings: null };
  const ROUTES = { overview: ['Overview', renderOverview], menu: ['Menu', renderMenu], gallery: ['Gallery', renderGallery], settings: ['Restaurant info', renderSettings], enquiries: ['Enquiries', renderEnquiries], account: ['Account', renderAccount] };

  function unwrap(response) {
    if (response.error) throw new Error(response.error.message || 'The request could not be completed.');
    return response.data === null ? null : fromSupabase(response.data);
  }
  async function requireAdmin() {
    const supabase = supabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) {
      location.replace('/admin/login.html');
      throw new Error('Please sign in to continue.');
    }
    const { data: membership, error: membershipError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) {
      await supabase.auth.signOut();
      location.replace('/admin/login.html');
      throw new Error('This account is not authorized to access the admin dashboard.');
    }
    state.me = { id: user.id, email: user.email };
    return supabase;
  }
  async function api(action) {
    const supabase = await requireAdmin();
    return unwrap(await action(supabase));
  }
  async function countRows(table, filters = []) {
    const supabase = await requireAdmin();
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    for (const [column, value] of filters) query = query.eq(column, value);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }
  function imagePathFromUrl(imageUrl) {
    if (!imageUrl) return null;
    try {
      const url = new URL(imageUrl);
      const projectOrigin = new URL(window.SB_CONFIG.supabaseUrl).origin;
      const prefix = '/storage/v1/object/public/restaurant-images/';
      if (url.origin !== projectOrigin || !url.pathname.startsWith(prefix)) return null;
      return decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
      return null;
    }
  }
  async function removeImage(supabase, imageUrl) {
    const path = imagePathFromUrl(imageUrl);
    if (!path) return;
    const { error } = await supabase.storage.from('restaurant-images').remove([path]);
    if (error) throw error;
  }
  async function uploadImage(supabase, file, folder) {
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    if (!allowed[ext] || file.type !== allowed[ext]) {
      throw new Error('Choose a valid JPG, PNG or WebP image.');
    }
    if (file.size > 3 * 1024 * 1024) throw new Error('Image is too large (maximum 3 MB).');
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('restaurant-images').upload(path, file, {
      cacheControl: '3600',
      contentType: allowed[ext],
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from('restaurant-images').getPublicUrl(path);
    return { path, url: data.publicUrl };
  }
  function reportCleanupError(error) {
    toast(`Saved, but an old image could not be removed: ${error.message}`, true);
  }
  function toast(msg, bad) {
    const t = h('div', { class: `toast${bad ? ' bad' : ''}`, text: msg });
    $('#toasts').append(t); setTimeout(() => t.remove(), 4200);
  }
  const fail = e => toast(e.message, true);
  const fmtDate = d => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const loading = () => view.replaceChildren(h('p', { class: 'muted', text: 'Loading…' }));
  const errBox = (e, retry) => view.replaceChildren(h('div', { class: 'empty' }, h('p', { text: e.message }), h('button', { class: 'btn', type: 'button', onclick: retry }, 'Try again')));

  /* ---------- form helpers ---------- */
  function field(label, input, name) {
    return h('label', { class: 'f' }, label, input, h('small', { class: 'err', 'data-err': name || input.name || '' }));
  }
  const input = (name, props = {}) => h('input', { name, ...props });
  function check(name, label, checked) {
    const box = h('input', { type: 'checkbox', name });
    box.checked = !!checked;
    return h('label', { class: 'check' }, box, label);
  }
  function showErrors(form, errors, general) {
    form.querySelectorAll('[data-err]').forEach(s => { s.textContent = (errors && errors[s.dataset.err]) || ''; });
    $('.form-error', form).textContent = general || '';
  }
  function openDialog(title, fields, { submitText = 'Save', onSubmit }) {
    const submit = h('button', { class: 'btn primary', type: 'submit' }, submitText);
    const form = h('form', { class: 'form', novalidate: true },
      h('h3', { text: title }), ...fields, h('p', { class: 'form-error', role: 'alert' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancel'), submit));
    form.addEventListener('submit', async e => {
      e.preventDefault(); submit.disabled = true; showErrors(form, {}, '');
      try { await onSubmit(form); dlg.close(); }
      catch (ex) { showErrors(form, ex.errors, ex.message); }
      finally { submit.disabled = false; }
    });
    dlg.replaceChildren(form);
    dlg.showModal();
  }
  function imageField(current) {
    const fileInput = input('image', { type: 'file', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' });
    const prev = h('div', { class: 'preview' }, picture(current, 'Current image'));
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      const max = (state.me && state.me.maxImageMb) || 3;
      const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
      const ext = f.name.split('.').pop().toLowerCase();
      if (!types[ext] || f.type !== types[ext]) { fileInput.value = ''; toast('Choose a valid JPG, PNG or WebP image.', true); return; }
      if (f.size > max * 1024 * 1024) { fileInput.value = ''; toast(`Image is too large (max ${max} MB).`, true); return; }
      prev.replaceChildren(h('img', { src: URL.createObjectURL(f), alt: 'New image preview' }));
    });
    return [prev, field(`Image (JPG, PNG or WebP, max ${(state.me && state.me.maxImageMb) || 3} MB)`, fileInput, 'image')];
  }
  /* ---------- Overview ---------- */
  async function renderOverview() {
    loading();
    try {
      const [menuTotal, menuActive, menuPopular, gallery, enquiries, enquiriesNew, settings] = await Promise.all([
        countRows('menu_items'),
        countRows('menu_items', [['is_active', true]]),
        countRows('menu_items', [['is_popular', true]]),
        countRows('gallery_items'),
        countRows('enquiries'),
        countRows('enquiries', [['status', 'new']]),
        api(s => s.from('restaurant_settings').select('*').limit(1).maybeSingle())
      ]);
      if (!settings) throw new Error('Restaurant information has not been added yet.');
      state.settings = settings;
      const stat = (n, label) => h('div', { class: 'stat' }, h('b', { text: n }), h('span', { text: label }));
      view.replaceChildren(
        h('div', { class: 'cards' }, stat(menuTotal, `Menu items (${menuActive} visible)`), stat(enquiries, `Enquiries (${enquiriesNew} new)`), stat(gallery, 'Gallery images'), stat(menuPopular, 'Popular dishes')),
        h('div', { class: 'panel' }, h('h2', { text: 'Website information' }),
          h('dl', { class: 'info' },
            h('dt', { text: 'Restaurant' }), h('dd', { text: settings.name }),
            h('dt', { text: 'WhatsApp' }), h('dd', { text: window.SB_CONFIG.whatsappNumber }),
            h('dt', { text: 'Address' }), h('dd', { text: settings.address || 'Not set' }),
            h('dt', { text: 'Email' }), h('dd', { text: settings.email || 'Not set' }),
            h('dt', { text: 'Phone' }), h('dd', { text: settings.phone || 'Not set' }),
            h('dt', { text: 'Opening hours' }), h('dd', { text: `${(settings.hours || []).length} row(s)` }),
            h('dt', { text: 'Last updated' }), h('dd', { text: settings.updatedAt ? fmtDate(settings.updatedAt) : 'Not set' })),
          h('p', { class: 'muted small', text: 'The WhatsApp number is configured in the public Supabase configuration file.' })));
    } catch (e) { errBox(e, renderOverview); }
  }

  /* ---------- Menu ---------- */
  async function renderMenu() {
    loading();
    let items;
    try {
      items = await api(s => s.from('menu_items').select('*').order('sort_order').order('created_at'));
      items = items.map(i => ({ ...i, image: i.imageUrl || '' }));
    } catch (e) { return errBox(e, renderMenu); }
    const cur = state.settings ? state.settings.currency : '';
    const cats = [...new Set(items.map(i => i.category))];
    const rows = items.map(i => h('div', { class: 'item' },
      h('div', { class: 'thumb' }, picture(i.image, i.name)),
      h('div', null, h('h3', { text: i.name }),
        h('div', { class: 'meta' }, h('strong', { text: formatPrice(i.price, cur) }), h('span', { text: i.category }),
          i.isPopular && h('span', { class: 'tag gold', text: 'Popular' }), !i.isActive && h('span', { class: 'tag off', text: 'Hidden' }))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn small', type: 'button', onclick: async () => {
          try {
            unwrap(await (await requireAdmin()).from('menu_items')
              .update({ is_active: !i.isActive }).eq('id', i.id).select('id').single());
            renderMenu();
          } catch (e) { fail(e); }
        } }, i.isActive ? 'Disable' : 'Enable'),
        h('button', { class: 'btn small', type: 'button', onclick: () => menuDialog(i, cats) }, 'Edit'),
        h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
          if (!confirm(`Delete "${i.name}"?`)) return;
          try {
            const supabase = await requireAdmin();
            const removed = unwrap(await supabase.from('menu_items').delete().eq('id', i.id).select('id').maybeSingle());
            if (!removed) throw new Error('Menu item not found or could not be deleted.');
            try { await removeImage(supabase, i.image); } catch (e) { reportCleanupError(e); }
            toast('Menu item deleted');
            renderMenu();
          } catch (e) { fail(e); }
        } }, 'Delete'))));
    view.replaceChildren(
      h('div', { class: 'toolbar' }, h('p', { class: 'muted', text: `${items.length} item(s)` }), h('button', { class: 'btn primary', type: 'button', onclick: () => menuDialog(null, cats) }, '+ Add food item')),
      h('div', { class: 'list' }, rows.length ? rows : h('div', { class: 'empty', text: 'No menu items yet. Add your first dish.' })));
  }
  function menuDialog(item, cats) {
    const it = item || { name: '', description: '', price: '', category: 'Mains', sortOrder: 0, isPopular: false, isActive: true, image: '' };
    const dl = h('datalist', { id: 'catlist' }, ...cats.map(c => h('option', { value: c })));
    const remove = item && item.image ? check('removeImage', 'Remove current image', false) : null;
    openDialog(item ? 'Edit food item' : 'Add food item', [
      field('Name', input('name', { type: 'text', maxlength: 120, required: true, value: it.name })),
      h('div', { class: 'row2' },
        field('Price', input('price', { type: 'number', min: 0, step: '0.01', required: true, value: it.price })),
        field('Category', input('category', { type: 'text', maxlength: 40, list: 'catlist', value: it.category })), dl),
      field('Description', Object.assign(h('textarea', { name: 'description', maxlength: 600 }), { value: it.description })),
      ...imageField(it.image), remove,
      field('Display order (lower first)', input('sortOrder', { type: 'number', step: '1', value: it.sortOrder })),
      check('isPopular', 'Mark as popular dish', it.isPopular), check('isActive', 'Visible on website', it.isActive)
    ], {
      submitText: item ? 'Save changes' : 'Add item',
      onSubmit: async form => {
        const supabase = await requireAdmin();
        const data = {
          name: form.elements.name.value.trim(),
          price: Number(form.elements.price.value),
          category: form.elements.category.value.trim() || 'Mains',
          description: form.elements.description.value.trim(),
          sortOrder: Number(form.elements.sortOrder.value) || 0,
          isPopular: form.elements.isPopular.checked,
          isActive: form.elements.isActive.checked,
          imageUrl: item ? item.image : ''
        };
        const file = form.elements.image.files[0];
        let uploaded;
        if (file) {
          uploaded = await uploadImage(supabase, file, 'menu');
          data.imageUrl = uploaded.url;
        } else if (remove && form.elements.removeImage.checked) data.imageUrl = '';
        try {
          const query = item
            ? supabase.from('menu_items').update(toSupabase(data)).eq('id', item.id).select('id').single()
            : supabase.from('menu_items').insert(toSupabase(data)).select('id').single();
          unwrap(await query);
        } catch (error) {
          if (uploaded) {
            try { await removeImage(supabase, uploaded.url); } catch (cleanupError) { reportCleanupError(cleanupError); }
          }
          throw error;
        }
        if (item && item.image && item.image !== data.imageUrl) {
          try { await removeImage(supabase, item.image); } catch (error) { reportCleanupError(error); }
        }
        toast(item ? 'Menu item updated' : 'Menu item added'); renderMenu();
      }
    });
  }

  /* ---------- Gallery ---------- */
  async function renderGallery() {
    loading();
    let items;
    try {
      items = await api(s => s.from('gallery_items').select('*').order('sort_order').order('created_at'));
      items = items.map(g => ({ ...g, image: g.imageUrl || '' }));
    } catch (e) { return errBox(e, renderGallery); }
    const cards = items.map(g => h('div', { class: 'g' },
      h('div', { class: 'img' }, picture(g.image, g.caption || 'Gallery image')),
      h('div', { class: 'b' }, h('strong', { text: g.caption || '(no description)' }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn small', type: 'button', onclick: () => galleryDialog(g) }, 'Edit'),
          h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
            if (!confirm('Delete this gallery entry?')) return;
            try {
              const supabase = await requireAdmin();
              const removed = unwrap(await supabase.from('gallery_items').delete().eq('id', g.id).select('id').maybeSingle());
              if (!removed) throw new Error('Gallery entry not found or could not be deleted.');
              try { await removeImage(supabase, g.image); } catch (e) { reportCleanupError(e); }
              toast('Gallery entry deleted');
              renderGallery();
            } catch (e) { fail(e); }
          } }, 'Delete')))));
    view.replaceChildren(
      h('div', { class: 'toolbar' }, h('p', { class: 'muted', text: `${items.length} image(s). Entries without a photo show a sample illustration.` }), h('button', { class: 'btn primary', type: 'button', onclick: () => galleryDialog(null) }, '+ Upload image')),
      cards.length ? h('div', { class: 'gal' }, cards) : h('div', { class: 'empty', text: 'No gallery images yet.' }));
  }
  function galleryDialog(item) {
    openDialog(item ? 'Edit gallery entry' : 'Upload gallery image', [
      ...imageField(item ? item.image : ''),
      field('Description', input('caption', { type: 'text', maxlength: 160, value: item ? item.caption : '' })),
      field('Display order (lower first)', input('sortOrder', { type: 'number', step: '1', value: item ? item.sortOrder : 0 }))
    ], {
      submitText: item ? 'Save changes' : 'Upload',
      onSubmit: async form => {
        const supabase = await requireAdmin();
        const data = {
          caption: form.elements.caption.value.trim(),
          sortOrder: Number(form.elements.sortOrder.value) || 0,
          imageUrl: item ? item.image : ''
        };
        const file = form.elements.image.files[0];
        let uploaded;
        if (file) {
          uploaded = await uploadImage(supabase, file, 'gallery');
          data.imageUrl = uploaded.url;
        }
        try {
          const query = item
            ? supabase.from('gallery_items').update(toSupabase(data)).eq('id', item.id).select('id').single()
            : supabase.from('gallery_items').insert(toSupabase(data)).select('id').single();
          unwrap(await query);
        } catch (error) {
          if (uploaded) {
            try { await removeImage(supabase, uploaded.url); } catch (cleanupError) { reportCleanupError(cleanupError); }
          }
          throw error;
        }
        if (item && item.image && item.image !== data.imageUrl) {
          try { await removeImage(supabase, item.image); } catch (error) { reportCleanupError(error); }
        }
        toast(item ? 'Gallery entry updated' : 'Image uploaded'); renderGallery();
      }
    });
  }

  /* ---------- Settings ---------- */
  async function renderSettings() {
    loading();
    let s;
    try {
      s = await api(client => client.from('restaurant_settings').select('*').limit(1).maybeSingle());
      if (!s) throw new Error('Restaurant information has not been added yet.');
      s.hours = Array.isArray(s.hours) ? s.hours : [];
      state.settings = s;
    } catch (e) { return errBox(e, renderSettings); }
    const hoursBox = h('div');
    const addRow = (day = '', time = '') => {
      const row = h('div', { class: 'hours-row' }, input('day', { type: 'text', maxlength: 40, placeholder: 'e.g. Monday – Friday', value: day }), input('time', { type: 'text', maxlength: 40, placeholder: 'e.g. 12:00 – 22:00', value: time }),
        h('button', { class: 'btn small danger', type: 'button', onclick: () => row.remove() }, 'Remove'));
      hoursBox.append(row);
    };
    s.hours.forEach(r => addRow(r.day, r.time));
    const area = (name, val, max, rows) => Object.assign(h('textarea', { name, maxlength: max, rows }), { value: val });
    const form = h('form', { class: 'form panel', novalidate: true },
      h('h2', { text: 'Restaurant information' }),
      field('Restaurant name', input('name', { type: 'text', maxlength: 80, required: true, value: s.name })),
      field('Hero text (under the headline)', area('tagline', s.tagline, 200, 2), 'tagline'),
      field('Welcome introduction', area('introduction', s.introduction, 400, 3), 'introduction'),
      field('About description (blank line = new paragraph)', area('description', s.description, 2000, 7), 'description'),
      h('div', null, h('strong', { text: 'Opening hours' }), hoursBox, h('small', { class: 'err', 'data-err': 'hours' }), h('button', { class: 'btn small', type: 'button', onclick: () => addRow() }, '+ Add row')),
      field('Address / location', input('address', { type: 'text', maxlength: 200, value: s.address })),
      field('Directions link (optional, https://…)', input('mapUrl', { type: 'url', maxlength: 500, value: s.mapUrl })),
      h('div', { class: 'row2' }, field('Public email (optional)', input('email', { type: 'email', maxlength: 254, value: s.email })), field('Other public phone (optional)', input('phone', { type: 'text', maxlength: 30, value: s.phone }))),
      h('div', { class: 'row2' }, field('Currency symbol', input('currency', { type: 'text', maxlength: 4, value: s.currency })), field('Footer notice (clear to hide)', input('notice', { type: 'text', maxlength: 200, value: s.notice }))),
      h('p', { class: 'form-error', role: 'alert' }),
      h('button', { class: 'btn primary', type: 'submit' }, 'Save changes'));
    form.addEventListener('submit', async e => {
      e.preventDefault(); showErrors(form, {}, '');
      const data = {};
      ['name', 'tagline', 'introduction', 'description', 'address', 'mapUrl', 'email', 'phone', 'currency', 'notice'].forEach(k => { data[k] = form.elements[k].value; });
      data.hours = [...hoursBox.children].map(r => ({ day: r.children[0].value, time: r.children[1].value })).filter(r => r.day.trim() || r.time.trim());
      try {
        const supabase = await requireAdmin();
        const identifier = s.id ? ['id', s.id] : s.key ? ['key', s.key] : null;
        if (!identifier) throw new Error('The restaurant settings row has no supported identifier.');
        const result = await supabase.from('restaurant_settings')
          .update(toSupabase(data))
          .eq(identifier[0], identifier[1])
          .select('*')
          .single();
        state.settings = unwrap(result);
        toast('Restaurant information saved');
      }
      catch (ex) { showErrors(form, ex.errors, ex.message); }
    });
    view.replaceChildren(form);
  }

  /* ---------- Enquiries ---------- */
  let enqFilter = 'all';
  async function renderEnquiries() {
    loading();
    let list;
    try {
      list = await api(s => s.from('enquiries').select('*').order('created_at', { ascending: false }).limit(300));
    } catch (e) { return errBox(e, renderEnquiries); }
    updateBadge(list.filter(e => e.status === 'new').length);
    const shown = list.filter(e => enqFilter === 'all' || e.status === enqFilter);
    const act = (e, status, label) => h('button', { class: 'btn small', type: 'button', onclick: async () => {
      try {
        unwrap(await (await requireAdmin()).from('enquiries')
          .update({ status }).eq('id', e.id).select('id').single());
        renderEnquiries();
      } catch (x) { fail(x); }
    } }, label);
    const cards = shown.map(e => h('article', { class: `enq ${e.status}` },
      h('div', { class: 'toolbar' }, h('div', null, h('strong', { text: e.name }), ' ', h('span', { class: 'muted small', text: fmtDate(e.createdAt) })), h('span', { class: `tag ${e.status}`, text: e.status })),
      h('p', { text: e.message }),
      h('div', { class: 'actions' },
        e.status !== 'read' && act(e, 'read', 'Mark read'), e.status !== 'handled' && act(e, 'handled', 'Mark handled'), e.status !== 'new' && act(e, 'new', 'Mark new'),
        h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
          if (!confirm('Delete this enquiry?')) return;
          try {
            const removed = unwrap(await (await requireAdmin()).from('enquiries')
              .delete().eq('id', e.id).select('id').maybeSingle());
            if (!removed) throw new Error('Enquiry not found or could not be deleted.');
            toast('Enquiry deleted');
            renderEnquiries();
          } catch (x) { fail(x); }
        } }, 'Delete'))));
    const tabs = ['all', 'new', 'read', 'handled'].map(t => h('button', { class: `btn small${enqFilter === t ? ' primary' : ''}`, type: 'button', onclick: () => { enqFilter = t; renderEnquiries(); } }, t[0].toUpperCase() + t.slice(1)));
    view.replaceChildren(h('div', { class: 'toolbar' }, h('div', { class: 'tabs' }, tabs)), h('div', { class: 'list' }, cards.length ? cards : h('div', { class: 'empty', text: 'No enquiries here.' })));
  }
  function updateBadge(n) { const b = $('#newCount'); b.hidden = !n; b.textContent = n; }

  /* ---------- Account ---------- */
  function renderAccount() {
    const form = h('form', { class: 'form panel', novalidate: true },
      h('h2', { text: 'Change password' }),
      field('Current password', input('currentPassword', { type: 'password', autocomplete: 'current-password', required: true }), 'currentPassword'),
      field('New password (10+ characters, letters and numbers)', input('newPassword', { type: 'password', autocomplete: 'new-password', required: true }), 'newPassword'),
      h('p', { class: 'form-error', role: 'alert' }),
      h('button', { class: 'btn primary', type: 'submit' }, 'Update password'));
    form.addEventListener('submit', async e => {
      e.preventDefault(); showErrors(form, {}, '');
      try {
        const supabase = await requireAdmin();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: state.me.email,
          password: form.elements.currentPassword.value
        });
        if (signInError) throw new Error('Current password is incorrect.');
        const { error } = await supabase.auth.updateUser({ password: form.elements.newPassword.value });
        if (error) throw error;
        form.reset();
        toast('Password updated');
      } catch (ex) { showErrors(form, ex.errors, ex.errors ? '' : ex.message); }
    });
    view.replaceChildren(h('p', { class: 'muted', text: `Signed in as ${state.me.email}` }), form);
  }

  /* ---------- router & shell ---------- */
  function route() {
    const key = (location.hash || '#overview').slice(1);
    const [title, fn] = ROUTES[key] || ROUTES.overview;
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.route === (ROUTES[key] ? key : 'overview')));
    $('#title').textContent = title;
    $('#sidebar').classList.remove('open');
    fn();
  }
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#logout').addEventListener('click', async () => {
    try {
      const supabase = supabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      location.replace('/admin/login.html');
    } catch (error) { fail(error); }
  });
  addEventListener('hashchange', route);

  (async () => {
    try {
      await requireAdmin();
      $('#who').textContent = state.me.email;
      document.body.hidden = false;
      const [settings, newEnquiries] = await Promise.all([
        api(s => s.from('restaurant_settings').select('*').limit(1).maybeSingle()),
        countRows('enquiries', [['status', 'new']])
      ]);
      state.settings = settings;
      updateBadge(newEnquiries);
    } catch (e) {
      document.body.hidden = false;
      view.replaceChildren(h('div', { class: 'empty' },
        h('p', { text: e.message }),
        h('a', { class: 'btn', href: '/admin/login.html' }, 'Return to sign in')));
      return;
    }
    route();
  })();
})();
