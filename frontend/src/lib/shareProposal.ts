import type { ChangeProposal } from '../types/models';

// O que uma proposta de um editor muda face ao rascunho atual.
export function proposalChanges(payload: ChangeProposal['payload'], currentTitle: string, currentText: string) {
  const { title, textContent } = payload;
  const delta = textContent !== undefined ? textContent.length - currentText.length : 0;
  return {
    titleChanged: title !== undefined && title !== currentTitle,
    textChanged: textContent !== undefined && textContent !== currentText,
    // Diferenca em caracteres, com sinal.
    delta: `${delta >= 0 ? '+' : ''}${delta}`,
  };
}
