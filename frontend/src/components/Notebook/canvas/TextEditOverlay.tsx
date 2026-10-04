import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT_SIZE } from '../../../hooks/useCanvasTexts';
import { VIEW_WIDTH } from './canvasConstants';

const OVERLAY_WIDTH = 220;

interface TextEditOverlayProps {
  item: { x: number; y: number; text: string; fontSize?: number; color?: string };
  svgRef: RefObject<SVGSVGElement | null>;
  onChangeText: (text: string) => void;
  onCommit: () => void;
}

// Um <input> HTML normal posicionado por cima do <svg> via CSS, não um
// <input> dentro de <foreignObject> - essa via não estava a aparecer de
// todo nalguns browsers, um overlay comum é muito mais previsível.
// Segue as coordenadas do viewBox fixo através do mesmo fator de escala
// que toSvgPoint usa ao contrário. O tamanho/cor escolhidos refletem-se
// ao vivo aqui, para o que se vê a escrever já bater certo com o que
// fica depois de gravado.
export default function TextEditOverlay({ item, svgRef, onChangeText, onCommit }: TextEditOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rect = svgRef.current?.getBoundingClientRect();
  const scale = rect ? rect.width / VIEW_WIDTH : 1;
  const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  const color = item.color ?? DEFAULT_TEXT_COLOR;

  // useEffect corre sempre depois do <input> estar montado no DOM, ao
  // contrário de autoFocus cujo timing exato pode competir com o foco por
  // omissão do browser no <svg> (tabIndex) - era essa corrida que fazia a
  // caixa falhar de vez em quando. preventScroll: o <input> fica sobre um
  // ponto do svg que pode estar fora da vista atual.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <input
      ref={inputRef}
      value={item.text}
      onChange={(e) => onChangeText(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        // Não deixa o Delete/Backspace/Escape enquanto se escreve aqui
        // chegarem ao handler de teclado do canvas (que apagaria a
        // forma/ligação selecionada) - aqui servem só para editar texto.
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.currentTarget.blur();
        }
      }}
      placeholder="Type..."
      style={{
        position: 'absolute',
        left: item.x * scale,
        top: item.y * scale,
        width: OVERLAY_WIDTH * scale,
        fontSize: fontSize * scale,
        color,
        lineHeight: 1.3,
      }}
      className="rounded border border-violet-500 bg-white/95 px-1.5 py-1 outline-none"
    />
  );
}
