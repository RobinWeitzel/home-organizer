import { load, save } from './persistence';
import { useApp } from './store';

const SAVE_DEBOUNCE_MS = 300;

export function initPersistence() {
  useApp.getState().loadData(load());
  let timer: ReturnType<typeof setTimeout> | undefined;
  useApp.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ok = save(useApp.getState().data);
      if (ok === useApp.getState().persistenceError) {
        useApp.getState().setPersistenceError(!ok);
      }
    }, SAVE_DEBOUNCE_MS);
  });
}
