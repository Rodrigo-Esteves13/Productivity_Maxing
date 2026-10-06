// Ecra inteiro (modo foco). Tem de ser pedido dentro de um clique; se o
// browser recusar, o modo foco funciona na mesma, so que dentro da janela.
export function enterFullscreen(): void {
  void document.documentElement.requestFullscreen?.().catch(() => {});
}

export function exitFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
}
