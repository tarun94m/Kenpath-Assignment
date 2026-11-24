// Compare what the vision model read with the application form. Flags are hints; the officer confirms every photo.
const norm = (x) => String(x || '').replace(/\s+/g, '').toLowerCase();
const KN = /[\u0C80-\u0CFF]/; // names are compared only when both are Kannada; otherwise the officer judges from the shown text

export function compareDocument(a, kind, read) {
  if (!read) return null;
  const flags = [];
  if (read.name && KN.test(read.name) && KN.test(a.name) && !norm(a.name).includes(norm(read.name)) && !norm(read.name).includes(norm(a.name))) flags.push('name');
  if (kind === 'a' && read.birth_year && Math.abs(new Date().getFullYear() - read.birth_year - a.age) > 1) flags.push('age');
  return { name: read.name ?? null, birth_year: read.birth_year ?? null, flags };
}
