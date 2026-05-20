/** @typedef {{ id: string, title: string, color: string, icon?: string, tasks: object[], completed: object[], sortBy?: string, compOpen?: boolean }} Column */

export const PDOTS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };
export const PRIORITIES = [
  ['low', 'Низкий'],
  ['medium', 'Средний'],
  ['high', 'Высокий']
];
export const VOLUMES = ['S', 'M', 'L', 'XL', 'XXL'];
export const MAX_HISTORY = 50;

export function createDefaultState() {
  return {
    columns: [
      {
        id: '1',
        title: 'Бэклог',
        color: '#6366f1',
        icon: 'pack:cog',
        tasks: [],
        completed: [],
        sortBy: 'manual',
        compOpen: false
      },
      {
        id: '2',
        title: 'В работе',
        color: '#3b82f6',
        icon: 'pack:cog',
        tasks: [
          {
            id: 't1',
            title: 'Пример задачи',
            priority: 'medium',
            color: '',
            subtasks: [{ id: 's1', title: 'Подзадача 1', done: false }],
            deadline: '',
            deadlineReminder: '',
            completed: false,
            expanded: false,
            description: '',
            volume: '',
            pomodoro: {},
            repeat: null
          }
        ],
        completed: [],
        sortBy: 'manual',
        compOpen: false
      },
      {
        id: '3',
        title: 'Готово',
        color: '#22c55e',
        icon: 'pack:cog',
        tasks: [],
        completed: [],
        sortBy: 'manual',
        compOpen: false
      }
    ],
    selectedDate: null,
    agendaDate: null,
    weekAnchorISO: null,
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    calView: 'month',
    calWeekOffset: 0,
    /** Колонка для хоткеев «новая задача» / Ctrl+← → */
    focusedColumnId: null,
    /** Удалённые в архив записи: { id, task, archivedAt } */
    archive: [],
    /** Шаблоны: { id, name, task } — task без id или с игнорируемым id */
    taskTemplates: [],
    /** Поведение окна и мелкие флаги */
    pomodoroQueue: [],
    pomodoroDay: { date: '', globalCount: 0 },
    appSettings: {
      closeToTray: true,
      showSaveFlash: true,
      /** Применять поиск и фильтры доски к спискам в календаре */
      calendarUseBoardFilters: true,
      pomShortBreakMin: 5,
      pomLongBreakMin: 15,
      pomLongBreakEvery: 4,
      pomAutoStartBreak: false,
      pomAutoStartNext: false,
      pomUseBoardFilters: true,
      cloudAutoSync: false
    }
  };
}
