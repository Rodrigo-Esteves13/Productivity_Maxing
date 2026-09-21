import type { CanvasShapeType } from '../../types/models';

interface CanvasShapeIconProps {
  type: CanvasShapeType;
  stroke: string;
}

// Cada ícone é desenhado num espaço normalizado 0-100 x 0-100 e depois
// escalado/posicionado pelo <g transform> do chamador (NotebookShapeNode)
// para caber exatamente dentro da caixa da forma - esse mesmo <g> aplica
// um clip-path ao contorno da forma (círculo ou retângulo arredondado),
// por isso um ícone pode "sangrar" ligeiramente para fora do espaço
// 0-100 (caso do firewall abaixo) sem nunca vazar visualmente para fora
// da caixa. Não são réplicas pixel-a-pixel dos ícones oficiais Cisco
// (isso é propriedade da Cisco), só a mesma ideia visual simplificada:
// duas setas opostas para router/switch (troca de pacotes/frames),
// parede de tijolo para firewall, "rack" com LEDs para server,
// monitor+suporte para PC, nuvem para cloud, ondas de sinal para AP. A
// nuvem usa o traçado do ícone "Cloud" da lucide (MIT), já usada no
// resto da app via lucide-react, só reescalada para este espaço 0-100.
export default function NotebookShapeIcon({ type, stroke }: CanvasShapeIconProps) {
  switch (type) {
    case 'router':
      // Cisco desenha isto como 4 setas curvas a irradiar do centro, não
      // como um loop - aqui simplificado para duas setas retas na
      // diagonal, cruzadas no meio, com ponta em cada um dos 4 cantos
      // (o pedido explícito: "setas que se intersectam na diagonal").
      return (
        <g stroke={stroke} strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 22 22 L 78 78" />
          <path d="M 78 22 L 22 78" />
          <path d="M 34 26 L 22 22 L 26 34" />
          <path d="M 66 74 L 78 78 L 74 66" />
          <path d="M 66 26 L 78 22 L 74 34" />
          <path d="M 34 74 L 22 78 L 26 66" />
        </g>
      );
    case 'switch':
      return (
        <g stroke={stroke} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 13 35 H 73" />
          <path d="M 63 26 L 76 35 L 63 44" />
          <path d="M 87 65 H 27" />
          <path d="M 37 56 L 24 65 L 37 74" />
        </g>
      );
    case 'firewall':
      return (
        <g fill={stroke}>
          {/* 4 filas alternadas, meio-tijolo desfasado - as filas B
              saem propositadamente fora de 0-100 (clipadas pela forma,
              ver NotebookShapeNode) em vez de encolher os tijolos das
              pontas, o que ficaria com larguras inconsistentes. */}
          <rect x={4} y={4} width={30} height={19} rx={1.5} />
          <rect x={37} y={4} width={30} height={19} rx={1.5} />
          <rect x={70} y={4} width={30} height={19} rx={1.5} />
          <rect x={-12.5} y={27} width={30} height={19} rx={1.5} />
          <rect x={20.5} y={27} width={30} height={19} rx={1.5} />
          <rect x={53.5} y={27} width={30} height={19} rx={1.5} />
          <rect x={86.5} y={27} width={30} height={19} rx={1.5} />
          <rect x={4} y={50} width={30} height={19} rx={1.5} />
          <rect x={37} y={50} width={30} height={19} rx={1.5} />
          <rect x={70} y={50} width={30} height={19} rx={1.5} />
          <rect x={-12.5} y={73} width={30} height={19} rx={1.5} />
          <rect x={20.5} y={73} width={30} height={19} rx={1.5} />
          <rect x={53.5} y={73} width={30} height={19} rx={1.5} />
          <rect x={86.5} y={73} width={30} height={19} rx={1.5} />
        </g>
      );
    case 'server':
      return (
        <g stroke={stroke} strokeWidth={3.5} fill="none" strokeLinejoin="round">
          <rect x={14} y={12} width={72} height={20} rx={2} />
          <circle cx={78} cy={22} r={2.6} fill={stroke} stroke="none" />
          <rect x={14} y={40} width={72} height={20} rx={2} />
          <circle cx={78} cy={50} r={2.6} fill={stroke} stroke="none" />
          <rect x={14} y={68} width={72} height={20} rx={2} />
          <circle cx={78} cy={78} r={2.6} fill={stroke} stroke="none" />
        </g>
      );
    case 'pc':
      return (
        <g stroke={stroke} strokeWidth={4.5} fill="none" strokeLinejoin="round">
          <rect x={12} y={10} width={76} height={52} rx={3} />
          <path d="M 40 62 L 36 76 M 60 62 L 64 76" strokeLinecap="round" />
          <path d="M 28 76 H 72" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    case 'cloud':
      return (
        <g transform="translate(4 0) scale(3.8)">
          <path
            d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
            fill="none"
            stroke={stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    case 'ap':
      return (
        <g stroke={stroke} strokeWidth={4.5} fill="none" strokeLinecap="round">
          <circle cx={50} cy={72} r={7} fill={stroke} stroke="none" />
          <path d="M 32 55 A 26 26 0 0 1 68 55" />
          <path d="M 20 39 A 42 42 0 0 1 80 39" />
        </g>
      );
    default:
      return null;
  }
}
