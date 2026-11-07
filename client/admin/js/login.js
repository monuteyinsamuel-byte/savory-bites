(() => {
  'use strict';
  const { request } = window.SB;
  const $ = s => document.querySelector(s);
  request('/api/setup/status').then(s => { if (s.needsSetup && s.enabled) $('#setupLink').hidden = false; }).catch(() => {});
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#submit'), err = $('#error');
    err.textContent = ''; btn.disabled = true;
    try {
      await request('/api/admin/auth/login', { method: 'POST', json: { email: $('#email').value, password: $('#password').value } });
      location.href = '/admin';
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; $('#password').value = ''; }
  });
})();
