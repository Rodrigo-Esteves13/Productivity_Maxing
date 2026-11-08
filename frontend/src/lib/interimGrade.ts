// Mesma regra do backend (roundInterimGrade em grade-average.util.ts): com a
// opcao roundInterimGrades do programa, cada nota real lancada conta
// arredondada ao inteiro (15.5 conta como 16). Sem a opcao, fica igual.
export function roundInterimGrade(grade: number, roundInterimGrades: boolean): number {
  return roundInterimGrades ? Math.round(grade) : grade;
}
