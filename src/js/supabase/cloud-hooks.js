let scheduleAutoSyncFn = null;
let touchLocalSaveFn = null;

export function registerCloudPersistHooks({ scheduleAutoSync, touchLocalSave }) {
  scheduleAutoSyncFn = scheduleAutoSync;
  touchLocalSaveFn = touchLocalSave;
}

export function scheduleCloudAutoSync() {
  scheduleAutoSyncFn?.();
}

export function touchLocalSaveMeta() {
  touchLocalSaveFn?.();
}
