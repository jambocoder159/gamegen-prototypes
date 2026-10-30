// Delegate only browser gesture defaults; clicks, keyboard input and game drags
// keep reaching their existing handlers. Reading text and editors are exempt.
export function guardGameSelection(surface: string, reading: string) {
  const root = document.getElementById('root');
  if (!root) return;
  const controls = 'button, .lr-catalog, [role="button"], canvas, img';
  const guard = (event: Event) => {
    const target = event.target instanceof Element ? event.target : (event.target as Node)?.parentElement;
    if (!target || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    const control = target.closest(controls);
    if (!control && target.closest(reading)) return;
    if (control || target.closest(surface)) event.preventDefault();
  };
  for (const type of ['selectstart', 'dblclick', 'contextmenu', 'dragstart']) {
    root.addEventListener(type, guard, { capture: true });
  }
}
