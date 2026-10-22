import { useEffect } from 'react';

// Contador partilhado: dois overlays abertos ao mesmo tempo (ex.: foto
// ampliada dentro do modo foco) so devolvem o scroll quando o ultimo fecha.
let lockCount = 0;
let previousHtmlOverflow = '';
let previousBodyOverflow = '';

// O index.css poe overflow-x: hidden no html E no body, por isso o scroller da
// pagina e o <html>, nao o <body>. Bloquear so o body deixava a pagina rolar
// por tras de overlays em ecra inteiro.
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const { body } = document;
    if (lockCount === 0) {
      previousHtmlOverflow = html.style.overflow;
      previousBodyOverflow = body.style.overflow;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        html.style.overflow = previousHtmlOverflow;
        body.style.overflow = previousBodyOverflow;
      }
    };
  }, [active]);
}
