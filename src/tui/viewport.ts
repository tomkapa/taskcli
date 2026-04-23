/** Returns the index of the first visible item given a cursor position and window size. */
export function calcViewStart(cursorIndex: number, maxVisible: number): number {
  let viewStart = 0;
  if (cursorIndex >= viewStart + maxVisible) {
    viewStart = cursorIndex - maxVisible + 1;
  }
  if (cursorIndex < viewStart) {
    viewStart = cursorIndex;
  }
  return viewStart;
}
