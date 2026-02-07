import { supabase } from '../../lib/supabase.js';
import { createToast } from '../../ui/components.js';
import { ensureProfile } from '../../app/session.js';
import { setState } from '../../app/state.js';

export function renderLogin(container) {
  container.innerHTML = `
    <section class="login-view auth-screen">
      <div class="card login-card">
        <div class="login-header">
          <img class="login-logo" src="/icons/logo_dd.png" alt="Dungeon & Dragon" />
          <div>
            <p class="eyebrow">Dungeons &amp; Dragons</p>
            <p class="login-title">Gestionale Personaggi</p>
          </div>
        </div>
        <p class="login-subtitle">Usa email e password per entrare o creare l'account.</p>
        <form class="login-form" data-login-form>
          <label class="field">
            <span >Email</span>
            <input type="email" name="email" required placeholder="nome@email.it" />
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" name="password" required minlength="6" />
          </label>
          <div class="login-form__toggle-row">
            <span>Nuovo account</span>
            <label class="diceov-toggle condition-modal__toggle" aria-label="Nuovo account">
              <input type="checkbox" name="signup" />
              <span class="diceov-toggle-track" aria-hidden="true"></span>
            </label>
          </div>
          <div class="login-form__actions">
            <button class="primary" type="submit" data-login-submit>Accedi</button>
          </div>
        </form>
      </div>
    </section>
  `;

  const form = container.querySelector('[data-login-form]');
  const signupInput = form.querySelector('input[name="signup"]');
  const submitButton = form.querySelector('[data-login-submit]');
  const syncSubmitLabel = () => {
    if (!submitButton || !signupInput) return;
    submitButton.textContent = signupInput.checked ? 'Registrati' : 'Accedi';
  };
  signupInput?.addEventListener('change', syncSubmitLabel);
  syncSubmitLabel();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const signup = formData.get('signup') === 'on';

    const showDuplicateAccountToast = () => {
      createToast('Esiste già un account con questa email. Prova ad accedere.', 'error');
    };
    const showConfirmEmailToast = () => {
      createToast("Registrazione completata. Conferma l'email prima di procedere con il login.", 'success');
    };

    try {
      const response = signup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (response.error) {
        throw response.error;
      }

      if (signup) {
        const identities = response.data.user?.identities;
        if (Array.isArray(identities) && identities.length === 0) {
          showDuplicateAccountToast();
          return;
        }

        showConfirmEmailToast();
        form.reset();
        syncSubmitLabel();
        return;
      }

      const user = response.data.user;
      if (user) {
        setState({ user });
        await ensureProfile(user);
        window.location.hash = '#/characters';
      }
    } catch (error) {
      const message = String(error?.message || '');
      if (signup && /already\s+(registered|exists|in use)|user\s+already/i.test(message)) {
        showDuplicateAccountToast();
        return;
      }
      createToast(error.message ?? 'Errore login', 'error');
    }
  });
}
