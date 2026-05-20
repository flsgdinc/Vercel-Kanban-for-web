import { dequeuePomodoroTask } from './pomodoro-queue.js';

let stopTimer = null;
let getActiveTaskId = null;

export function registerPomodoroTimerHooks(stop, getTaskId) {
  stopTimer = stop;
  getActiveTaskId = getTaskId;
}

export function onTaskRemovedFromActive(id) {
  dequeuePomodoroTask(id);
  if (getActiveTaskId?.() === id) stopTimer?.();
}
