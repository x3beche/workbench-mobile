/**
 * Where a name has to stand over a line.
 *
 * Who wrote a line is told by the side it sits on: the reader's own on the
 * right, everyone else's on the left. That is enough while there is one other
 * voice - but a room has its agent and may have a second person in it, and a
 * conversation's answers can come from another model once someone switches.
 * Then the side no longer says who, and the first line of each change of
 * author says it: nothing over the lines that follow.
 */
export function authorHeads(
  names: (string | null | undefined)[],
  mine: boolean[],
): (string | null)[] {
  const others = new Set<string>();
  names.forEach((n, i) => {
    if (n && !mine[i]) others.add(n);
  });
  return names.map((n, i) => {
    if (!n || mine[i]) return null;
    // A name is only worth its ink when there is more than one other voice in
    // the thread, and only where the voice changes.
    if (others.size < 2) return null;
    return i === 0 || names[i - 1] !== n ? n : null;
  });
}
