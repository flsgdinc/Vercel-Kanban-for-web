/** Связь между модулями без циклических импортов — выставляется при init. */
export const run = {
  /** @type {() => void} */
  renderBoard: () => {},
  /** @type {() => void} */
  renderCalendar: () => {},
  /** @type {() => void} */
  renderPomodoro: () => {},
  /** @type {() => void} */
  refreshAll: () => {},
  /** @type {(msg: string) => void} */
  showHkHint: () => {},
  /** @type {() => void} */
  showSaveFlash: () => {}
};

export function wireRuntime(partial) {
  Object.assign(run, partial);
  run.refreshAll = () => {
    run.renderBoard();
    run.renderCalendar();
    run.renderPomodoro();
  };
}
