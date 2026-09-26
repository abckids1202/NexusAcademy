export function parseParticipantNames(input: string): { names: string[]; duplicateCount: number } {
  const seen = new Set<string>();
  const names: string[] = [];
  let duplicateCount = 0;

  for (const rawName of input.split(/\r?\n/)) {
    const name = rawName.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    names.push(name);
  }

  return { names, duplicateCount };
}
