# Kanban Task Manager

Десктопное приложение на Electron: канбан-доска, календарь, помодоро, повторяющиеся задачи, архив и шаблоны.

## Требования

- Node.js 18+

## Запуск

```bash
cd kanban-app
npm install
npm start
```

## Сборка (Windows)

```bash
npm run dist
```

Установщик появится в `kanban-app/dist/`.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm start` | Запуск в режиме разработки |
| `npm run dist` | Сборка NSIS-инсталлятора |
| `npm run lint` | ESLint |
| `npm test` | Unit-тесты (Node test runner) |
| `npm run build:vendor` | Пересобрать `src/js/vendor/supabase.bundle.mjs` (нужно после обновления `@supabase/supabase-js`) |
| `npm run web:dev` | Веб-клиент для телефона (Preact), см. `web/README.md` |
| `npm run web:build` | Сборка веб-клиента в `web/dist/` |

## Данные

- **Electron:** `%APPDATA%/Kanban Task Manager/kanban-state.json` (формат `{ version, theme, state }`)
- **Fallback:** `localStorage` ключ `kanban_state` (тот же envelope)

Экспорт/импорт: JSON через кнопки в шапке (Ctrl+S — экспорт).

## Облако (Supabase)

1. В [Supabase Dashboard](https://supabase.com/dashboard) создайте проект.
2. Выполните SQL из `supabase/migrations/001_kanban_boards.sql` (SQL Editor → New query → Run).
3. В приложении: **Настройки → Облако** — URL проекта и anon/publishable ключ (хранятся в профиле Electron, не в репозитории).
4. Зарегистрируйтесь или войдите по email/паролю.
5. **↑ В облако** — первая загрузка локальной доски; **Синхронизировать** — сравнение по `updated_at` (last-write-wins).

Сессия auth сохраняется в `%APPDATA%/Kanban Task Manager/supabase-session.json`.

## Веб с телефона

Тонкий клиент: `web/` (Preact). Просмотр колонок, добавление и выполнение задач через Supabase.

```bash
npm run web:install
npm run web:dev
```

Подробнее: [web/README.md](web/README.md).

## Структура кода

- `web/` — мобильный веб-клиент (Vite + Preact)
- `main.cjs` / `preload.cjs` — процесс Electron и IPC
- `src/js/supabase/` — клиент и синхронизация
- `src/js/kanban.js` — оркестрация UI
- `src/js/kanban/board-render.js` — доска
- `src/js/kanban/calendar-render.js` — календарь
- `src/js/kanban/*.js` — помодоро, фильтры, история, миграции
