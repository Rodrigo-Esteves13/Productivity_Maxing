// viewBox fixo em largura: os traços guardados na BD ficam sempre nestas
// coordenadas, independentemente do tamanho do ecrã em que foram
// desenhados - o SVG escala visualmente via width/height CSS, mas as
// coordenadas internas (e portanto o que vai para a API) nunca mudam com
// o viewport. A altura é que é variável por entrada (NotebookEntry.canvasHeight).
export const VIEW_WIDTH = 800;
export const DEFAULT_VIEW_HEIGHT = 500;
export const MAX_VIEW_HEIGHT = 4000;
export const GROW_STEP = 400;

// Preto/cinza-escuro primeiro (é o que a maioria usa por default num
// papel real), depois um punhado de cores para destacar - o canvas é
// propositadamente uma superfície à parte do tema escuro da app.
export const COLOR_SWATCHES = [
  '#1C1C1E', // preto
  '#44403C', // cinza-escuro
  '#B91C1C', // vermelho
  '#1D4ED8', // azul
  '#15803D', // verde
  '#B45309', // laranja/castanho
  '#7C3AED', // violeta (accent da app)
] as const;

// Cor do "papel" do canvas; as legendas das ligações usam-na como contorno.
export const CANVAS_PAPER_COLOR = '#F5F1E8';

export type DrawTool = 'pen' | 'eraser' | 'text';
