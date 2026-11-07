(() => {
  'use strict';
  const { request } = window.SB;
  const $ = s => document.querySelector(s);
  request('/api/setup/status').then(s => {
    if (!s.needsSetup) $('#intro').textContent = 'Setup is already complete. Please sign in.';
    else if (!s.enabled) $('#intro').textContent = 'Setup is disabled: set SETUP_TOKEN on the server, or run "npm run create-admin".';
    else $('#setupForm').hidden = false;
  }).catch(e => { $('#intro').textContent = e.message; });
  $('#setupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#error'); err.textContent = '';
    if ($('#password').value !== $('#confirm').value) { err.textContent = 'Passwords do not match.'; return; }
    try {
      await request('/api/setup', { method: 'POST', json: { token: $('#token').value, email: $('#email').value, password: $('#password').value } });
      location.href = '/admin/login.html';
    } catch (ex) { err.textContent = ex.errors ? Object.values(ex.errors).join(' ') : ex.message; }
  });
})();
