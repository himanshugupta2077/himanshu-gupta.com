export function sortByDate<T extends { data: { date: Date } }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function filterDrafts<T extends { data: { draft?: boolean } }>(entries: T[]): T[] {
  return entries.filter(entry => !entry.data.draft);
}
