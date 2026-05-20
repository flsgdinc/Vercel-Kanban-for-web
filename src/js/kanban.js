import { PDOTS, PRIORITIES, VOLUMES } from './constants.js';
import { SORT_MENU_ITEMS, sortColumnTasks, sortAllColumns } from './kanban/task-sort.js';
import { state } from './state.js';
import { escapeHtml, escapeAttr } from './html-escape.js';
import { validateImportPayload, EXPORT_VERSION, packPersistPayload } from './state-envelope.js';
import { initKanbanModules } from './kanban/deps.js';
import { renderBoard, expandSubtasksBlock } from './kanban/board-render.js';
import { renderCalendar, calNav, localDateStr } from './kanban/calendar-render.js';
import { addInlineTop } from './kanban/board-render.js';
import { deadlineStatus, deadlineLabel } from './deadline-utils.js';
import { hydrateAppState, saveStateNoHistory } from './storage.js';
import { migrateAndNormalizeState } from './kanban/migrate-state.js';
import { pushHistory, undo, redo, updateUndoRedoBtns } from './kanban/history.js';
import { isRepeatConfigured, repeatDeadlineTimeTail, getDisplayDeadlineIso } from './kanban/repeat-logic.js';
import { checkDeadlineReminders } from './kanban/reminders.js';
import { startInlineTitleEdit, startInlineSubtaskTitleEdit } from './kanban/title-edit.js';
import {
  showCompleted,
  matchesFilter,
  setupFilterPanelUI,
  clearAllFiltersUi,
  setSearchQuery,
  setShowCompleted,
  toggleShowCompletedFlag
} from './kanban/filters.js';
import { allTasksOnDate, calendarDaySortMomentMs } from './kanban/task-occurrences.js';
import { findTask } from './kanban/task-find.js';
import { toggleDone } from './kanban/tasks.js';
import { wireRuntime, run } from './kanban/runtime.js';
import { showSaveFlash } from './kanban/save-flash.js';
import { hydrateDataIcons, icon, shapes as icoShapes } from './icons.js';
import {
  COLUMN_PACK_ICON_FILES,
  defaultPackColumnIcon,
  packIconUrl,
  packIconValueFromFilename,
  resolvePackFilename
} from './column-pack-icons.js';
import { hasPomodoro, normalizePomodoro, pomodoroLabel } from './kanban/pomodoro-utils.js';
import {
  setTaskPomodoro,
  clearTaskPomodoro,
  syncPomodoroQueue,
  reorderPomodoroQueue,
  dequeuePomodoroTask
} from './kanban/pomodoro-queue.js';
import {
  startPomodoroWork,
  startPomodoroBreak,
  stopPomodoro,
  pausePomodoro,
  resumePomodoro,
  addMinute,
  onPomodoroTick,
  setPomodoroHint,
  skipToIdle,
  getPomodoroTaskId
} from './kanban/pomodoro-timer.js';
import { registerPomodoroTimerHooks } from './kanban/pomodoro-hooks.js';
import {
  renderPomodoroView,
  setSelectedPomodoroTaskId,
  updatePomodoroTimerUi
} from './kanban/pomodoro-view.js';

let draggedTaskId=null,draggedColId=null,draggedCalTaskId=null,activeMenu=null,selectedTask=null,dropIndicator=null;
let stickerTaskId=null,stickerMenuOpen=false;
let draggedSubIdx=null,draggedSubTaskId=null;
let descEditorPushedHistory=false;
const panelDropdowns={};
const COLUMN_COLOR_PRESETS=[
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b',
  '#0ea5e9','#a855f7','#4ade80','#fbbf24','#fb7185','#78716c','#1e293b','#dc2626'
];
let columnStyleColId=null;
let columnStyleSelIcon=defaultPackColumnIcon();
let columnStyleGridReady=false;
let taskPanelCloseTimer=null;
let taskPanelTransitionEnd=null;

function ensureFocusedColumn(){
  if(!state.columns.length){state.focusedColumnId=null;return}
  if(!state.focusedColumnId||!state.columns.some(c=>c.id===state.focusedColumnId)){
    state.focusedColumnId=state.columns[0].id;
  }
}

function navigateColumnFocus(delta){
  switchView('board');
  ensureFocusedColumn();
  const ids=state.columns.map(c=>c.id);
  const i=ids.indexOf(state.focusedColumnId);
  if(i===-1||!ids.length)return;
  const ni=(i+delta+ids.length)%ids.length;
  state.focusedColumnId=ids[ni];
  saveStateNoHistory();
  renderBoard();
  requestAnimationFrame(()=>{
    const col=document.querySelector('#board .column.column-focused');
    const board=document.getElementById('board');
    if(col&&board){
      const cr=col.getBoundingClientRect();
      const br=board.getBoundingClientRect();
      const next=board.scrollLeft+(cr.left-br.left)-(br.width-cr.width)/2;
      board.scrollTo({left:Math.max(0,next),behavior:'smooth'});
    }
  });
}

function expandOrCollapseAllSubtasks(expanded){
  let changed=false;
  state.columns.forEach(col=>{
    [...col.tasks,...col.completed].forEach(t=>{
      if(expanded){
        if(t.subtasks?.length && !t.expanded){t.expanded=true;changed=true;}
      }else if(t.expanded){
        t.expanded=false;
        changed=true;
      }
    });
  });
  if(!changed){
    showHkHint(expanded?'Уже всё развёрнуто':'Уже всё свёрнуто');
    return;
  }
  showHkHint(expanded?'Подзадачи развёрнуты':'Подзадачи свернуты');
  pushHistory();
  saveStateNoHistory();
  renderBoard();
}

function toggleShowCompleted(){
  const v=toggleShowCompletedFlag();
  const cb=document.getElementById('showCompleted');
  if(cb)cb.checked=v;
  renderBoard();
  showHkHint(v?'Видны выполненные':'Выполненные скрыты');
}

// ─── Init ──────────────────────────────────────────────────────────────
export async function initApp(){
  await hydrateAppState();
  migrateAndNormalizeState(state);
  if(window.electronAPI?.setCloseBehavior)void window.electronAPI.setCloseBehavior(!!state.appSettings?.closeToTray);
  if(localStorage.getItem('kanban_theme')==='dark')document.body.classList.add('dark');
  initKanbanModules({
    state,
    ensureFocusedColumn,
    icon,
    icoShapes,
    matchesFilter,
    showCompleted,
    saveStateNoHistory,
    pushHistory,
    toggleDone,
    startInlineTitleEdit,
    startInlineSubtaskTitleEdit,
    hasPomodoro,
    pomodoroLabel,
    deadlineStatus,
    deadlineLabel,
    isRepeatConfigured,
    repeatLabel,
    getDisplayDeadlineIso,
    getMissingStickers,
    editSticker,
    showStickerMenu,
    launchPomodoroForTask,
    openPanel,
    openTaskMenu,
    addColumn,
    closeMenu,
    columnIconHtml,
    PDOTS,
    findTask,
    setDraggedSub: (idx, id) => {
      draggedSubIdx = idx;
      draggedSubTaskId = id;
    },
    getDraggedSub: () => ({ draggedSubIdx, draggedSubTaskId }),
    clearDraggedSub: () => {
      draggedSubIdx = null;
      draggedSubTaskId = null;
    },
    allTasksOnDate,
    calendarDaySortMomentMs,
    switchView,
    highlightTask
  });
  wireRuntime({renderBoard,renderCalendar,renderPomodoro,showHkHint,showSaveFlash});
  try {
    const cloud = await import('./supabase/cloud-ui.js');
    cloud.initCloudUi({
      onAfterRemoteApply: () => {
        run.refreshAll();
        showHkHint('Данные обновлены из облака');
      }
    });
    window.__kanbanCloud = cloud;
  } catch (err) {
    console.error('Облако Supabase недоступно', err);
  }
  setPomodoroHint(showHkHint);
  registerPomodoroTimerHooks(stopPomodoro, getPomodoroTaskId);
  onPomodoroTick(()=>{
    if(document.getElementById('pomodoro')?.classList.contains('active'))updatePomodoroTimerUi();
    else if(getPomodoroTaskId())renderBoard();
  });
  hydrateDataIcons(document.body);
  document.getElementById('boardBtn').onclick=()=>switchView('board');
  document.getElementById('calendarBtn').onclick=()=>switchView('calendar');
  document.getElementById('pomodoroBtn').onclick=()=>switchView('pomodoro');
  document.getElementById('searchInput').addEventListener('input',e=>{setSearchQuery(e.target.value.toLowerCase());renderBoard();renderCalendar();renderPomodoro()});
  document.getElementById('importFile').addEventListener('change',e=>{if(e.target.files[0])importProject(e.target.files[0])});
  setupFilterPanelUI(()=>{renderBoard();renderCalendar();renderPomodoro()});
  document.getElementById('showCompleted').onchange=e=>{setShowCompleted(e.target.checked);renderBoard()};
  document.getElementById('taskPanel').addEventListener('click',e=>{
    if(!e.target.closest('#descAlignWrap'))closeDescAlignMenu();
    e.stopPropagation();
  });
  ['customModal','repeatModal','hotkeysModal','registryModal','archiveModal','settingsModal','templatesModal','columnStyleModal'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('click',e=>e.stopPropagation())});
  document.getElementById('columnStyleColorInput')?.addEventListener('input',syncColumnStyleColorDots);
  bindDescEditorUi();
  initTaskPanelDropdowns();
  bindMaskedInput(document.getElementById('taskDeadline'),'datetime');
  bindMaskedInput(document.getElementById('repeatStart'),'date');
  bindMaskedInput(document.getElementById('repeatEnd'),'date');
  bindMaskedInput(document.getElementById('repeatTime'),'time');
  bindMaskedInput(document.getElementById('panelRepeatTime'),'time');
  bindMaskedInput(document.getElementById('panelRepeatStart'),'date');
  bindMaskedInput(document.getElementById('panelRepeatEnd'),'date');
  document.addEventListener('click',()=>{
    document.querySelectorAll('.panel-dd-wrap.open').forEach(x=>x.classList.remove('open'));
    document.getElementById('descAlignBtn')?.setAttribute('aria-expanded','false');
  });
  document.addEventListener('click',e=>{if(stickerMenuOpen&&!e.target.closest('#stickerMenu')&&!e.target.closest('.sticker-add-btn')&&!e.target.closest('.sticker'))closeStickerMenu()});
  document.getElementById('board').addEventListener('click',e=>{
    const col=e.target.closest('.column');
    if(!col||!col.dataset.id)return;
    if(state.focusedColumnId===col.dataset.id)return;
    state.focusedColumnId=col.dataset.id;
    saveStateNoHistory();
    document.querySelectorAll('#board .column').forEach(c=>{
      c.classList.toggle('column-focused',c.dataset.id===state.focusedColumnId);
    });
  });
  renderBoard();
  renderCalendar();
  renderPomodoro();
  setupBoardDnD();setupCalendarDnD();setupKeyboard();
  document.getElementById('templatesBtn')?.addEventListener('click',openTemplates);
  document.getElementById('archiveBtn')?.addEventListener('click',openArchive);
  document.getElementById('settingsBtn')?.addEventListener('click',openSettings);
  updateUndoRedoBtns();
  const ru=document.getElementById('repeatUnit');
  if(ru)ru.addEventListener('change',syncRepeatModalUnitUI);
  checkDeadlineReminders();
  setInterval(checkDeadlineReminders,30*1000);
  window.addEventListener('resize',()=>{
    if(document.getElementById('filterPanel')?.classList.contains('open'))positionFilterPanel();
  });
  document.getElementById('header')?.addEventListener('scroll',()=>{
    if(document.getElementById('filterPanel')?.classList.contains('open'))positionFilterPanel();
  },{passive:true});
}

// ─── Keyboard ──────────────────────────────────────────────────────────
let hkTimer=null;
function showHkHint(msg){const el=document.getElementById('hkHint');el.textContent=msg;el.classList.add('show');clearTimeout(hkTimer);hkTimer=setTimeout(()=>el.classList.remove('show'),1400)}

const mdEscapeHtml = escapeHtml;
function markdownInlineToHtml(s){
  let safe=mdEscapeHtml(s||'');
  safe=safe.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  safe=safe.replace(/`([^`]+?)`/g,'<code>$1</code>');
  safe=safe.replace(/\*\*([^*]+?)\*\*/g,'<strong>$1</strong>');
  safe=safe.replace(/\*([^*\n]+?)\*/g,'<em>$1</em>');
  safe=safe.replace(/~~([^~]+?)~~/g,'<s>$1</s>');
  safe=safe.replace(/~([^~\n]+?)~/g,'<s>$1</s>');
  safe=safe.replace(/==([^=\n]+?)==/g,'<mark>$1</mark>');
  return safe;
}
function markdownToHtml(md){
  const lines=String(md||'').split('\n');
  const out=[];let inList=false;
  lines.forEach(raw=>{
    const line=raw.trimEnd();
    if(!line.trim()){
      if(inList){out.push('</ul>');inList=false;}
      return;
    }
    if(/^___\s*$/.test(line)){if(inList){out.push('</ul>');inList=false;}out.push('<hr/>');return;}
    if(/^>>>/.test(line)){if(inList){out.push('</ul>');inList=false;}out.push(`<blockquote>${markdownInlineToHtml(line.replace(/^>>>\s?/,''))}</blockquote>`);return;}
    if(/^###\s+/.test(line)){if(inList){out.push('</ul>');inList=false;}out.push(`<h3>${markdownInlineToHtml(line.replace(/^###\s+/,''))}</h3>`);return;}
    if(/^##\s+/.test(line)){if(inList){out.push('</ul>');inList=false;}out.push(`<h2>${markdownInlineToHtml(line.replace(/^##\s+/,''))}</h2>`);return;}
    if(/^#\s+/.test(line)){if(inList){out.push('</ul>');inList=false;}out.push(`<h1>${markdownInlineToHtml(line.replace(/^#\s+/,''))}</h1>`);return;}
    if(/^- /.test(line)){if(!inList){out.push('<ul>');inList=true;}out.push(`<li>${markdownInlineToHtml(line.replace(/^- /,''))}</li>`);return;}
    if(/^\d+\.\s+/.test(line)){if(inList){out.push('</ul>');inList=false;}out.push(`<p>${markdownInlineToHtml(line)}</p>`);return;}
    if(/^\[\]\s*/.test(line)){if(inList){out.push('</ul>');inList=false;}out.push(`<p>${markdownInlineToHtml(line.replace(/^\[\]\s*/,'☐ '))}</p>`);return;}
    if(inList){out.push('</ul>');inList=false;}
    if(/^>\s?/.test(line)){out.push(`<blockquote>${markdownInlineToHtml(line.replace(/^>\s?/,''))}</blockquote>`);return;}
    out.push(`<p>${markdownInlineToHtml(line)}</p>`);
  });
  if(inList)out.push('</ul>');
  return out.join('');
}
function htmlToMarkdown(html){
  let s=String(html||'');
  s=s.replace(/<div><br><\/div>/gi,'\n').replace(/<div><\/div>/gi,'\n').replace(/<br\s*\/?>/gi,'\n');
  s=s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi,'# $1\n');
  s=s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi,'## $1\n');
  s=s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi,'### $1\n');
  s=s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,'> $1\n');
  s=s.replace(/<hr[^>]*>/gi,'___\n');
  s=s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi,(_,inner)=>inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,'- $1\n'));
  s=s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,'**$2**');
  s=s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,'*$2*');
  s=s.replace(/<(s|strike)[^>]*>([\s\S]*?)<\/\1>/gi,'~$2~');
  s=s.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,'[$2]($1)');
  s=s.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi,'==$1==');
  s=s.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi,'<u>$1</u>');
  s=s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,'`$1`');
  s=s.replace(/<(p|div)[^>]*>([\s\S]*?)<\/\1>/gi,'$2\n');
  s=s.replace(/<\/?[^>]+>/g,'');
  const ta=document.createElement('textarea');ta.innerHTML=s;
  return ta.value.replace(/\n{3,}/g,'\n\n').trim();
}
function applyMarkdownWrap(cmd){
  const editor=document.getElementById('descEditorInput');if(!editor)return;
  editor.focus();
  if(cmd==='bold')document.execCommand('bold');
  else if(cmd==='italic')document.execCommand('italic');
  else if(cmd==='strike')document.execCommand('strikeThrough');
  else if(cmd==='underline')document.execCommand('underline');
  else if(cmd==='quote')document.execCommand('formatBlock',false,'blockquote');
  else if(cmd==='alignLeft')document.execCommand('justifyLeft');
  else if(cmd==='alignCenter')document.execCommand('justifyCenter');
  else if(cmd==='alignRight')document.execCommand('justifyRight');
  else if(cmd==='date'){
    const d=new Date();
    const dateStr=`${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    document.execCommand('insertText',false,dateStr);
  }
  editor.dispatchEvent(new Event('input',{bubbles:true}));
}
function syncDescColorSwatch(){
  const sw=document.getElementById('descColorSwatch');
  const inp=document.getElementById('descEditorColor');
  if(sw&&inp)sw.style.background=inp.value;
}
function closeDescAlignMenu(){
  const w=document.getElementById('descAlignWrap');
  const b=document.getElementById('descAlignBtn');
  if(w)w.classList.remove('open');
  if(b)b.setAttribute('aria-expanded','false');
}
function bindDescEditorUi(){
  const ta=document.getElementById('descEditorInput');if(!ta)return;
  ta.addEventListener('input',()=>{
    if(!selectedTask)return;
    if(!descEditorPushedHistory){pushHistory();descEditorPushedHistory=true;}
    const md=htmlToMarkdown(ta.innerHTML);
    selectedTask.description=md;
    saveStateNoHistory();
  });
  document.getElementById('descAlignBtn')?.addEventListener('click',e=>{
    e.stopPropagation();
    const wrap=document.getElementById('descAlignWrap');if(!wrap)return;
    document.querySelectorAll('.panel-dd-wrap.open').forEach(x=>{if(x!==wrap)x.classList.remove('open')});
    wrap.classList.toggle('open');
    document.getElementById('descAlignBtn')?.setAttribute('aria-expanded',wrap.classList.contains('open')?'true':'false');
  });
  document.getElementById('descEditorToolbar')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-mdcmd]');if(!btn)return;
    applyMarkdownWrap(btn.dataset.mdcmd);
    closeDescAlignMenu();
  });
  document.getElementById('descEditorColor')?.addEventListener('input',e=>{
    const ed=document.getElementById('descEditorInput');if(!ed||!selectedTask)return;
    syncDescColorSwatch();
    ed.focus();
    document.execCommand('foreColor',false,e.target.value);
    ed.dispatchEvent(new Event('input',{bubbles:true}));
  });
  syncDescColorSwatch();
  ta.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();document.execCommand('undo');return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();document.execCommand('redo');return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){e.preventDefault();applyMarkdownWrap('bold');}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='i'){e.preventDefault();applyMarkdownWrap('italic');}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();applyMarkdownWrap('strike');}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='u'){e.preventDefault();applyMarkdownWrap('underline');}
    if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==='>'){e.preventDefault();applyMarkdownWrap('italic');}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();applyMarkdownWrap('date');}
  });
}
function syncDescFromEditor(){
  if(!selectedTask)return;
  const ed=document.getElementById('descEditorInput');
  if(!ed)return;
  selectedTask.description=htmlToMarkdown(ed.innerHTML);
}

function setupKeyboard(){
  document.addEventListener('keydown',e=>{
    const inInput=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable;
    if(e.key==='Escape'){closeStickerMenu();collapseTaskPanel();closeColumnStyleModal();window.closeHotkeys();closeRepeatModal();closeRegistry();closeArchive();closeTemplates();closeSettings();document.getElementById('customModal').classList.remove('open');document.getElementById('filterPanel').classList.remove('open');closeMenu();if(inInput)document.activeElement.blur();return}
    if(e.ctrlKey||e.metaKey){
      if(inInput&&document.getElementById('taskPanel')?.classList.contains('open')&&e.target.closest('#descEditorInput')){
        if(e.code==='KeyZ'){e.preventDefault();document.execCommand(e.shiftKey?'redo':'undo');return}
        if(e.code==='KeyY'){e.preventDefault();document.execCommand('redo');return}
      }
      if(e.code==='KeyK'){e.preventDefault();document.getElementById('searchInput').focus();showHkHint('Поиск');return}
      if(e.code==='KeyT'){e.preventDefault();toggleTheme();return}
      if(e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();return}
      if(e.code==='KeyY'){e.preventDefault();redo();return}
      if(e.code==='KeyS'){e.preventDefault();exportProject();showHkHint('Экспорт');return}
      const boardActive=document.getElementById('board').classList.contains('active');
      if(boardActive&&e.shiftKey&&(e.code==='BracketLeft'||e.code==='BracketRight')){
        e.preventDefault();
        expandOrCollapseAllSubtasks(e.code==='BracketRight');
        return;
      }
      if(boardActive&&(e.code==='ArrowLeft'||e.code==='ArrowRight')&&!e.shiftKey){
        e.preventDefault();
        navigateColumnFocus(e.code==='ArrowRight'?1:-1);
        showHkHint(e.code==='ArrowRight'?'Колонка →':'← Колонка');
        return;
      }
      return;
    }
    if(e.code==='KeyK'&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      const si=document.getElementById('searchInput');
      const fromSearch=inInput&&e.target===si;
      if(!inInput||fromSearch){
        e.preventDefault();
        if(si){si.value='';setSearchQuery('');renderBoard();renderCalendar();renderPomodoro()}
        showHkHint('Поиск сброшен');
        return;
      }
    }
    if(inInput)return;
    const calActive=document.getElementById('calendar').classList.contains('active');
    const pomActive=document.getElementById('pomodoro')?.classList.contains('active');
    if(e.key==='?'||e.key==='/'){e.preventDefault();window.openHotkeys();return}
    if(e.code==='KeyF'){
      e.preventDefault();
      if(e.shiftKey){
        window.clearAllFilters();
        document.getElementById('filterPanel')?.classList.remove('open');
        showHkHint('Фильтры сброшены');
      }else{
        window.toggleFilterPanel();
        showHkHint('Фильтры');
      }
      return;
    }
    const boardActive=document.getElementById('board').classList.contains('active');
    if(boardActive&&e.code==='KeyO'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      e.preventDefault();
      window.toggleGlobalSortMenu();
      showHkHint('Сортировка');
      return;
    }
    if(e.code==='KeyH'){
      e.preventDefault();
      toggleShowCompleted();
      return;
    }
    if(e.code==='KeyB'){e.preventDefault();switchView('board');showHkHint('Доска');return}
    if(e.code==='KeyC'){e.preventDefault();switchView('calendar');showHkHint('Календарь');return}
    if(e.code==='KeyP'){e.preventDefault();switchView('pomodoro');showHkHint('Помодоро');return}
    // N — новая задача в выбранной колонке (фокус: клик по колонке или Ctrl+←/→)
    if(e.code==='KeyN'&&!calActive&&!pomActive){
      e.preventDefault();
      ensureFocusedColumn();
      const col=state.columns.find(c=>c.id===state.focusedColumnId)||state.columns[0];
      if(col){
        switchView('board');
        setTimeout(()=>addInlineTop(col.id),50);
        showHkHint('Новая задача');
      }
      return;
    }
    if(calActive){
      if(e.key==='ArrowLeft'){e.preventDefault();window.calNav(-1);showHkHint('← период');return}
      if(e.key==='ArrowRight'){e.preventDefault();window.calNav(1);showHkHint('→ период');return}
      if(e.code==='KeyM'){e.preventDefault();setCalView('month');showHkHint('Месяц');return}
      if(e.code==='KeyW'){e.preventDefault();setCalView('week');showHkHint('Неделя');return}
      if(e.code==='KeyA'){e.preventDefault();setCalView('agenda');showHkHint('Агенда');return}
    }
  })
}

window.openHotkeys=()=>document.getElementById('hotkeysModal').classList.add('open');
window.closeHotkeys=()=>document.getElementById('hotkeysModal').classList.remove('open');
function setCalView(v){
  state.calView=v;
  if(v==='week'){
    state.weekAnchorISO=state.selectedDate||localDateStr(new Date());
    state.calWeekOffset=0;
  }
  if(v==='agenda'){
    const base=state.selectedDate||localDateStr(new Date());
    state.agendaDate=base;
    const p=base.split('-').map(Number);
    state.calYear=p[0];
    state.calMonth=p[1]-1;
  }
  document.querySelectorAll('.cal-view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  renderCalendar();
}
function renderPomodoro(){
  syncPomodoroQueue(state);
  renderPomodoroView({
    onStart:(id,force)=>{
      if(startPomodoroWork(id,force)){
        saveStateNoHistory();
        renderPomodoro();
        renderBoard();
      }else showHkHint('План выполнен — «Ещё сессия» или сбросьте прогресс');
    },
    onPause:()=>{pausePomodoro();renderPomodoro()},
    onResume:()=>{resumePomodoro();renderPomodoro()},
    onStop:()=>{stopPomodoro();renderPomodoro()},
    onBreak:(kind)=>{startPomodoroBreak(kind);renderPomodoro()},
    onSkipBreak:()=>{skipToIdle();renderPomodoro()},
    onAddMinute:()=>{addMinute();updatePomodoroTimerUi()},
    onResetProgress:(id)=>{
      const t=findTask(id);
      if(!t)return;
      pushHistory();
      const p=normalizePomodoro(t.pomodoro);
      t.pomodoro={...p,done:0};
      saveStateNoHistory();
      renderPomodoro();
      renderBoard();
      showHkHint('Прогресс сброшен');
    },
    onReorder:(fromId,toId)=>{
      pushHistory();
      if(reorderPomodoroQueue(fromId,toId))saveStateNoHistory();
      renderPomodoro();
    },
    onOpenTask:(id)=>{switchView('board');highlightTask(id)},
    onSelect:(id)=>{setSelectedPomodoroTaskId(id);renderPomodoro()}
  });
  hydrateDataIcons(document.getElementById('pomodoro'));
}
function launchPomodoroForTask(id,start=true){
  if(!findTask(id))return;
  switchView('pomodoro');
  setSelectedPomodoroTaskId(id);
  renderPomodoro();
  if(start){
    if(startPomodoroWork(id,false)){
      saveStateNoHistory();
      renderPomodoro();
    }else showHkHint('План выполнен');
  }
}
function applyPanelPomodoroFromInputs(){
  if(!selectedTask)return;
  const count=parseInt(document.getElementById('pomCount')?.value,10)||0;
  const val=parseInt(document.getElementById('pomDur')?.value,10)||0;
  const unit=panelDropdowns.pomUnitDd?.getValue()||'min';
  if(count>0&&val>0)setTaskPomodoro(selectedTask,{count,val,unit},state);
  else clearTaskPomodoro(selectedTask,state);
}
function switchView(v){
  const el=document.getElementById(v);
  if(!el){console.warn('switchView: missing view',v);return}
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('boardBtn')?.classList.toggle('active',v==='board');
  document.getElementById('calendarBtn')?.classList.toggle('active',v==='calendar');
  document.getElementById('pomodoroBtn')?.classList.toggle('active',v==='pomodoro');
  if(v==='calendar')renderCalendar();
  if(v==='pomodoro')renderPomodoro();
}
function applyTheme(dark){
  const html=document.documentElement;
  html.classList.add('theme-instant');
  document.body.classList.toggle('dark',!!dark);
  localStorage.setItem('kanban_theme',dark?'dark':'light');
  void html.offsetHeight;
  html.classList.remove('theme-instant');
}
function toggleTheme(){applyTheme(!document.body.classList.contains('dark'));saveStateNoHistory()}

// ─── Highlight card after calendar jump ──────────────────────────────
function highlightTask(id){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const card=document.querySelector(`.task-card[data-id="${id}"]`);
    if(!card)return;
    const column=card.closest('.column');
    const board=document.getElementById('board');
    if(board&&column){
      const cr=column.getBoundingClientRect();
      const br=board.getBoundingClientRect();
      const next=board.scrollLeft+(cr.left-br.left)-(br.width-cr.width)/2;
      board.scrollTo({left:Math.max(0,next),behavior:'smooth'});
    }
    const container=card.closest('.tasks-container');
    if(container){
      const cardTop=card.offsetTop;
      const containerH=container.clientHeight;
      const cardH=card.offsetHeight;
      container.scrollTo({top:cardTop-containerH/2+cardH/2,behavior:'smooth'});
    }
    card.classList.remove('task-highlight');
    void card.offsetWidth;
    card.classList.add('task-highlight');
  }));
}

// ─── Registry ─────────────────────────────────────────────────────────
function openRegistry(){
  const body=document.getElementById('registryBody');body.innerHTML='';
  const all=[];
  state.columns.forEach(col=>{[...col.tasks,...col.completed].forEach(t=>all.push({task:t,colTitle:col.title}))});
  const byId=new Map(all.map(x=>[String(x.task.id||''),x.task]));
  const keyOf=(task)=>{
    let cur=task;
    const seen=new Set();
    while(cur?._spawnedFromTaskId){
      const pId=String(cur._spawnedFromTaskId);
      if(!pId||seen.has(pId))break;
      seen.add(pId);
      const p=byId.get(pId);
      if(!p)break;
      cur=p;
    }
    return String(cur?.id||task.id||'');
  };
  const repeatingMap=new Map();
  all.forEach(({task,colTitle})=>{
    if(!isRepeatConfigured(task))return;
    const k=keyOf(task);
    const prev=repeatingMap.get(k);
    if(!prev){repeatingMap.set(k,{task,colTitle});return;}
    // Prefer active (not completed) representative; fallback to latest deadline.
    const prevDone=!!prev.task.completed, nextDone=!!task.completed;
    if(prevDone&&!nextDone){repeatingMap.set(k,{task,colTitle});return;}
    const prevDl=String(prev.task.deadline||''), nextDl=String(task.deadline||'');
    if(nextDl>prevDl)repeatingMap.set(k,{task,colTitle});
  });
  const repeating=[...repeatingMap.values()];
  if(!repeating.length){
    body.innerHTML=`<div class="reg-empty reg-empty-visual">${icon(icoShapes.rotateCcw,28,'ico ico-reg-empty')}Нет регулярных задач.<span class="reg-empty-hint">Назначьте повторение на карточке — пункт «Регулярность».</span></div>`;
  }else{
    repeating.forEach(({task,colTitle})=>{
      const el=document.createElement('div');el.className='reg-task';el.style.borderLeftColor=PDOTS[task.priority]||'var(--primary)';
      el.innerHTML=`<div class="reg-task-header"><span class="reg-task-title">${escapeHtml(task.title)}</span><span class="reg-task-col">${escapeHtml(colTitle)}</span></div><div class="reg-task-body"><div class="reg-task-meta"><span class="reg-chip">${icon(icoShapes.rotateCcw,13,'ico')}${escapeHtml(repeatLabel(task.repeat))}</span>${(getDisplayDeadlineIso(task)?`<span class="reg-chip reg-chip-muted">${icon(icoShapes.calendarDot,13,'ico')}${escapeHtml(deadlineLabel(getDisplayDeadlineIso(task)))}</span>`:'')}</div><div class="reg-task-actions"><button type="button" class="reg-edit-btn" data-id="${escapeAttr(task.id)}">Настроить</button><button type="button" class="reg-remove-btn" data-id="${escapeAttr(task.id)}">Убрать</button></div></div>`;
      body.appendChild(el);
    });
    body.querySelectorAll('.reg-edit-btn').forEach(btn=>btn.addEventListener('click',()=>{const t=findTask(btn.dataset.id);if(!t)return;closeRegistry();openPanel(t.id)}));
    body.querySelectorAll('.reg-remove-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const t=findTask(btn.dataset.id);if(!t)return;
      pushHistory();
      clearRepeatAndSpawned(t.id);
      saveStateNoHistory();
      renderBoard();
      openRegistry();
    }));
  }
  document.getElementById('registryModal').classList.add('open');
}
function closeRegistry(){document.getElementById('registryModal').classList.remove('open')}

// ─── Filters ──────────────────────────────────────────────────────────
window.clearAllFilters=()=>clearAllFiltersUi(()=>{renderBoard();renderCalendar();renderPomodoro()})
function positionFilterPanel(){
  const btn=document.getElementById('filterBtn');
  const panel=document.getElementById('filterPanel');
  if(!btn||!panel)return;
  const wasOpen=panel.classList.contains('open');
  if(!wasOpen)panel.style.display='block';
  const r=btn.getBoundingClientRect();
  const gap=6;
  const pw=panel.offsetWidth||330;
  const ph=panel.offsetHeight||320;
  let left=r.left;
  let top=r.bottom+gap;
  if(left+pw>window.innerWidth-10)left=Math.max(10,window.innerWidth-pw-10);
  if(left<10)left=10;
  if(top+ph>window.innerHeight-10)top=Math.max(10,r.top-gap-ph);
  panel.style.left=`${Math.round(left)}px`;
  panel.style.top=`${Math.round(top)}px`;
  if(!wasOpen)panel.style.display='';
}
window.toggleFilterPanel=()=>{
  const panel=document.getElementById('filterPanel');
  if(!panel)return;
  const willOpen=!panel.classList.contains('open');
  if(willOpen)positionFilterPanel();
  panel.classList.toggle('open',willOpen);
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.filter-btn-wrap')&&!e.target.closest('#filterPanel')){
    document.getElementById('filterPanel')?.classList.remove('open');
  }
})

// ─── Sticker Menu ─────────────────────────────────────────────────────
function getMissingStickers(t){const m=[];if(!t.priority)m.push('priority');if(!t.volume)m.push('volume');if(!hasPomodoro(t))m.push('pomodoro');if(!t.deadline&&!isRepeatConfigured(t))m.push('deadline');if(!isRepeatConfigured(t))m.push('repeat');return m}
function closeStickerMenu(){const menu=document.getElementById('stickerMenu');menu.classList.remove('open');menu.style.display='none';menu.innerHTML='';stickerMenuOpen=false;stickerTaskId=null}
function positionMenu(menu,x,y){menu.style.display='block';const mw=menu.offsetWidth||200,mh=menu.offsetHeight||300;let l=x,t=y+8;if(l+mw>window.innerWidth-8)l=window.innerWidth-mw-8;if(t+mh>window.innerHeight-8)t=y-mh-4;menu.style.left=l+'px';menu.style.top=t+'px'}
function isoDateToRu(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return'';const[y,m,d]=s.split('-');return`${d}-${m}-${y}`;}
function ruDateToIso(s){const m=String(s||'').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';}
function isoDateTimeToRu(s){const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);return m?`${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}`:'';}
function ruDateTimeToIso(s){const m=String(s||'').trim().match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);return m?`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`:'';}
function normalizeHm(s){const m=String(s||'').trim().match(/^(\d{2}):(\d{2})$/);return m?`${m[1]}:${m[2]}`:'';}
function normalizeDateDash(s){const iso=ruDateToIso(s);return iso?isoDateToRu(iso):s;}
function fillMaskTemplate(v,template,maxDigits){
  const digits=String(v||'').replace(/\D+/g,'').slice(0,maxDigits);
  let di=0,out='';
  for(const ch of template){
    if(/[ДМГЧ]/.test(ch)){
      out+=digits[di]??ch;
      if(digits[di]!=null)di++;
    }else{
      out+=ch;
    }
  }
  return out;
}
function caretAfterDigits(template,digitsCount){
  if(digitsCount<=0){
    const first=template.search(/[ДМГЧ]/);
    return first===-1?0:first;
  }
  let seen=0;
  for(let i=0;i<template.length;i++){
    if(!/[ДМГЧ]/.test(template[i]))continue;
    seen++;
    if(seen===digitsCount)return i+1;
  }
  return template.length;
}
function bindMaskedInput(el,kind){
  if(!el||el.dataset.maskBound==='1')return;
  const cfg=kind==='date'
    ? {parts:[2,2,4],seps:['-','-'],max:8,template:'ДД-ММ-ГГГГ'}
    : kind==='time'
      ? {parts:[2,2],seps:[':'],max:4,template:'ЧЧ:ММ'}
      : {parts:[2,2,4,2,2],seps:['-','-',' ',':'],max:12,template:'ДД-ММ-ГГГГ ЧЧ:ММ'};
  const apply=(setCaret=true)=>{
    const digitsCount=String(el.value||'').replace(/\D+/g,'').slice(0,cfg.max).length;
    el.value=fillMaskTemplate(el.value,cfg.template,cfg.max);
    if(setCaret&&document.activeElement===el){
      const pos=caretAfterDigits(cfg.template,digitsCount);
      el.setSelectionRange(pos,pos);
    }
  };
  el.addEventListener('input',apply);
  el.addEventListener('paste',()=>setTimeout(apply,0));
  el.addEventListener('focus',()=>{
    const hasDigits=/\d/.test(String(el.value||''));
    if(!hasDigits)el.value=cfg.template;
    apply(true);
  });
  el.addEventListener('click',()=>{
    if(document.activeElement===el)apply(true);
  });
  el.addEventListener('blur',()=>{
    const digits=String(el.value||'').replace(/\D+/g,'');
    if(!digits)el.value='';
  });
  el.dataset.maskBound='1';
  if(el.value)apply(false);
}
function prioBarsHtml(val){
  if(!val)return '';
  return `<span class="pri-bars prio-bars-${val}"><i></i><i></i><i></i></span>`;
}
function initPanelDropdown(id,items,onChange){
  const root=document.getElementById(id);if(!root)return;
  return initPanelDropdownElement(root,items,onChange,id);
}
function initPanelDropdownElement(root,items,onChange,key){
  root.classList.add('panel-dd-wrap');
  root.innerHTML='';
  const btn=document.createElement('button');btn.type='button';btn.className='panel-dd-btn';
  const cap=document.createElement('span');cap.className='panel-dd-cap';btn.appendChild(cap);
  const chev=document.createElement('span');chev.className='panel-dd-chevron';chev.innerHTML=icon(icoShapes.chevronDown,14,'ico');btn.appendChild(chev);
  const menu=document.createElement('div');menu.className='panel-dd-menu';
  items.forEach(it=>{
    const row=document.createElement('button');row.type='button';row.className='panel-dd-item';
    const leading=document.createElement('span');leading.className='panel-dd-leading';
    if(it.kind==='priority')leading.innerHTML=prioBarsHtml(it.value);
    else if(it.iconName)leading.innerHTML=icon(icoShapes[it.iconName],14,'ico');
    else if(it.leadingText)leading.textContent=it.leadingText;
    const txt=document.createElement('span');txt.textContent=it.label;
    row.appendChild(leading);row.appendChild(txt);
    row.addEventListener('click',e=>{
      e.stopPropagation();
      setValue(it.value,true);
      root.classList.remove('open');
    });
    menu.appendChild(row);
  });
  root.appendChild(btn);root.appendChild(menu);
  const setValue=(value,emit=false)=>{
    const it=items.find(x=>x.value===value)||items[0];
    root.dataset.value=it?.value??'';
    cap.innerHTML='';
    const lead=document.createElement('span');lead.className='panel-dd-leading';
    if(it?.kind==='priority')lead.innerHTML=prioBarsHtml(it.value);
    else if(it?.iconName)lead.innerHTML=icon(icoShapes[it.iconName],14,'ico');
    else if(it?.leadingText)lead.textContent=it.leadingText||'';
    const text=document.createElement('span');text.textContent=it?.label||'';
    cap.appendChild(lead);cap.appendChild(text);
    menu.querySelectorAll('.panel-dd-item').forEach((el,idx)=>el.classList.toggle('active',items[idx].value===it?.value));
    if(emit&&onChange)onChange(it?.value??'');
  };
  btn.addEventListener('click',e=>{e.stopPropagation();document.querySelectorAll('.panel-dd-wrap.open').forEach(x=>{if(x!==root)x.classList.remove('open')});root.classList.toggle('open')});
  const api={setValue,getValue:()=>root.dataset.value||'',close:()=>root.classList.remove('open')};
  if(key)panelDropdowns[key]=api;
  setValue(items[0]?.value??'',false);
  return api;
}
function initTaskPanelDropdowns(){
  const prioItems=[{value:'',label:'Не указан',leadingText:'—'},...PRIORITIES.map(([value,label])=>({value,label,kind:'priority'}))];
  const volumeItems=[{value:'',label:'Не указан',leadingText:'—'},...VOLUMES.map(v=>({value:v,label:v,iconName:'package'}))];
  initPanelDropdown('taskReminderDd',[
    {value:'',label:'Нет',iconName:'timer'},
    {value:'5m',label:'За 5 минут',iconName:'timer'},
    {value:'15m',label:'За 15 минут',iconName:'timer'},
    {value:'30m',label:'За 30 минут',iconName:'timer'},
    {value:'1h',label:'За час',iconName:'timer'},
    {value:'3h',label:'За 3 часа',iconName:'timer'},
    {value:'1d',label:'За сутки',iconName:'timer'},
    {value:'1w',label:'За неделю',iconName:'timer'}
  ],value=>{if(selectedTask){pushHistory();selectedTask.deadlineReminder=value||'';saveStateNoHistory();renderBoard()}});
  initPanelDropdown('taskPriorityDd',prioItems,value=>{if(selectedTask){pushHistory();selectedTask.priority=value;saveStateNoHistory();renderBoard()}});
  initPanelDropdown('taskVolumeDd',volumeItems,value=>{if(selectedTask){pushHistory();selectedTask.volume=value;saveStateNoHistory();renderBoard()}});
  initPanelDropdown('pomUnitDd',[
    {value:'min',label:'мин',iconName:'timer'},
    {value:'h',label:'час',iconName:'timer'}
  ],value=>{if(selectedTask){pushHistory();applyPanelPomodoroFromInputs();saveStateNoHistory();renderBoard();renderPomodoro()}});
  initPanelDropdown('panelRepeatUnitDd',[
    {value:'days',label:'дней',iconName:'rotateCcw'},
    {value:'weeks',label:'недель',iconName:'rotateCcw'},
    {value:'months',label:'месяцев',iconName:'rotateCcw'},
    {value:'weekdays',label:'дни недели',iconName:'rotateCcw'}
  ],syncPanelRepeatUnitUI);
}
function showStickerMenu(e,task){
  e.stopPropagation();e.preventDefault();stickerTaskId=task.id;
  const menu=document.getElementById('stickerMenu');menu.innerHTML='';
  const missing=getMissingStickers(task);if(!missing.length){closeStickerMenu();return}
  const pick={deadline:[icoShapes.calendarDot,'Дедлайн'],repeat:[icoShapes.rotateCcw,'Регулярность'],priority:[icoShapes.flag,'Приоритет'],volume:[icoShapes.package,'Объём'],pomodoro:[icoShapes.timer,'Помодоро']};
  missing.forEach(type=>{
    const item=document.createElement('div');item.className='sm-item sm-item-rich';const[ch,txt]=pick[type];item.innerHTML=`${icon(ch,14,'ico sm-leading')}<span>${txt}</span>`;
    item.addEventListener('click',ev=>{
      ev.stopPropagation();
      showStickerSubmenu(type,e.clientX,e.clientY,task);
    });
    menu.appendChild(item)});
  menu.classList.add('open');stickerMenuOpen=true;positionMenu(menu,e.clientX,e.clientY);
}
function showStickerSubmenu(type,ox,oy,task){
  if(!task)task=findTask(stickerTaskId);if(!task)return;
  const menu=document.getElementById('stickerMenu');menu.innerHTML='';
  const addBack=()=>{const b=document.createElement('div');b.className='sm-back';b.innerHTML=`${icon(icoShapes.chevronLeft,14,'ico sm-leading')}Назад`;b.addEventListener('click',ev=>{ev.stopPropagation();showStickerMenu({clientX:ox,clientY:oy,stopPropagation:()=>{},preventDefault:()=>{}},task)});menu.appendChild(b)};
  const ac=(fn)=>{pushHistory();fn();saveStateNoHistory();renderBoard();renderPomodoro();closeStickerMenu()};
  if(type==='priority'){
    const l=document.createElement('div');l.className='sm-section-label';l.textContent='Приоритет';menu.appendChild(l);
    const n=document.createElement('div');n.className='sm-item sm-item-rich';n.innerHTML='<span class="sm-leading">—</span><span>Не указан</span>';n.addEventListener('click',ev=>{ev.stopPropagation();ac(()=>task.priority='')});menu.appendChild(n);
    PRIORITIES.forEach(([val,txt])=>{const i=document.createElement('div');i.className='sm-item sm-item-rich';i.innerHTML=`<span class="pri-bars prio-bars-${val}"><i></i><i></i><i></i></span><span>${txt}</span>`;i.addEventListener('click',ev=>{ev.stopPropagation();ac(()=>task.priority=val)});menu.appendChild(i)});
  }else if(type==='volume'){
    const l=document.createElement('div');l.className='sm-section-label';l.textContent='Объём';menu.appendChild(l);
    const n=document.createElement('div');n.className='sm-item sm-item-rich';n.innerHTML='<span class="sm-leading">—</span><span>Не указан</span>';n.addEventListener('click',ev=>{ev.stopPropagation();ac(()=>task.volume='')});menu.appendChild(n);
    VOLUMES.forEach(v=>{const i=document.createElement('div');i.className='sm-item sm-item-rich';i.innerHTML=`${icon(icoShapes.package,14,'ico sm-leading')}<span>${v}</span>`;i.addEventListener('click',ev=>{ev.stopPropagation();ac(()=>task.volume=v)});menu.appendChild(i)});
  } else if (type === 'pomodoro') {
  const l = document.createElement('div'); l.className = 'sm-section-label'; l.textContent = 'Помодоро'; menu.appendChild(l);
  const w = document.createElement('div'); w.className = 'sm-input-wrap sm-pom-wrap';
  let pom = normalizePomodoro(task.pomodoro);
  // Если помодоро не задано — подставляем значения по умолчанию только для формы
  if (!pom) pom = { count: 3, val: 25, unit: 'min', done: 0 };
  const countInp = document.createElement('input'); countInp.className = 'sm-input sm-input-narrow'; countInp.type = 'text'; countInp.inputMode = 'numeric'; countInp.value = String(pom.count); countInp.placeholder = 'Кол'; countInp.addEventListener('input', () => { countInp.value = String(countInp.value || '').replace(/\D+/g, '').slice(0, 2); });
  const x = document.createElement('span'); x.className = 'sm-pom-x'; x.textContent = '×';
  const durInp = document.createElement('input'); durInp.className = 'sm-input sm-input-narrow'; durInp.type = 'text'; durInp.inputMode = 'numeric'; durInp.value = String(pom.val); durInp.placeholder = 'Мин'; durInp.addEventListener('input', () => { durInp.value = String(durInp.value || '').replace(/\D+/g, '').slice(0, 3); });
  w.appendChild(countInp); w.appendChild(x); w.appendChild(durInp);
  const ur = document.createElement('div'); ur.className = 'sm-unit-row';
  const minBtn = document.createElement('button'); minBtn.type = 'button'; minBtn.className = 'sm-unit-btn'; minBtn.dataset.u = 'min'; minBtn.innerHTML = `${icon(icoShapes.timer, 13, 'ico')}мин`;
  const hBtn = document.createElement('button'); hBtn.type = 'button'; hBtn.className = 'sm-unit-btn'; hBtn.dataset.u = 'h'; hBtn.innerHTML = `${icon(icoShapes.timer, 13, 'ico')}час`;
  ur.appendChild(minBtn); ur.appendChild(hBtn); w.appendChild(ur);
  let unitVal = pom.unit === 'h' ? 'h' : 'min';
  const syncUnits = () => { minBtn.classList.toggle('active', unitVal === 'min'); hBtn.classList.toggle('active', unitVal === 'h'); };
  minBtn.addEventListener('click', e => { e.stopPropagation(); unitVal = 'min'; syncUnits(); });
  hBtn.addEventListener('click', e => { e.stopPropagation(); unitVal = 'h'; syncUnits(); });
  syncUnits();
  const ap = document.createElement('button'); ap.className = 'sm-btn apply'; ap.textContent = 'Применить';
  ap.addEventListener('click', ev => {
    ev.stopPropagation();
    const count = parseInt(countInp.value, 10) || 0;
    const val = parseInt(durInp.value, 10) || 0;
    if (count > 0 && val > 0) {
      ac(() => setTaskPomodoro(task, { count, val, unit: unitVal }, state));
    } else {
      ac(() => clearTaskPomodoro(task, state));
    }
  });
  w.appendChild(ap);
  menu.appendChild(w);
  if (hasPomodoro(task)) {
    const go = document.createElement('div'); go.className = 'sm-item sm-item-rich'; go.innerHTML = `${icon(icoShapes.play, 14, 'ico sm-leading')}<span>Запустить</span>`; go.addEventListener('click', ev => { ev.stopPropagation(); closeStickerMenu(); launchPomodoroForTask(task.id); }); menu.appendChild(go);
    const r = document.createElement('div'); r.className = 'sm-item sm-item-rich danger'; r.innerHTML = `${icon(icoShapes.x, 14, 'ico sm-leading')}Убрать помодоро`; r.addEventListener('click', ev => { ev.stopPropagation(); ac(() => clearTaskPomodoro(task, state)); }); menu.appendChild(r);
  }

  }else if(type==='deadline'){
    const l=document.createElement('div');l.className='sm-section-label';l.textContent='Дедлайн';menu.appendChild(l);
    const w=document.createElement('div');w.className='sm-input-wrap';
    const inp=document.createElement('input');inp.type='text';inp.className='sm-input';inp.placeholder='ДД-ММ-ГГГГ ЧЧ:ММ';inp.value=isoDateTimeToRu(task.deadline||'');inp.id='_dlV';inp.addEventListener('click',ev=>ev.stopPropagation());w.appendChild(inp);
    bindMaskedInput(inp,'datetime');
    const ap=document.createElement('button');ap.className='sm-btn apply';ap.textContent='Применить';ap.addEventListener('click',ev=>{ev.stopPropagation();const val=ruDateTimeToIso(document.getElementById('_dlV').value);if(val){pushHistory();task.deadline=val;saveStateNoHistory();renderBoard();closeStickerMenu()}else showHkHint('Формат: ДД-ММ-ГГГГ ЧЧ:ММ')});w.appendChild(ap);menu.appendChild(w);
    if(task.deadline){const r=document.createElement('div');r.className='sm-item sm-item-rich danger';r.innerHTML=`${icon(icoShapes.x,14,'ico sm-leading')}Убрать дедлайн`;r.addEventListener('click',ev=>{ev.stopPropagation();ac(()=>task.deadline='')});menu.appendChild(r)}
  }else if(type==='repeat'){
    const l=document.createElement('div');l.className='sm-section-label';l.textContent='Регулярность';menu.appendChild(l);
    const box=document.createElement('div');box.className='panel-repeat-box';
    const row=document.createElement('div');row.className='panel-row panel-repeat-interval-row';
    const every=document.createElement('input');every.type='text';every.inputMode='numeric';every.placeholder='1';every.value=String(task.repeat?.every||1);every.id='_repEvery';
    every.addEventListener('input',e=>{e.target.value=String(e.target.value||'').replace(/\D+/g,'').slice(0,3)});
    const unitRoot=document.createElement('div');unitRoot.className='panel-dd panel-dd-compact';unitRoot.style.minWidth='148px';
    row.appendChild(every);row.appendChild(unitRoot);box.appendChild(row);
    const wd=document.createElement('div');wd.className='panel-repeat-weekdays';wd.id='_repWeekdays';
    wd.innerHTML=`<label class="repeat-wd"><input type="checkbox" class="_rep-wd" value="1"/> Пн</label><label class="repeat-wd"><input type="checkbox" class="_rep-wd" value="2"/> Вт</label><label class="repeat-wd"><input type="checkbox" class="_rep-wd" value="3"/> Ср</label><label class="repeat-wd"><input type="checkbox" class="_rep-wd" value="4"/> Чт</label><label class="repeat-wd"><input type="checkbox" class="_rep-wd" value="5"/> Пт</label><label class="repeat-wd"><input type="checkbox" class="_rep-wd" value="6"/> Сб</label><label class="repeat-wd"><input type="checkbox" class="_rep-wd" value="0"/> Вс</label>`;
    box.appendChild(wd);
    const grid=document.createElement('div');grid.className='panel-repeat-grid';
    const wrapT=document.createElement('div');wrapT.className='panel-repeat-field-compact panel-repeat-field-time';
    const lt=document.createElement('span');lt.className='panel-repeat-sublabel';lt.textContent='Время';
    const time=document.createElement('input');time.type='text';time.id='_repTime';time.placeholder='ЧЧ:ММ';time.value=task.repeat?.time||'';
    wrapT.appendChild(lt);wrapT.appendChild(time);
    const wrapS=document.createElement('div');wrapS.className='panel-repeat-field-compact';
    const ls=document.createElement('span');ls.className='panel-repeat-sublabel';ls.textContent='Начало';
    const start=document.createElement('input');start.type='text';start.id='_repStart';start.placeholder='ДД-ММ-ГГГГ';start.value=isoDateToRu(task.repeat?.start||localDateStr(new Date()));
    wrapS.appendChild(ls);wrapS.appendChild(start);
    const wrapE=document.createElement('div');wrapE.className='panel-repeat-field-compact';
    const le=document.createElement('span');le.className='panel-repeat-sublabel';le.textContent='Конец';
    const end=document.createElement('input');end.type='text';end.id='_repEnd';end.placeholder='необязательно';end.value=isoDateToRu(task.repeat?.end||'');
    wrapE.appendChild(le);wrapE.appendChild(end);
    grid.appendChild(wrapT);grid.appendChild(wrapS);grid.appendChild(wrapE);
    box.appendChild(grid);
    bindMaskedInput(time,'time');bindMaskedInput(start,'date');bindMaskedInput(end,'date');
    const dd=initPanelDropdownElement(unitRoot,[
      {value:'days',label:'дней',iconName:'rotateCcw'},
      {value:'weeks',label:'недель',iconName:'rotateCcw'},
      {value:'months',label:'месяцев',iconName:'rotateCcw'},
      {value:'weekdays',label:'дни недели',iconName:'rotateCcw'}
    ],()=>{wd.style.display=dd.getValue()==='weekdays'?'flex':'none';});
    dd.setValue(task.repeat?.unit||'days',false);
    wd.style.display=dd.getValue()==='weekdays'?'flex':'none';
    if(Array.isArray(task.repeat?.weekdays)){
      wd.querySelectorAll('._rep-wd').forEach(cb=>{cb.checked=task.repeat.weekdays.includes(parseInt(cb.value,10));});
    }
    const actions=document.createElement('div');actions.className='panel-repeat-actions';
    if(isRepeatConfigured(task)){
      const clr=document.createElement('button');clr.type='button';clr.className='btn-repeat-clear reg-remove-btn';clr.textContent='Убрать';
      clr.addEventListener('click',e=>{e.stopPropagation();ac(()=>clearRepeatAndSpawned(task.id));});
      actions.appendChild(clr);
    }
    const ap=document.createElement('button');ap.type='button';ap.className='btn-repeat-save';ap.textContent='Применить';
    ap.addEventListener('click',e=>{
      e.stopPropagation();
      const unit=dd.getValue()||'days';
      const everyVal=Math.max(1,parseInt(every.value,10)||1);
      let weekdays=null;
      if(unit==='weekdays'){
        weekdays=[...wd.querySelectorAll('._rep-wd:checked')].map(cb=>parseInt(cb.value,10)).sort((a,b)=>a-b);
        if(!weekdays.length){showHkHint('Выберите хотя бы один день недели');return;}
      }
      const timeVal=normalizeHm(time.value);
      const startIso=ruDateToIso(start.value);
      const endRaw=end.value.trim();
      const endIso=endRaw?ruDateToIso(endRaw):'';
      if(!startIso){showHkHint('Старт: ДД-ММ-ГГГГ');return;}
      if(endRaw&&!endIso){showHkHint('Конец: ДД-ММ-ГГГГ');return;}
      if(time.value.trim()&&!timeVal){showHkHint('Время: ЧЧ:ММ');return;}
      ac(()=>{
        const next={every:everyVal,unit,time:timeVal,start:startIso,end:endIso};
        if(unit==='weekdays')next.weekdays=weekdays;
        task.repeat=next;
        if(timeVal&&/^\d{2}:\d{2}$/.test(timeVal)){
          const dp=(task.deadline?.length>=10&&task.deadline.slice(0,10))||(next.start||'');
          if(/^\d{4}-\d{2}-\d{2}$/.test(dp))task.deadline=`${dp}T${timeVal}`;
        }
      });
    });
    actions.appendChild(ap);
    box.appendChild(actions);
    menu.appendChild(box);
  }
  addBack();positionMenu(menu,ox,oy);
}
function editSticker(e,task,type){e.stopPropagation();e.preventDefault();stickerTaskId=task.id;const menu=document.getElementById('stickerMenu');menu.innerHTML='';menu.classList.add('open');stickerMenuOpen=true;showStickerSubmenu(type,e.clientX,e.clientY,task)}

// ─── DnD Board ────────────────────────────────────────────────────────
function setupBoardDnD(){
  const board=document.getElementById('board');if(!board)return;
  board.ondragstart=e=>{
    const card=e.target.closest('.task-card'),col=e.target.closest('.column');
    if(card&&!e.target.closest('.column-menu-btn')&&!e.target.closest('.sticker-add-btn')&&!e.target.closest('.sticker')&&!e.target.closest('.sub-drag-handle')){draggedTaskId=card.dataset.id;draggedColId=null;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';return}
    if(col&&e.target.closest('.column-header')){
      if(e.target.closest('.column-menu-btn')||e.target.closest('.column-icon-btn')){e.preventDefault();return}
      draggedColId=col.dataset.id;draggedTaskId=null;col.classList.add('dragging-col');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedColId);return
    }
  };
  board.ondragover=e=>{
    e.preventDefault();
    const tl=e.target.closest('.task-list');
    if(tl&&draggedTaskId){
      removeDropIndicator();
      const af=getDragAfterElement(tl,e.clientY);
      dropIndicator=document.createElement('div');
      dropIndicator.className='drop-indicator';
      if(!af)tl.appendChild(dropIndicator);
      else tl.insertBefore(dropIndicator,af);
    }
    if(draggedColId){
      const over=e.target.closest('.column'),all=document.querySelectorAll('#board .column');
      if(over&&over.dataset.id!==draggedColId){
        all.forEach(c=>{if(c!==over)c.classList.remove('drag-over-col')});
        over.classList.add('drag-over-col');
      }else{
        all.forEach(c=>c.classList.remove('drag-over-col'));
      }
    }
  };
  board.ondragleave=e=>{const col=e.target.closest('.column');if(col&&!col.contains(e.relatedTarget))col.classList.remove('drag-over-col');const tl=e.target.closest('.task-list');if(tl&&!tl.contains(e.relatedTarget))removeDropIndicator()};
  board.ondrop=e=>{e.preventDefault();removeDropIndicator();document.querySelectorAll('.column,.task-card').forEach(c=>c.classList.remove('dragging-col','drag-over-col','dragging'));
    const targetColEl=e.target.closest('.column');
    if(targetColEl&&draggedColId&&draggedColId!==targetColEl.dataset.id){const from=state.columns.findIndex(c=>c.id===draggedColId),to=state.columns.findIndex(c=>c.id===targetColEl.dataset.id);if(from>-1&&to>-1){pushHistory();const[m]=state.columns.splice(from,1);state.columns.splice(to,0,m);saveStateNoHistory();renderBoard()}draggedColId=null;return}
    const tl=e.target.closest('.task-list');if(tl&&draggedTaskId){const tColId=tl.dataset.column,afEl=getDragAfterElement(tl,e.clientY);let task=null;for(const c of state.columns){const i=c.tasks.findIndex(t=>t.id===draggedTaskId);if(i!==-1){task=c.tasks.splice(i,1)[0];break}}if(task){const tc=state.columns.find(c=>c.id===tColId);if(tc){const nt=tc.tasks.filter(t=>t.id!==draggedTaskId);let idx=nt.length;if(afEl){const ai=nt.findIndex(t=>t.id===afEl.dataset.id);if(ai!==-1)idx=ai}nt.splice(idx,0,task);tc.tasks=nt}}saveStateNoHistory();renderBoard();draggedTaskId=null}};
  board.ondragend=()=>{removeDropIndicator();document.querySelectorAll('.column,.task-card').forEach(c=>c.classList.remove('dragging-col','drag-over-col','dragging'));draggedTaskId=null;draggedColId=null};
}
function getDragAfterElement(container,y){const cards=[...container.querySelectorAll('.task-card:not(.dragging)')];return cards.reduce((closest,child)=>{const box=child.getBoundingClientRect(),offset=y-box.top-box.height/2;return offset<0&&offset>closest.offset?{offset,element:child}:closest},{offset:Number.NEGATIVE_INFINITY}).element}
function removeDropIndicator(){if(dropIndicator?.parentNode)dropIndicator.parentNode.removeChild(dropIndicator);dropIndicator=null}

// ─── DnD Calendar ─────────────────────────────────────────────────────
function setupCalendarDnD(){const cal=document.getElementById('calendar');if(!cal)return;cal.ondragstart=e=>{const mini=e.target.closest('.day-task-mini');if(mini){draggedCalTaskId=mini.dataset.id;e.dataTransfer.effectAllowed='move';e.stopPropagation()}};cal.ondragover=e=>{const day=e.target.closest('.calendar-day');if(day&&draggedCalTaskId&&!day.classList.contains('empty')){e.preventDefault();day.classList.add('drag-over-day')}};cal.ondragleave=e=>{const day=e.target.closest('.calendar-day');if(day)day.classList.remove('drag-over-day')};cal.ondrop=e=>{e.preventDefault();const day=e.target.closest('.calendar-day');document.querySelectorAll('.calendar-day').forEach(d=>d.classList.remove('drag-over-day'));if(day&&draggedCalTaskId){const ds=day.dataset.date;if(ds){const t=findTask(draggedCalTaskId);if(t){pushHistory();const tail=t.deadline?.includes('T')?t.deadline.slice(t.deadline.indexOf('T')):repeatDeadlineTimeTail(t);t.deadline=ds+tail;if(t.repeat&&t.repeat.unit!=='weekdays')t.repeat.start=ds;saveStateNoHistory();renderCalendar();renderBoard()}}}draggedCalTaskId=null};cal.ondragend=()=>{document.querySelectorAll('.calendar-day').forEach(d=>d.classList.remove('drag-over-day'));draggedCalTaskId=null}}

// Board/calendar rendering: kanban/board-render.js, kanban/calendar-render.js

function addColumn(){
  showPrompt('Название колонки:',t=>{
    if(t){
      pushHistory();
      const id=Date.now().toString();
      state.columns.push({id,title:t,color:'#6366f1',icon:defaultPackColumnIcon(),tasks:[],completed:[],sortBy:'manual',compOpen:false});
      state.focusedColumnId=id;
      saveStateNoHistory();
      renderBoard();
    }
  });
}

// ─── Menus ────────────────────────────────────────────────────────────
function sortMenuSectionHtml(actionForMode){
  const head='<div style="padding:4px 16px 2px;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.07em;text-transform:uppercase">Сортировка</div>';
  const items=SORT_MENU_ITEMS.map(([mode,label])=>`<div class="menu-item" onclick="${actionForMode(mode)}">${label}</div>`).join('');
  return head+items;
}
function sortModeHint(by){
  return SORT_MENU_ITEMS.find(([m])=>m===by)?.[1]||by;
}
function positionHeaderDropdown(menu,anchorEl){
  const r=anchorEl.getBoundingClientRect();
  menu.style.display='block';
  const mw=menu.offsetWidth||200;
  const mh=menu.offsetHeight||240;
  let left=r.left;
  let top=r.bottom+6;
  if(left+mw>window.innerWidth-10)left=Math.max(10,window.innerWidth-mw-10);
  if(top+mh>window.innerHeight-10)top=Math.max(10,r.top-mh-6);
  menu.style.left=`${Math.round(left)}px`;
  menu.style.top=`${Math.round(top)}px`;
}
window.toggleGlobalSortMenu=function(e){
  if(activeMenu?.dataset?.globalSort){closeMenu();return}
  closeMenu();
  const btn=document.getElementById('globalSortBtn');
  if(!btn)return;
  if(e?.stopPropagation)e.stopPropagation();
  const m=document.createElement('div');
  m.className='fixed-menu';
  m.dataset.globalSort='1';
  m.innerHTML=sortMenuSectionHtml(mode=>`sortBoard('${mode}')`);
  document.body.appendChild(m);
  positionHeaderDropdown(m,btn);
  activeMenu=m;
}
window.sortBoard=function(by){
  pushHistory();
  sortAllColumns(state.columns,by);
  saveStateNoHistory();
  renderBoard();
  closeMenu();
  showHkHint(sortModeHint(by));
}
window.openColMenu=function(e,colId){e.stopPropagation();closeMenu();const cid=escapeAttr(colId);const rect=e.target.getBoundingClientRect();const packMenuIco=`<img class="ico mi-ico col-menu-pack-ico" src="${packIconUrl('cog.svg')}" alt="" decoding="async"/>`;const m=document.createElement('div');m.className='fixed-menu';m.innerHTML=`<div class="menu-item menu-item-rich" onclick="openColumnStyleModal('${cid}')">${packMenuIco}Иконка и цвет…</div><div class="menu-item" onclick="renameCol('${cid}')">Переименовать</div><div class="menu-sep"></div>${sortMenuSectionHtml(mode=>`sortCol('${cid}','${mode}')`)}<div class="menu-sep"></div><div class="menu-item" style="color:var(--danger)" onclick="delCol('${cid}')">Удалить</div>`;placeMenu(m,rect);document.body.appendChild(m);activeMenu=m}
function openTaskMenu(e,id){
  e.stopPropagation();closeMenu();const rect=e.target.getBoundingClientRect();
  const tid=escapeAttr(id);
  const t=findTask(id);
  const noSubs=!t?.subtasks?.length;
  const subMi=noSubs?`<div class="menu-item menu-item-rich" onclick="expandSubtasksBlock('${tid}')">${icon(icoShapes.chevronsDown,13,'ico mi-ico')}Подзадачи…</div>`:'';
  const m=document.createElement('div');m.className='fixed-menu';
  m.innerHTML=`<div class="menu-item" onclick="openPanel('${tid}')">Редактировать</div><div class="menu-item" onclick="renameTask('${tid}')">Переименовать</div><div class="menu-item">Цвет<div class="color-picker">${['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b'].map(c=>`<div class="color-circle" style="background:${c}" onclick="colorTask('${tid}','${c}')"></div>`).join('')}</div></div>${subMi}<div class="menu-sep"></div><div class="menu-item menu-item-rich" onclick="saveTaskAsTemplate('${tid}')">${icon(icoShapes.copy,14,'ico mi-ico')}В шаблон…</div><div class="menu-item menu-item-rich" onclick="moveTaskToArchive('${tid}')">${icon(icoShapes.archive,14,'ico mi-ico')}В архив</div><div class="menu-sep"></div><div class="menu-item menu-danger" onclick="delTask('${tid}')">Удалить</div>`;
  placeMenu(m,rect);document.body.appendChild(m);activeMenu=m;
}
function placeMenu(m,rect){let l=rect.right+4,t=rect.bottom;if(l+210>window.innerWidth)l=rect.left-214;if(t+340>window.innerHeight)t=rect.top-344;m.style.left=l+'px';m.style.top=t+'px'}
function closeMenu(){if(activeMenu){activeMenu.remove();activeMenu=null}}
document.addEventListener('click',closeMenu)

function isValidColumnIconRef(ic){
  if(!ic||typeof ic!=='string')return false;
  if(ic.startsWith('pack:'))return !!resolvePackFilename(ic.slice(5));
  return !!icoShapes[ic];
}
function normalizeColumnIconValue(ic){
  return isValidColumnIconRef(ic)?ic:defaultPackColumnIcon();
}
function columnIconHtml(col){
  const ic=col.icon||'';
  if(ic.startsWith('pack:')){
    const fn=resolvePackFilename(ic.slice(5));
    if(fn)return `<img class="ico col-pack-ico" src="${packIconUrl(fn)}" alt="" decoding="async"/>`;
  }
  const key=ic&&icoShapes[ic]?ic:'board';
  return icon(icoShapes[key],18,'ico');
}

function ensureColumnStyleGrid(){
  if(columnStyleGridReady)return;
  const g=document.getElementById('columnStyleIconGrid');
  const row=document.getElementById('columnStyleColorRow');
  if(!g||!row)return;
  columnStyleGridReady=true;
  g.innerHTML=COLUMN_PACK_ICON_FILES.map(f=>{
    const val=packIconValueFromFilename(f);
    return `<button type="button" class="col-style-ico col-style-ico-pack" data-col-icon="${val}" title="${f.replace(/\.svg$/i,'')}"><img src="${packIconUrl(f)}" alt="" loading="lazy" decoding="async"/></button>`;
  }).join('');
  row.innerHTML=COLUMN_COLOR_PRESETS.map(c=>`<button type="button" class="col-style-color-dot" data-col-c="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('');
  g.addEventListener('click',e=>{
    const b=e.target.closest('[data-col-icon]');if(!b)return;
    columnStyleSelIcon=b.dataset.colIcon;
    g.querySelectorAll('.col-style-ico-pack').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
  });
  row.addEventListener('click',e=>{
    const b=e.target.closest('[data-col-c]');if(!b)return;
    const c=b.dataset.colC;
    const inp=document.getElementById('columnStyleColorInput');if(inp)inp.value=c;
    row.querySelectorAll('.col-style-color-dot').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
  });
}

function syncColumnStyleColorDots(){
  const inp=document.getElementById('columnStyleColorInput');
  const row=document.getElementById('columnStyleColorRow');
  if(!inp||!row)return;
  const v=(inp.value||'').toLowerCase();
  row.querySelectorAll('.col-style-color-dot').forEach(d=>d.classList.toggle('selected',d.dataset.colC.toLowerCase()===v));
}

function openColumnStyleModal(colId){
  closeMenu();
  const col=state.columns.find(c=>c.id===colId);if(!col)return;
  ensureColumnStyleGrid();
  columnStyleColId=colId;
  columnStyleSelIcon=normalizeColumnIconValue(col.icon);
  const g=document.getElementById('columnStyleIconGrid');
  const ci=document.getElementById('columnStyleColorInput');
  if(ci)ci.value=col.color||'#6366f1';
  if(g)g.querySelectorAll('.col-style-ico-pack').forEach(x=>x.classList.toggle('selected',x.dataset.colIcon===columnStyleSelIcon));
  syncColumnStyleColorDots();
  document.getElementById('columnStyleModal')?.classList.add('open');
}

function closeColumnStyleModal(){
  document.getElementById('columnStyleModal')?.classList.remove('open');
  columnStyleColId=null;
}

function applyColumnStyle(){
  if(!columnStyleColId)return;
  const col=state.columns.find(c=>c.id===columnStyleColId);if(!col)return;
  const color=document.getElementById('columnStyleColorInput')?.value||col.color;
  const icon=normalizeColumnIconValue(columnStyleSelIcon);
  pushHistory();
  col.color=color;
  col.icon=icon;
  saveStateNoHistory();
  renderBoard();
  closeColumnStyleModal();
}

// ─── Task panel ───────────────────────────────────────────────────────
function syncPanelTaskTitleSize(){
  const el=document.getElementById('taskName');
  if(!el||el.tagName!=='TEXTAREA')return;
  el.style.height='auto';
  el.style.overflowY='hidden';
  const maxPx=parseFloat(getComputedStyle(el).maxHeight);
  const cap=Number.isFinite(maxPx)&&maxPx>0?maxPx:168;
  const sh=el.scrollHeight;
  el.style.height=Math.min(Math.max(sh,36),cap)+'px';
  el.style.overflowY=sh>cap?'auto':'hidden';
}
function cancelTaskPanelClose(){
  const p=document.getElementById('taskPanel');
  if(taskPanelCloseTimer){clearTimeout(taskPanelCloseTimer);taskPanelCloseTimer=null;}
  if(taskPanelTransitionEnd&&p){p.removeEventListener('transitionend',taskPanelTransitionEnd);taskPanelTransitionEnd=null;}
}
function openPanel(id){
  cancelTaskPanelClose();
  if(selectedTask&&selectedTask.id!==id)syncDescFromEditor();
  selectedTask=findTask(id);if(!selectedTask)return;
  document.getElementById('taskName').value=selectedTask.title;
  document.getElementById('taskDeadline').value=isoDateTimeToRu(getDisplayDeadlineIso(selectedTask)||'');
  syncPanelTaskTitleSize();
  const descEd=document.getElementById('descEditorInput');
  descEditorPushedHistory=false;
  if(descEd)descEd.innerHTML=markdownToHtml(selectedTask.description||'');
  syncDescColorSwatch();
  panelDropdowns.taskReminderDd?.setValue(selectedTask.deadlineReminder||'',false);
  panelDropdowns.taskPriorityDd?.setValue(selectedTask.priority||'',false);
  panelDropdowns.taskVolumeDd?.setValue(selectedTask.volume||'',false);
  const pomN=normalizePomodoro(selectedTask.pomodoro);
  document.getElementById('pomCount').value=hasPomodoro(selectedTask)?String(pomN.count):'';
  document.getElementById('pomDur').value=hasPomodoro(selectedTask)?String(pomN.val):'';
  panelDropdowns.pomUnitDd?.setValue(pomN.unit||'min',false);
  const pomStartBtn=document.getElementById('panelPomStartBtn');
  if(pomStartBtn)pomStartBtn.disabled=!hasPomodoro(selectedTask);
  fillPanelRepeatUi(selectedTask.repeat);
  setRepeatCaptionUi(selectedTask);
  const tp=document.getElementById('taskPanel');
  if(tp){tp.classList.remove('task-panel-no-trans');tp.classList.add('open');}
  const scrollBody=document.querySelector('#taskPanel .panel-body-scroll');
  if(scrollBody)scrollBody.scrollTop=0;
  document.getElementById('taskName').focus();
  requestAnimationFrame(()=>{
    syncPanelTaskTitleSize();
    const tn=document.getElementById('taskName');
    if(!tn)return;
    tn.scrollTop=0;
    tn.scrollLeft=0;
    try{tn.setSelectionRange(0,0)}catch(e){}
  });
  let titleChanged=false,deadlineChanged=false,pomChanged=false;
  const tn=document.getElementById('taskName');
  tn.onkeydown=e=>{if(e.key==='Enter')e.preventDefault()};
  tn.oninput=()=>{
    if(tn.value!==tn.value.replace(/\r?\n/g,' '))tn.value=tn.value.replace(/\r?\n/g,' ');
    syncPanelTaskTitleSize();
    if(selectedTask){if(!titleChanged){pushHistory();titleChanged=true}selectedTask.title=tn.value;saveStateNoHistory();renderBoard()}
  };
  document.getElementById('taskDeadline').onchange=()=>{if(selectedTask){const val=ruDateTimeToIso(document.getElementById('taskDeadline').value);if(!val&&document.getElementById('taskDeadline').value.trim()){showHkHint('Формат: ДД-ММ-ГГГГ ЧЧ:ММ');return;}if(!deadlineChanged){pushHistory();deadlineChanged=true}selectedTask.deadline=val;saveStateNoHistory();renderBoard()}};
  const bindPomInp=(el,maxLen)=>{if(!el)return;el.oninput=()=>{el.value=String(el.value||'').replace(/\D+/g,'').slice(0,maxLen);if(selectedTask){if(!pomChanged){pushHistory();pomChanged=true}applyPanelPomodoroFromInputs();const btn=document.getElementById('panelPomStartBtn');if(btn)btn.disabled=!hasPomodoro(selectedTask);saveStateNoHistory();renderBoard();renderPomodoro()}}};
  bindPomInp(document.getElementById('pomCount'),2);
  bindPomInp(document.getElementById('pomDur'),3);
  document.getElementById('panelPomStartBtn')?.addEventListener('click',()=>{if(selectedTask&&hasPomodoro(selectedTask))launchPomodoroForTask(selectedTask.id)});
  document.getElementById('panelRepeatEvery').oninput=e=>{e.target.value=String(e.target.value||'').replace(/\D+/g,'').slice(0,3);};
  document.getElementById('panelRepeatSaveBtn').onclick=savePanelRepeat;
  document.getElementById('panelRepeatClearBtn').onclick=clearPanelRepeat;
}
function finishTaskPanelClose(){
  syncDescFromEditor();
  descEditorPushedHistory=false;
  selectedTask=null;
}
function collapseTaskPanel(){
  const p=document.getElementById('taskPanel');
  if(!p||!p.classList.contains('open'))return;
  if(taskPanelCloseTimer){clearTimeout(taskPanelCloseTimer);taskPanelCloseTimer=null;}
  if(taskPanelTransitionEnd){p.removeEventListener('transitionend',taskPanelTransitionEnd);taskPanelTransitionEnd=null;}
  const fin=()=>{
    if(taskPanelTransitionEnd){p.removeEventListener('transitionend',taskPanelTransitionEnd);taskPanelTransitionEnd=null;}
    if(taskPanelCloseTimer){clearTimeout(taskPanelCloseTimer);taskPanelCloseTimer=null;}
    finishTaskPanelClose();
  };
  taskPanelTransitionEnd=e=>{if(e.propertyName==='transform')fin();};
  p.addEventListener('transitionend',taskPanelTransitionEnd);
  taskPanelCloseTimer=setTimeout(fin,450);
  p.classList.remove('open');
}
function closeTaskPanel(){
  const p=document.getElementById('taskPanel');
  if(p&&taskPanelTransitionEnd){p.removeEventListener('transitionend',taskPanelTransitionEnd);taskPanelTransitionEnd=null;}
  if(taskPanelCloseTimer){clearTimeout(taskPanelCloseTimer);taskPanelCloseTimer=null;}
  if(p){p.classList.add('task-panel-no-trans');p.classList.remove('open');void p.offsetHeight;p.classList.remove('task-panel-no-trans');}
  finishTaskPanelClose();
}

// ─── Repeat ───────────────────────────────────────────────────────────
function setRepeatCaptionUi(task){
  const rl=document.getElementById('panelRepeatLabel');if(!rl||!task)return;
  rl.textContent=repeatLabel(task.repeat);
  rl.classList.toggle('panel-repeat-on',isRepeatConfigured(task));
}
function syncPanelRepeatUnitUI(){
  const unit=panelDropdowns.panelRepeatUnitDd?.getValue()||'days';
  const row=document.getElementById('panelRepeatWeekdaysRow');
  if(row)row.style.display=unit==='weekdays'?'flex':'none';
}
function fillPanelRepeatUi(r){
  r=r||{};
  document.getElementById('panelRepeatEvery').value=r.every||1;
  panelDropdowns.panelRepeatUnitDd?.setValue(r.unit||'days',false);
  let timePreset=r.time||'';
  if(!timePreset&&selectedTask?.deadline?.includes('T'))
    try{timePreset=selectedTask.deadline.split('T')[1].slice(0,5)}catch(e){}
  document.getElementById('panelRepeatTime').value=timePreset;
  document.getElementById('panelRepeatStart').value=isoDateToRu(r.start||new Date().toISOString().slice(0,10));
  document.getElementById('panelRepeatEnd').value=isoDateToRu(r.end||'');
  document.querySelectorAll('.panel-repeat-wd-cb').forEach(cb=>{
    const v=parseInt(cb.value,10);
    cb.checked=Array.isArray(r.weekdays)&&r.weekdays.includes(v);
  });
  document.getElementById('panelRepeatClearBtn').style.display=(selectedTask&&isRepeatConfigured(selectedTask))?'':'none';
  syncPanelRepeatUnitUI();
}
function savePanelRepeat(){
  if(!selectedTask)return;
  const unit=panelDropdowns.panelRepeatUnitDd?.getValue()||'days';
  const every=Math.max(1,parseInt(document.getElementById('panelRepeatEvery').value,10)||1);
  let weekdays=null;
  if(unit==='weekdays'){
    weekdays=[...document.querySelectorAll('.panel-repeat-wd-cb:checked')].map(cb=>parseInt(cb.value,10)).sort((a,b)=>a-b);
    if(!weekdays.length){showHkHint('Выберите хотя бы один день недели');return}
  }
  const timeVal=normalizeHm(document.getElementById('panelRepeatTime').value);
  const startIso=ruDateToIso(document.getElementById('panelRepeatStart').value);
  const endRaw=document.getElementById('panelRepeatEnd').value.trim();
  const endIso=endRaw?ruDateToIso(endRaw):'';
  if(!startIso){showHkHint('Старт: ДД-ММ-ГГГГ');return}
  if(endRaw&&!endIso){showHkHint('Конец: ДД-ММ-ГГГГ');return}
  if(document.getElementById('panelRepeatTime').value.trim()&&!timeVal){showHkHint('Время: ЧЧ:ММ');return}
  pushHistory();
  const next={every,unit,time:timeVal,start:startIso,end:endIso};
  if(unit==='weekdays')next.weekdays=weekdays;
  selectedTask.repeat=next;
  if(timeVal&&/^\d{2}:\d{2}$/.test(timeVal)){
    const dp=(selectedTask.deadline?.length>=10&&selectedTask.deadline.slice(0,10))||(next.start||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(dp))selectedTask.deadline=`${dp}T${timeVal}`;
  }
  saveStateNoHistory();
  renderBoard();
  fillPanelRepeatUi(selectedTask.repeat);
  setRepeatCaptionUi(selectedTask);
  showHkHint('Регулярность применена');
}
function clearPanelRepeat(){
  if(!selectedTask)return;
  pushHistory();
  clearRepeatAndSpawned(selectedTask.id);
  saveStateNoHistory();
  renderBoard();
  fillPanelRepeatUi(null);
  setRepeatCaptionUi(selectedTask);
  showHkHint('Регулярность удалена');
}
function repeatLabel(r){
  if(!r||!r.every)return'Не задано';
  if(r.unit==='weekdays'&&r.weekdays?.length){
    const names=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const sorted=r.weekdays.slice().sort((a,b)=>(a===0?7:a)-(b===0?7:b));
    const days=sorted.map(d=>names[d]).join(', ');
    let s=r.every===1?`каждую неделю: ${days}`:`каждые ${r.every} нед.: ${days}`;
    if(r.time)s+=` в ${r.time}`;
    if(r.end)s+=` до ${normalizeDateDash(r.end)}`;
    return s;
  }
  const u={days:'дн',weeks:'нед',months:'мес'};
  let s=`каждые ${r.every} ${u[r.unit]||r.unit}`;
  if(r.time)s+=` в ${r.time}`;
  if(r.end)s+=` до ${normalizeDateDash(r.end)}`;
  return s;
}
function syncRepeatModalUnitUI(){
  const unit=document.getElementById('repeatUnit')?.value;
  const row=document.getElementById('repeatWeekdaysRow');
  const lab=document.getElementById('repeatIntervalLabel');
  if(row)row.style.display=unit==='weekdays'?'block':'none';
  if(lab)lab.textContent=unit==='weekdays'?'Каждые N недель':'Интервал';
}
function fillRepeatModal(r){
  r=r||{};
  document.getElementById('repeatEvery').value=r.every||1;
  document.getElementById('repeatUnit').value=r.unit||'days';
  let timePreset=r.time||'';
  if(!timePreset&&selectedTask?.deadline?.includes('T'))
    try{timePreset=selectedTask.deadline.split('T')[1].slice(0,5)}catch(e){}
  document.getElementById('repeatTime').value=timePreset;
  document.getElementById('repeatStart').value=isoDateToRu(r.start||new Date().toISOString().slice(0,10));
  document.getElementById('repeatEnd').value=isoDateToRu(r.end||'');
  document.querySelectorAll('.repeat-wd-cb').forEach(cb=>{
    const v=parseInt(cb.value,10);
    cb.checked=Array.isArray(r.weekdays)&&r.weekdays.includes(v);
  });
  syncRepeatModalUnitUI();
  document.getElementById('repeatModal').classList.add('open');
}
function openRepeatModal(){if(selectedTask)fillRepeatModal(selectedTask.repeat)}
function openRepeatFromMenu(id){closeMenu();selectedTask=findTask(id);if(selectedTask)fillRepeatModal(selectedTask.repeat)}
function closeRepeatModal(){document.getElementById('repeatModal').classList.remove('open')}
function collectSpawnChainIds(rootId){
  const ids=new Set();
  const q=[String(rootId||'')];
  if(!q[0])return ids;
  ids.add(q[0]);
  while(q.length){
    const cur=q.shift();
    state.columns.forEach(c=>{
      [...c.tasks,...c.completed].forEach(t=>{
        if(String(t._spawnedFromTaskId||'')!==cur)return;
        const tid=String(t.id||'');
        if(!tid||ids.has(tid))return;
        ids.add(tid);
        q.push(tid);
      });
    });
  }
  return ids;
}
function removeTasksByIds(ids){
  if(!ids?.size)return;
  state.columns.forEach(c=>{
    c.tasks=c.tasks.filter(t=>!ids.has(String(t.id||'')));
    c.completed=c.completed.filter(t=>!ids.has(String(t.id||'')));
  });
}
function clearRepeatAndSpawned(taskId){
  const t=findTask(taskId);
  if(!t)return false;
  const ids=collectSpawnChainIds(taskId);
  ids.delete(String(taskId));
  t.repeat=null;
  t._spawnedFromTaskId=undefined;
  removeTasksByIds(ids);
  if(selectedTask&&ids.has(String(selectedTask.id||'')))closeTaskPanel();
  return true;
}
function saveRepeat(){
  if(!selectedTask)return;
  const unit=document.getElementById('repeatUnit').value;
  const every=parseInt(document.getElementById('repeatEvery').value,10)||1;
  let weekdays=null;
  if(unit==='weekdays'){
    weekdays=[...document.querySelectorAll('.repeat-wd-cb:checked')].map(cb=>parseInt(cb.value,10)).sort((a,b)=>a-b);
    if(!weekdays.length){showHkHint('Выберите хотя бы один день недели');return}
  }
  pushHistory();
  const timeVal=normalizeHm(document.getElementById('repeatTime').value);
  const startIso=ruDateToIso(document.getElementById('repeatStart').value);
  const endRaw=document.getElementById('repeatEnd').value.trim();
  const endIso=endRaw?ruDateToIso(endRaw):'';
  if(!startIso){showHkHint('Старт: ДД-ММ-ГГГГ');return}
  if(endRaw&&!endIso){showHkHint('Конец: ДД-ММ-ГГГГ');return}
  if(document.getElementById('repeatTime').value.trim()&&!timeVal){showHkHint('Время: ЧЧ:ММ');return}
  const next={every,unit,time:timeVal,start:startIso,end:endIso};
  if(unit==='weekdays')next.weekdays=weekdays;
  selectedTask.repeat=next;
  if(timeVal&&/^\d{2}:\d{2}$/.test(timeVal)){
    const dp=(selectedTask.deadline?.length>=10&&selectedTask.deadline.slice(0,10))||(next.start||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(dp))selectedTask.deadline=`${dp}T${timeVal}`;
  }
  saveStateNoHistory();
  renderBoard();
  setRepeatCaptionUi(selectedTask);
  closeRepeatModal();
}
function clearRepeat(){
  if(!selectedTask)return;
  pushHistory();
  clearRepeatAndSpawned(selectedTask.id);
  saveStateNoHistory();
  renderBoard();
  setRepeatCaptionUi(selectedTask);
  closeRepeatModal();
}

// ─── Column actions ───────────────────────────────────────────────────
window.renameCol=function(id){const c=state.columns.find(c=>c.id===id);closeMenu();showPrompt('Новое название:',c.title,t=>{if(t){pushHistory();c.title=t;saveStateNoHistory();renderBoard()}})}
window.colorCol=function(id,color){pushHistory();state.columns.find(c=>c.id===id).color=color;saveStateNoHistory();renderBoard();closeMenu()}
window.delCol=function(id){closeMenu();if(confirm('Удалить колонку?')){pushHistory();state.columns=state.columns.filter(c=>c.id!==id);saveStateNoHistory();renderBoard()}}
window.sortCol=function(id,by){const c=state.columns.find(c=>c.id===id);if(!c)return;pushHistory();sortColumnTasks(c,by);saveStateNoHistory();renderBoard();closeMenu();showHkHint(sortModeHint(by))}
window.renameTask=function(id){closeMenu();const t=findTask(id);if(!t)return;showPrompt('Новое название:',t.title,v=>{if(v){pushHistory();t.title=v;saveStateNoHistory();renderBoard()}})}
window.colorTask=function(id,color){pushHistory();const t=findTask(id);if(t){t.color=color;saveStateNoHistory();renderBoard()}closeMenu()}
window.delTask=function(id){
  const card=document.querySelector(`.task-card[data-id="${id}"]`);
  const doDelete=()=>{
    pushHistory();
    const ids=collectSpawnChainIds(id);
    removeTasksByIds(ids);
    ids.forEach(tid=>dequeuePomodoroTask(tid));
    const runId=getPomodoroTaskId();
    if(runId&&ids.has(String(runId)))stopPomodoro();
    if(selectedTask&&ids.has(String(selectedTask.id||'')))closeTaskPanel();
    saveStateNoHistory();
    renderBoard();
    renderPomodoro();
    closeMenu();
  };
  if(card){card.classList.add('anim-out');setTimeout(doDelete,200);}else{doDelete();}
}

// ─── Modal ────────────────────────────────────────────────────────────
let modalCb=null;
function showPrompt(title,def,cb){if(typeof def==='function'){cb=def;def=''}modalCb=cb;document.getElementById('modalTitle').textContent=title;document.getElementById('modalInput').value=def||'';document.getElementById('customModal').classList.add('open');setTimeout(()=>document.getElementById('modalInput').focus(),50);document.getElementById('modalInput').onkeydown=e=>{if(e.key==='Enter')modalOk();if(e.key==='Escape')modalCancel()}}
function modalOk(){const v=document.getElementById('modalInput').value.trim();document.getElementById('customModal').classList.remove('open');if(modalCb)modalCb(v||null);modalCb=null}
function modalCancel(){document.getElementById('customModal').classList.remove('open');if(modalCb)modalCb(null);modalCb=null}

// ─── Export / Import ──────────────────────────────────────────────────
function exportProject(){
  const theme=localStorage.getItem('kanban_theme')||'light';
  const data={version:EXPORT_VERSION,exported:new Date().toISOString(),...packPersistPayload(state,theme)};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`kanban-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showHkHint('Экспорт готов');
}
function importProject(file){
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      const check=validateImportPayload(data);
      if(!check.ok){showHkHint(check.error);return}
      pushHistory();
      Object.assign(state,check.state);
      migrateAndNormalizeState(state);
      if(check.theme)applyTheme(check.theme==='dark');
      if(window.electronAPI?.setCloseBehavior)void window.electronAPI.setCloseBehavior(!!state.appSettings?.closeToTray);
      saveStateNoHistory();
      renderBoard();
      renderCalendar();
      renderPomodoro();
      showHkHint('Импорт выполнен');
    }catch{
      showHkHint('Ошибка файла');
    }
    document.getElementById('importFile').value='';
  };
  reader.readAsText(file);
}

// ─── Templates, archive, settings ───────────────────────────────────────
function columnTitleForTaskId(taskId){
  for(const c of state.columns){
    if(c.tasks.some(t=>t.id===taskId)||c.completed.some(t=>t.id===taskId))return c.title;
  }
  return '';
}

function instantiateTemplateTask(taskSnap){
  const t=JSON.parse(JSON.stringify(taskSnap));
  t.id=Date.now().toString()+Math.random().toString(36).slice(2,8);
  t.completed=false;
  t.expanded=false;
  if(Array.isArray(t.subtasks))t.subtasks=t.subtasks.map(s=>({...s,id:Date.now().toString()+Math.random().toString(36).slice(2,8),done:false}));
  return t;
}

function openArchive(){document.getElementById('archiveModal')?.classList.add('open');renderArchiveBody()}
function closeArchive(){document.getElementById('archiveModal')?.classList.remove('open')}
function renderArchiveBody(){
  const b=document.getElementById('archiveBody');if(!b)return;
  b.innerHTML='';
  if(!state.archive?.length){
    const p=document.createElement('p');p.className='modal-empty';p.textContent='Архив пуст. Через меню карточки (⋯) → «В архив».';
    b.appendChild(p);return;
  }
  state.archive.forEach(ent=>{
    const row=document.createElement('div');row.className='archive-row';
    const main=document.createElement('div');main.className='archive-row-main';
    const ti=document.createElement('span');ti.className='archive-title';ti.textContent=ent.task?.title||'Без названия';
    const meta=document.createElement('span');meta.className='archive-meta';
    meta.textContent=new Date(ent.archivedAt).toLocaleString('ru')+(ent.sourceCol?' · '+ent.sourceCol:'');
    main.appendChild(ti);main.appendChild(meta);
    const act=document.createElement('div');act.className='archive-row-actions';
    const br=document.createElement('button');br.type='button';br.className='btn-link';br.textContent='Вернуть';br.onclick=()=>restoreFromArchive(ent.id);
    const bd=document.createElement('button');bd.type='button';bd.className='btn-link danger';bd.textContent='Удалить';bd.onclick=()=>deleteArchiveEntry(ent.id);
    act.appendChild(br);act.appendChild(bd);
    row.appendChild(main);row.appendChild(act);
    b.appendChild(row);
  });
}

function restoreFromArchive(entryId){
  const ix=state.archive.findIndex(x=>x.id===entryId);
  if(ix===-1)return;
  pushHistory();
  const ent=state.archive[ix];
  state.archive.splice(ix,1);
  const t=JSON.parse(JSON.stringify(ent.task));
  t.id=Date.now().toString();
  const target=state.columns.find(c=>c.title===ent.sourceCol)||state.columns.find(c=>c.title==='Бэклог')||state.columns[0];
  if(t.completed)target.completed.unshift(t);else target.tasks.unshift(t);
  saveStateNoHistory();
  run.refreshAll();
  renderArchiveBody();
  updateUndoRedoBtns();
  showHkHint('Задача восстановлена');
}

function deleteArchiveEntry(entryId){
  pushHistory();
  state.archive=state.archive.filter(x=>x.id!==entryId);
  saveStateNoHistory();
  renderArchiveBody();
  updateUndoRedoBtns();
  showHkHint('Удалено из архива');
}

function openTemplates(){document.getElementById('templatesModal')?.classList.add('open');renderTemplatesBody()}
function closeTemplates(){document.getElementById('templatesModal')?.classList.remove('open')}
function renderTemplatesBody(){
  const b=document.getElementById('templatesBody');if(!b)return;
  b.innerHTML='';
  if(!state.taskTemplates?.length){
    const p=document.createElement('p');p.className='modal-empty';p.textContent='Нет шаблонов. Сохраните карточку через ⋯ → «В шаблон…».';
    b.appendChild(p);return;
  }
  state.taskTemplates.forEach(tpl=>{
    const row=document.createElement('div');row.className='tpl-row';
    const nm=document.createElement('div');nm.className='tpl-row-name';nm.textContent=tpl.name||'Без названия';
    const act=document.createElement('div');act.className='tpl-row-actions';
    const add=document.createElement('button');add.type='button';add.className='tpl-btn';add.textContent='Создать задачу';add.onclick=()=>createFromTemplate(tpl.id);
    const del=document.createElement('button');del.type='button';del.className='tpl-btn del';del.textContent='Удалить';del.onclick=()=>deleteTemplate(tpl.id);
    act.appendChild(add);act.appendChild(del);
    row.appendChild(nm);row.appendChild(act);
    b.appendChild(row);
  });
}

function createFromTemplate(templateId){
  const tpl=state.taskTemplates.find(x=>x.id===templateId);
  if(!tpl||!tpl.task)return;
  pushHistory();
  ensureFocusedColumn();
  const col=state.columns.find(c=>c.id===state.focusedColumnId)||state.columns[0];
  col.tasks.unshift(instantiateTemplateTask(tpl.task));
  saveStateNoHistory();
  run.refreshAll();
  closeTemplates();
  switchView('board');
  showHkHint('Задача из шаблона');
}

function deleteTemplate(templateId){
  if(!confirm('Удалить шаблон?'))return;
  pushHistory();
  state.taskTemplates=state.taskTemplates.filter(x=>x.id!==templateId);
  saveStateNoHistory();
  renderTemplatesBody();
  updateUndoRedoBtns();
}

function moveTaskToArchive(id){
  closeMenu();
  const t=findTask(id);if(!t)return;
  pushHistory();
  const sourceCol=columnTitleForTaskId(id);
  state.columns.forEach(c=>{
    c.tasks=c.tasks.filter(x=>x.id!==id);
    c.completed=c.completed.filter(x=>x.id!==id);
  });
  if(selectedTask?.id===id)closeTaskPanel();
  dequeuePomodoroTask(id);
  if(getPomodoroTaskId()===id)stopPomodoro();
  state.archive.unshift({
    id:Date.now().toString(),
    archivedAt:new Date().toISOString(),
    task:JSON.parse(JSON.stringify(t)),
    sourceCol:sourceCol
  });
  saveStateNoHistory();
  run.refreshAll();
  showHkHint('В архиве');
}

function saveTaskAsTemplate(id){
  closeMenu();
  const t=findTask(id);if(!t)return;
  showPrompt('Название шаблона:',t.title,name=>{
    if(!name)return;
    pushHistory();
    const taskCopy=JSON.parse(JSON.stringify(t));
    delete taskCopy.id;
    state.taskTemplates.push({id:Date.now().toString(),name:name.trim(),task:taskCopy});
    saveStateNoHistory();
    showHkHint('Шаблон сохранён');
  });
}

function openSettings(){
  const s=state.appSettings;
  void window.__kanbanCloud?.populateCloudSettingsFields();
  const tray=document.getElementById('setCloseTray');if(tray)tray.checked=s.closeToTray!==false;
  const flash=document.getElementById('setSaveFlash');if(flash)flash.checked=s.showSaveFlash!==false;
  const cf=document.getElementById('setCalBoardFilt');if(cf)cf.checked=s.calendarUseBoardFilters!==false;
  const ps=document.getElementById('setPomShort');if(ps)ps.value=String(s.pomShortBreakMin??5);
  const pl=document.getElementById('setPomLong');if(pl)pl.value=String(s.pomLongBreakMin??15);
  const pe=document.getElementById('setPomEvery');if(pe)pe.value=String(s.pomLongBreakEvery??4);
  const pab=document.getElementById('setPomAutoBreak');if(pab)pab.checked=!!s.pomAutoStartBreak;
  const pan=document.getElementById('setPomAutoNext');if(pan)pan.checked=!!s.pomAutoStartNext;
  const pbf=document.getElementById('setPomBoardFilt');if(pbf)pbf.checked=s.pomUseBoardFilters!==false;
  document.getElementById('settingsModal')?.classList.add('open');
}
function closeSettings(){document.getElementById('settingsModal')?.classList.remove('open')}
function applySettings(){
  if(!state.appSettings)state.appSettings={};
  state.appSettings.closeToTray=!!document.getElementById('setCloseTray')?.checked;
  state.appSettings.showSaveFlash=!!document.getElementById('setSaveFlash')?.checked;
  state.appSettings.calendarUseBoardFilters=!!document.getElementById('setCalBoardFilt')?.checked;
  state.appSettings.pomShortBreakMin=parseInt(document.getElementById('setPomShort')?.value,10)||5;
  state.appSettings.pomLongBreakMin=parseInt(document.getElementById('setPomLong')?.value,10)||15;
  state.appSettings.pomLongBreakEvery=parseInt(document.getElementById('setPomEvery')?.value,10)||4;
  state.appSettings.pomAutoStartBreak=!!document.getElementById('setPomAutoBreak')?.checked;
  state.appSettings.pomAutoStartNext=!!document.getElementById('setPomAutoNext')?.checked;
  state.appSettings.pomUseBoardFilters=!!document.getElementById('setPomBoardFilt')?.checked;
  state.appSettings.cloudAutoSync=window.__kanbanCloud?.readCloudAutoSyncFromForm?.() ?? !!document.getElementById('setCloudAutoSync')?.checked;
  saveStateNoHistory();
  if(window.electronAPI?.setCloseBehavior)void window.electronAPI.setCloseBehavior(!!state.appSettings.closeToTray);
  closeSettings();
  run.refreshAll();
  showHkHint('Настройки сохранены');
}

Object.assign(window,{
  undo,redo,toggleTheme,openRegistry,closeRegistry,closeTaskPanel,collapseTaskPanel,openRepeatModal,exportProject,
  modalOk,modalCancel,setCalView,closeRepeatModal,clearRepeat,saveRepeat,openPanel,expandSubtasksBlock,calNav,
  openArchive,closeArchive,openTemplates,closeTemplates,openSettings,closeSettings,applySettings,
  moveTaskToArchive,saveTaskAsTemplate,openColumnStyleModal,closeColumnStyleModal,applyColumnStyle,launchPomodoroForTask
});
