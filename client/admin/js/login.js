(() => {
  'use strict';
  const { supabaseClient } = window.SB;
  const $ = s => document.querySelector(s);
  const showError = message => { $('#error').textContent = message; };

  async function redirectIfAdmin() {
    try {
      const supabase = supabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return;
      const { data, error: membershipError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (data) location.replace('/admin/');
      else await supabase.auth.signOut();
    } catch (error) {
      showError(error.message);
    }
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#submit'), err = $('#error');
    err.textContent = ''; btn.disabled = true;
    try {
      const supabase = supabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: $('#email').value.trim(),
        password: $('#password').value
      });
      if (error) throw error;
      const { data: membership, error: membershipError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) {
        await supabase.auth.signOut();
        throw new Error('This account is not authorized to access the admin dashboard.');
      }
      location.replace('/admin/');
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      $('#password').value = '';
    }
  });
  redirectIfAdmin();
})();
