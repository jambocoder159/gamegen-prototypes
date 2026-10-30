import { SAVE_KEY, serialize, type Run } from "./logic";

/** Write immediately; catalog navigation must bypass the autosave interval. */
export function persistRun(run: Run) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(run));
  } catch {
    /* Storage may be unavailable, as with the regular autosave. */
  }
}
