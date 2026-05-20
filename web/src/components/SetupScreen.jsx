import { useState } from 'preact/hooks';
import { normalizeProjectUrl, saveSupabaseConfig } from '../lib/config.js';

export function SetupScreen({ onSaved }) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [error, setError] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    const normalized = normalizeProjectUrl(url);
    if (!normalized.startsWith('https://') || !normalized.includes('.supabase.co')) {
      setError('URL: только https://ВАШ_REF.supabase.co (без /rest/v1)');
      return;
    }
    if (!anonKey.trim()) {
      setError('Укажите anon / publishable ключ');
      return;
    }
    if (!saveSupabaseConfig(normalized, anonKey.trim())) {
      setError('Не удалось сохранить');
      return;
    }
    setError('');
    onSaved();
  };

  return (
    <div class="shell">
      <header class="header">
        <h1>Kanban Mobile</h1>
        <p class="muted">Подключение к Supabase</p>
      </header>
      <form class="card form" onSubmit={handleSave}>
        <label class="field">
          <span>Project URL</span>
          <input
            type="url"
            placeholder="https://xxxx.supabase.co"
            value={url}
            onInput={(e) => setUrl(e.currentTarget.value)}
            autocomplete="url"
          />
        </label>
        <label class="field">
          <span>Anon / publishable ключ</span>
          <input
            type="password"
            placeholder="eyJ… или sb_publishable_…"
            value={anonKey}
            onInput={(e) => setAnonKey(e.currentTarget.value)}
            autocomplete="off"
          />
        </label>
        {error ? <p class="status error">{error}</p> : null}
        <button type="submit" class="btn primary block">
          Сохранить
        </button>
        <p class="hint">
          Те же URL и ключ, что в десктопе: Настройки → Облако. Можно задать через{' '}
          <code>.env.local</code> при сборке.
        </p>
      </form>
    </div>
  );
}
