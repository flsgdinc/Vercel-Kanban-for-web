import { useCallback, useEffect, useState } from 'preact/hooks';
import { loadSupabaseConfig } from './lib/config.js';
import { getSupabaseClient, resetSupabaseClient } from './lib/supabase.js';
import { fetchBoardFromCloud, saveBoardToCloud } from './lib/board-api.js';
import { SetupScreen } from './components/SetupScreen.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';
import { BoardScreen } from './components/BoardScreen.jsx';

export function App() {
  const [hasConfig, setHasConfig] = useState(() => !!loadSupabaseConfig());
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [boardState, setBoardState] = useState(null);
  const [boardTheme, setBoardTheme] = useState('light');
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState(null);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);

  const refreshSession = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) {
      setSession(null);
      return;
    }
    const { data } = await sb.auth.getSession();
    setSession(data.session);
  }, []);

  useEffect(() => {
    if (!hasConfig) {
      setBooting(false);
      return;
    }
    const sb = getSupabaseClient();
    if (!sb) {
      setBooting(false);
      return;
    }
    refreshSession().finally(() => setBooting(false));
    const { data: sub } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => sub.subscription.unsubscribe();
  }, [hasConfig, refreshSession]);

  const loadBoard = useCallback(async () => {
    setStatus('Загрузка…');
    setStatusError(false);
    const res = await fetchBoardFromCloud();
    if (!res.ok) {
      setStatus(res.error, true);
      if (res.empty) setBoardState(null);
      return false;
    }
    setBoardState(res.state);
    setBoardTheme(res.theme === 'dark' ? 'dark' : 'light');
    setCloudUpdatedAt(res.updatedAt);
    setStatus(`Обновлено: ${new Date(res.updatedAt).toLocaleString('ru-RU')}`);
    return true;
  }, []);

  useEffect(() => {
    if (session && boardState === null && !booting) {
      void loadBoard();
    }
  }, [session, boardState, booting, loadBoard]);

  const persistBoard = useCallback(
    async (nextState, { skipConflictCheck = false } = {}) => {
      setStatus('Сохранение…');
      setStatusError(false);
      const res = await saveBoardToCloud(
        nextState,
        skipConflictCheck ? undefined : cloudUpdatedAt,
        boardTheme
      );
      if (!res.ok) {
        setStatus(res.error, true);
        if (res.conflict && confirm(`${res.error}\n\nОбновить данные из облака?`)) {
          await loadBoard();
        }
        return false;
      }
      setBoardState(nextState);
      setCloudUpdatedAt(res.updatedAt);
      setStatus(`Сохранено: ${new Date(res.updatedAt).toLocaleString('ru-RU')}`);
      return true;
    },
    [cloudUpdatedAt, boardTheme, loadBoard]
  );

  const handleSignOut = async () => {
    const sb = getSupabaseClient();
    if (sb) await sb.auth.signOut();
    resetSupabaseClient();
    setSession(null);
    setBoardState(null);
    setBoardTheme('light');
    setCloudUpdatedAt(null);
    setStatus('Вы вышли');
    setStatusError(false);
  };

  if (!hasConfig) {
    return (
      <SetupScreen
        onSaved={() => {
          resetSupabaseClient();
          setHasConfig(true);
          setBooting(true);
          refreshSession().finally(() => setBooting(false));
        }}
      />
    );
  }

  if (booting) {
    return (
      <div class="shell center">
        <p class="muted">Загрузка…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onLoggedIn={() => {
          setBoardState(null);
          void refreshSession();
        }}
      />
    );
  }

  if (!boardState) {
    return (
      <div class="shell center">
        <p class="status error">{status || 'Нет данных в облаке'}</p>
        <p class="muted small">
          Сначала загрузите доску с ПК: Настройки → Облако → «↑ В облако».
        </p>
        <button type="button" class="btn primary" onClick={() => void loadBoard()}>
          Обновить
        </button>
        <button type="button" class="btn ghost" onClick={handleSignOut}>
          Выйти
        </button>
      </div>
    );
  }

  return (
    <BoardScreen
      state={boardState}
      status={status}
      statusError={statusError}
      onRefresh={() => void loadBoard()}
      onSignOut={handleSignOut}
      onChange={async (nextState) => {
        setBoardState(nextState);
        await persistBoard(nextState);
      }}
    />
  );
}
