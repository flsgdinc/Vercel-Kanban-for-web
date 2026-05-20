import { useState } from 'preact/hooks';
import { clearSupabaseConfig } from '../lib/config.js';
import { getSupabaseClient, resetSupabaseClient } from '../lib/supabase.js';

export function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const runAuth = async (mode) => {
    const sb = getSupabaseClient();
    if (!sb) {
      setMessage('Нет настроек Supabase', true);
      return;
    }
    const em = email.trim();
    const pw = password;
    if (!em || !pw) {
      setMessage('Введите email и пароль', true);
      return;
    }
    setBusy(true);
    setMessage('');
    setIsError(false);
    try {
      if (mode === 'signUp') {
        const { error } = await sb.auth.signUp({ email: em, password: pw });
        if (error) throw error;
        setMessage('Проверьте почту для подтверждения (если включено в Supabase).');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
        onLoggedIn();
      }
    } catch (err) {
      setMessage(err?.message || 'Ошибка входа', true);
      setIsError(true);
    } finally {
      setBusy(false);
    }
  };

  const resetConfig = () => {
    if (!confirm('Сбросить URL и ключ Supabase на этом устройстве?')) return;
    clearSupabaseConfig();
    resetSupabaseClient();
    location.reload();
  };

  return (
    <div class="shell">
      <header class="header">
        <h1>Kanban Mobile</h1>
        <p class="muted">Вход в тот же аккаунт, что на ПК</p>
      </header>
      <form
        class="card form"
        onSubmit={(e) => {
          e.preventDefault();
          void runAuth('signIn');
        }}
      >
        <label class="field">
          <span>Email</span>
          <input
            type="email"
            autocomplete="username"
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>
        <label class="field">
          <span>Пароль</span>
          <input
            type="password"
            autocomplete="current-password"
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>
        {message ? <p class={`status ${isError ? 'error' : ''}`}>{message}</p> : null}
        <button type="submit" class="btn primary block" disabled={busy}>
          Войти
        </button>
        <button
          type="button"
          class="btn ghost block"
          disabled={busy}
          onClick={() => void runAuth('signUp')}
        >
          Регистрация
        </button>
        <button type="button" class="btn link block" onClick={resetConfig}>
          Сменить URL / ключ
        </button>
      </form>
    </div>
  );
}
