// Alguns URLs carregam um segredo no próprio caminho (o link do feed .ics:
// /feed/<token>.ics). Estes URLs vão parar a logs de pedidos e à tabela
// SecurityLog - nunca devem guardar o token em claro, senão quem lê os logs
// (ou um dump da BD) leria o horário de toda a gente.
// O mesmo para o token de um link de partilha de nota (quem o tem le a nota
// em modo Public) e para o codigo de um pacote de tarefas. "with-me" e uma
// rota literal, nao um token, e fica como esta.
const SECRET_PATH_PATTERNS: RegExp[] = [
  /^(\/feed\/)[^/?#]+/,
  /^(\/notebook\/shared\/)(?!with-me(?:[/?#]|$))[^/?#]+/,
  /^(\/task-packs\/code\/)[^/?#]+/,
];

export function redactSecretPath(url: string): string {
  let result = url;
  for (const pattern of SECRET_PATH_PATTERNS) {
    result = result.replace(pattern, '$1[redacted]');
  }
  return result;
}
