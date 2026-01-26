import { supabase } from '../../lib/supabase.js';
import { createToast } from '../../ui/components.js';
import { ensureProfile } from '../../app/session.js';
import { setState } from '../../app/state.js';

export function renderLogin(container) {
  container.innerHTML = `
    <section class="card login-card">
      <h2>Accedi</h2>
      <p>Usa email e password per entrare o creare l'account.</p>
      <form data-login-form>
        <label class="field">
          <span>Email</span>
          <input type="email" name="email" required placeholder="nome@email.it" />
        </label>
        <label class="field">
          <span>Password</span>
          <input type="password" name="password" required minlength="6" />
        </label>
        <label class="checkbox">
          <input type="checkbox" name="signup" />
          <span>Nuovo account</span>
        </label>
        <button class="primary" type="submit">Continua</button>
      </form>
    </section>
  `;

  const form = container.querySelector('[data-login-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const signup = formData.get('signup') === 'on';

    try {
      const response = signup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (response.error) {
        throw response.error;
      }
      const user = response.data.user;
      if (user) {
        setState({ user });
        await ensureProfile(user);
        window.location.hash = '#/home';
      }
    } catch (error) {
      createToast(error.message ?? 'Errore login', 'error');
    }
  });
}
