// Liga o nome de uma aula do horario (vem do .ics, escrito pela faculdade)
// ao nome de uma cadeira escrito a mao. Mesma regra do backend
// (notebook.service matchesAreaName): sem acentos, minusculas, sem
// pontuacao, e um pode conter o outro ("Redes III" casa com "Redes III - TP").

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesAreaName(subject: string, areaName: string): boolean {
  const a = normalizeName(subject);
  const b = normalizeName(areaName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
