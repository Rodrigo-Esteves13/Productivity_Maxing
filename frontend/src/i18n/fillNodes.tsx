import { Fragment, type ReactNode } from 'react';

// Para textos traduzidos com partes ricas (negrito, ligacao): o dicionario
// guarda "... {email} ..." e aqui cada {nome} e trocado pelo no React dado.
// Marcador sem no correspondente fica literal, como no t().
export function fillNodes(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    const node = m ? nodes[m[1]] : undefined;
    return <Fragment key={i}>{m && node !== undefined ? node : part}</Fragment>;
  });
}
