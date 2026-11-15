import { memo, useId, useMemo } from 'react';
import type {
  DiagramArrow,
  DiagramLineStyle,
  DiagramNode,
  DiagramNodeKind,
  DiagramTextSize,
  DiagramTone,
  DiagramWeight,
  QuizDiagram as QuizDiagramData,
} from '../../lib/quizDiagram';

// Desenha um QuizDiagram (so dados) com elementos React: nenhum texto da IA vira
// markup, atributo ou estilo. Cores so por classes Tailwind (inteiras, para o
// Tailwind as encontrar). Sem verde. O fundo do contentor e neutral-950.

// ---- cores por tom (classes completas) ----
const TONE_STROKE: Record<DiagramTone, string> = {
  default: 'stroke-neutral-500',
  muted: 'stroke-neutral-400',
  accent: 'stroke-violet-400',
  blue: 'stroke-sky-400',
  purple: 'stroke-purple-400',
  red: 'stroke-red-400',
  amber: 'stroke-amber-400',
};
const TONE_FILL: Record<DiagramTone, string> = {
  default: 'fill-neutral-200',
  muted: 'fill-neutral-400',
  accent: 'fill-violet-400',
  blue: 'fill-sky-400',
  purple: 'fill-purple-400',
  red: 'fill-red-400',
  amber: 'fill-amber-400',
};
// Setas: o tom "default" usa o mesmo cinzento das linhas.
const ARROW_FILL: Record<DiagramTone, string> = { ...TONE_FILL, default: 'fill-neutral-500' };
const FILL_BODY = 'fill-neutral-800';
const FILL_BODY_TOP = 'fill-neutral-700';
const FILL_PLATE = 'fill-neutral-950';
const FILL_DETAIL = 'fill-neutral-500';
const STROKE_DETAIL = 'stroke-neutral-200';
const STROKE_PLATE = 'stroke-neutral-950';
const FILL_TEXT = 'fill-neutral-200';
const FILL_SUB = 'fill-neutral-400';
const STROKE_HIGHLIGHT = 'stroke-violet-400';

// Um dispositivo com tom "default" ganha a cor tipica do seu tipo (como no quiz de referencia).
const KIND_DEFAULT_TONE: Record<DiagramNodeKind, DiagramTone> = {
  router: 'blue',
  switch: 'amber',
  pc: 'muted',
  server: 'purple',
  cloud: 'muted',
  firewall: 'red',
  box: 'default',
  pill: 'default',
  circle: 'default',
  dot: 'muted',
  packet: 'amber',
  cross: 'red',
};

// ---- ligacoes ----
const LINE_DASH: Record<DiagramLineStyle, string | undefined> = { solid: undefined, dashed: '6 4', dotted: '2 4' };
const LINE_WIDTH: Record<DiagramWeight, number> = { thin: 1, normal: 2, thick: 3.5 };
const ARROW_SIZE = 12;
const ARROW_VIEWBOX = 10;
const ARROW_PATH = 'M0,0 L10,5 L0,10 z';
const ARROW_GAP = 2;
const LINK_LABEL_FONT = 10.5;
const LINK_LABEL_CHAR_W = 6.4;
const LINK_LABEL_PAD = 14;
const LINK_LABEL_H = 18;
const LINK_LABEL_BASELINE = 3.5;
const LINK_LABEL_STROKE = 1;
const BEZIER_MID = { p0: 0.25, c: 0.5, p2: 0.25 };

// ---- texto ----
const TEXT_SIZE: Record<DiagramTextSize, number> = { sm: 10.5, md: 12, lg: 15 };
const DEVICE_LABEL_FONT = 12;
const DEVICE_SUB_FONT = 10.5;
const DEVICE_LABEL_CHAR_W = 7.2;
const DEVICE_SUB_CHAR_W = 6.4;
const LABEL_GAP = 15;
const SUB_GAP = 14;
const INSIDE_BASELINE = 4;
const INSIDE_LABEL_BASELINE_WITH_SUB = -2;
const INSIDE_SUB_BASELINE = 12;

// ---- formas ----
const OUTLINE_WIDTH = 1.5;
const DETAIL_WIDTH = 1.5;
const HIGHLIGHT_WIDTH = 3;
const HIGHLIGHT_PAD = 5;
const BOX_MIN_W = 70;
const BOX_H = 36;
const BOX_H_SUB = 46;
const BOX_PAD_X = 14;
const BOX_RADIUS = 8;
const CIRCLE_MIN_R = 22;
const CIRCLE_MIN_R_SUB = 28;
const CIRCLE_PAD = 8;
const PILL_H = 22;
const PILL_PAD_X = 10;
const DOT_R = 5;
const CROSS_HALF = 10;
const CROSS_WIDTH = 3;
const PACKET_HW = 13;
const PACKET_HH = 8;
const AREA_RADIUS = 6;
const AREA_DASH = '3 3';
const AREA_LABEL_FONT = 11;
const AREA_LABEL_PAD_X = 8;
const AREA_LABEL_PAD_Y = 8;
const AREA_WIDTH = 1;
const CLOUD_PATH = 'M-30,10 a14,14 0 0 1 2,-27 a18,18 0 0 1 32,-6 a15,15 0 0 1 26,12 a12,12 0 0 1 -2,21 z';
const CLOUD_SHIFT_Y = 11;
const ROUTER_BODY = 'M-26,-6 v12 a26,9 0 0 0 52,0 v-12';
const ROUTER_ARROWS = 'M-10,-9 l6,3 M10,-3 l-6,-3 M-4,-11 l-6,2 M4,-1 l6,-2';
const SWITCH_ARROWS = 'M-16,-4 h20 l-4,-3 M16,4 h-20 l4,3';
const FIREWALL_BRICKS = 'M-24,-5 H24 M-24,5 H24 M0,-16 V-5 M-12,-5 V5 M12,-5 V5 M0,5 V16';
const FIREWALL_BRICK_WIDTH = 1.2;
const PACKET_FLAP = 'M-13,-8 l13,9 l13,-9';
const PACKET_FLAP_WIDTH = 1.3;

// Meia largura e meia altura de cada dispositivo (para ligacoes, setas e destaque).
const DEVICE_HALF: Partial<Record<DiagramNodeKind, { hw: number; hh: number }>> = {
  router: { hw: 26, hh: 15 },
  switch: { hw: 28, hh: 12 },
  pc: { hw: 16, hh: 15 },
  server: { hw: 18, hh: 22 },
  cloud: { hw: 42, hh: 22 },
  firewall: { hw: 24, hh: 16 },
  dot: { hw: DOT_R, hh: DOT_R },
  packet: { hw: PACKET_HW, hh: PACKET_HH },
  cross: { hw: CROSS_HALF, hh: CROSS_HALF },
};

interface Geom {
  hw: number;
  hh: number;
  labelY: number;
  subY: number;
}

const textWidth = (text: string, charW: number) => text.length * charW;
const num = (n: number) => Math.round(n * 10) / 10;

function nodeGeom(n: DiagramNode): Geom {
  const hasSub = n.sub !== '';
  const textW = Math.max(textWidth(n.label, DEVICE_LABEL_CHAR_W), textWidth(n.sub, DEVICE_SUB_CHAR_W));
  if (n.kind === 'box') {
    const hh = (hasSub ? BOX_H_SUB : BOX_H) / 2;
    return { hw: Math.max(BOX_MIN_W / 2, textW / 2 + BOX_PAD_X), hh, labelY: hasSub ? INSIDE_LABEL_BASELINE_WITH_SUB : INSIDE_BASELINE, subY: INSIDE_SUB_BASELINE };
  }
  if (n.kind === 'circle') {
    const r = Math.max(hasSub ? CIRCLE_MIN_R_SUB : CIRCLE_MIN_R, textW / 2 + CIRCLE_PAD);
    return { hw: r, hh: r, labelY: hasSub ? INSIDE_LABEL_BASELINE_WITH_SUB : INSIDE_BASELINE, subY: INSIDE_SUB_BASELINE };
  }
  if (n.kind === 'pill') {
    const hh = PILL_H / 2;
    return { hw: textWidth(n.label, LINK_LABEL_CHAR_W) / 2 + PILL_PAD_X, hh, labelY: LINK_LABEL_BASELINE, subY: hh + SUB_GAP };
  }
  const half = DEVICE_HALF[n.kind] ?? { hw: DOT_R, hh: DOT_R };
  if (n.kind === 'cloud') return { ...half, labelY: INSIDE_BASELINE, subY: half.hh + SUB_GAP };
  return { ...half, labelY: half.hh + LABEL_GAP, subY: half.hh + LABEL_GAP + SUB_GAP };
}

// Distancia do centro ate a borda do retangulo na direcao (ux, uy).
function edgeDistance(g: Geom, ux: number, uy: number): number {
  const tx = Math.abs(ux) > 1e-6 ? g.hw / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? g.hh / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}

interface LinkGeom {
  path: string;
  mid: { x: number; y: number };
}

function linkGeom(a: DiagramNode, b: DiagramNode, ga: Geom, gb: Geom, bend: number, arrow: DiagramArrow): LinkGeom {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Normal a esquerda do sentido a -> b (no ecra, y cresce para baixo).
  const cx = (a.x + b.x) / 2 + (dy / len) * bend;
  const cy = (a.y + b.y) / 2 - (dx / len) * bend;
  // A ponta da seta fica na borda do no; sem seta a linha vai ate ao centro (por baixo do corpo).
  const trim = (from: DiagramNode, g: Geom, on: boolean) => {
    const vx = cx - from.x;
    const vy = cy - from.y;
    const vl = Math.hypot(vx, vy) || 1;
    if (!on) return { x: from.x, y: from.y };
    const d = edgeDistance(g, vx / vl, vy / vl) + ARROW_GAP;
    return { x: from.x + (vx / vl) * d, y: from.y + (vy / vl) * d };
  };
  const p0 = trim(a, ga, arrow === 'both');
  const p2 = trim(b, gb, arrow !== 'none');
  const path = bend === 0 ? `M${num(p0.x)} ${num(p0.y)} L${num(p2.x)} ${num(p2.y)}` : `M${num(p0.x)} ${num(p0.y)} Q${num(cx)} ${num(cy)} ${num(p2.x)} ${num(p2.y)}`;
  const mid = { x: BEZIER_MID.p0 * a.x + BEZIER_MID.c * cx + BEZIER_MID.p2 * b.x, y: BEZIER_MID.p0 * a.y + BEZIER_MID.c * cy + BEZIER_MID.p2 * b.y };
  return { path, mid };
}

// ---- pecas ----
function NodeIcon({ node, tone }: { node: DiagramNode; tone: DiagramTone }) {
  const stroke = TONE_STROKE[tone];
  const g = nodeGeom(node);
  switch (node.kind) {
    case 'router':
      return (
        <>
          <path d={ROUTER_BODY} className={`${FILL_BODY} ${stroke}`} strokeWidth={OUTLINE_WIDTH} />
          <ellipse cx={0} cy={-6} rx={26} ry={9} className={`${FILL_BODY_TOP} ${stroke}`} strokeWidth={OUTLINE_WIDTH} />
          <path d={ROUTER_ARROWS} fill="none" className={STROKE_DETAIL} strokeWidth={1.6} strokeLinecap="round" />
        </>
      );
    case 'switch':
      return (
        <>
          <rect x={-28} y={-12} width={56} height={24} rx={4} className={`${FILL_BODY} ${stroke}`} strokeWidth={OUTLINE_WIDTH} />
          <path d={SWITCH_ARROWS} fill="none" className={STROKE_DETAIL} strokeWidth={DETAIL_WIDTH} />
        </>
      );
    case 'pc':
      return (
        <>
          <rect x={-16} y={-14} width={32} height={22} rx={2} className={`${FILL_BODY} ${stroke}`} strokeWidth={1.4} />
          <rect x={-6} y={8} width={12} height={4} className={FILL_DETAIL} />
          <rect x={-12} y={12} width={24} height={3} rx={1} className={FILL_DETAIL} />
        </>
      );
    case 'server':
      return (
        <>
          <rect x={-18} y={-22} width={36} height={44} rx={3} className={`${FILL_BODY} ${stroke}`} strokeWidth={OUTLINE_WIDTH} />
          {[-14, -2, 10].map((y) => (
            <g key={y}>
              <rect x={-13} y={y} width={26} height={8} rx={1.5} className={FILL_BODY_TOP} />
              <circle cx={9} cy={y + 4} r={1.5} className={TONE_FILL[tone]} />
            </g>
          ))}
        </>
      );
    case 'cloud':
      return <path d={CLOUD_PATH} transform={`translate(0 ${CLOUD_SHIFT_Y})`} className={`${FILL_BODY} ${stroke}`} strokeWidth={1.4} />;
    case 'firewall':
      return (
        <>
          <rect x={-24} y={-16} width={48} height={32} rx={2} className={`${FILL_BODY} ${stroke}`} strokeWidth={OUTLINE_WIDTH} />
          <path d={FIREWALL_BRICKS} fill="none" className={stroke} strokeWidth={FIREWALL_BRICK_WIDTH} />
        </>
      );
    case 'box':
      return <rect x={-g.hw} y={-g.hh} width={g.hw * 2} height={g.hh * 2} rx={BOX_RADIUS} className={`${FILL_BODY} ${stroke}`} strokeWidth={OUTLINE_WIDTH} />;
    case 'pill':
      return <rect x={-g.hw} y={-g.hh} width={g.hw * 2} height={g.hh * 2} rx={g.hh} className={`${FILL_PLATE} ${stroke}`} strokeWidth={LINK_LABEL_STROKE} />;
    case 'circle':
      return <circle cx={0} cy={0} r={g.hw} className={`${FILL_BODY} ${stroke}`} strokeWidth={OUTLINE_WIDTH} />;
    case 'dot':
      return <circle cx={0} cy={0} r={DOT_R} className={TONE_FILL[tone]} />;
    case 'packet':
      return (
        <>
          <rect x={-PACKET_HW} y={-PACKET_HH} width={PACKET_HW * 2} height={PACKET_HH * 2} rx={2} className={TONE_FILL[tone]} />
          <path d={PACKET_FLAP} fill="none" className={STROKE_PLATE} strokeWidth={PACKET_FLAP_WIDTH} />
        </>
      );
    case 'cross':
      return <path d={`M${-CROSS_HALF},${-CROSS_HALF} L${CROSS_HALF},${CROSS_HALF} M${CROSS_HALF},${-CROSS_HALF} L${-CROSS_HALF},${CROSS_HALF}`} fill="none" className={stroke} strokeWidth={CROSS_WIDTH} strokeLinecap="round" />;
    default:
      return null;
  }
}

function NodeView({ node }: { node: DiagramNode }) {
  const tone = node.tone === 'default' ? KIND_DEFAULT_TONE[node.kind] : node.tone;
  const g = nodeGeom(node);
  const round = node.kind === 'circle' || node.kind === 'dot' || node.kind === 'pill';
  // Pill: o texto toma a cor do tom; nos outros o texto e neutro e o tom e o contorno.
  const labelFill = node.kind === 'pill' ? TONE_FILL[tone] : FILL_TEXT;
  const labelFont = node.kind === 'pill' ? LINK_LABEL_FONT : DEVICE_LABEL_FONT;
  const labelMono = node.kind === 'pill';
  return (
    <g transform={`translate(${num(node.x)} ${num(node.y)})`}>
      {node.highlight && (
        <rect
          x={-g.hw - HIGHLIGHT_PAD}
          y={-g.hh - HIGHLIGHT_PAD}
          width={(g.hw + HIGHLIGHT_PAD) * 2}
          height={(g.hh + HIGHLIGHT_PAD) * 2}
          rx={round ? g.hh + HIGHLIGHT_PAD : BOX_RADIUS}
          fill="none"
          className={STROKE_HIGHLIGHT}
          strokeWidth={HIGHLIGHT_WIDTH}
        />
      )}
      <NodeIcon node={node} tone={tone} />
      {node.label && (
        <text y={g.labelY} textAnchor="middle" fontSize={labelFont} className={`${labelFill} ${labelMono ? 'font-mono' : 'font-sans font-semibold'}`}>
          {node.label}
        </text>
      )}
      {node.sub && (
        <text y={g.subY} textAnchor="middle" fontSize={DEVICE_SUB_FONT} className={`${FILL_SUB} font-mono`}>
          {node.sub}
        </text>
      )}
    </g>
  );
}

const ARROW_TONES: DiagramTone[] = ['default', 'muted', 'accent', 'blue', 'purple', 'red', 'amber'];

function QuizDiagramView({ diagram, title }: { diagram: QuizDiagramData; title: string }) {
  // useId pode trazer ":" (invalido em url(#...)): fica so com letras, digitos e _.
  const uid = useId().replace(/[^A-Za-z0-9_]/g, '_');
  const markerId = (tone: DiagramTone) => `${uid}-arrow-${tone}`;

  const scene = useMemo(() => {
    const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
    const geoms = new Map(diagram.nodes.map((n) => [n.id, nodeGeom(n)]));
    const links = diagram.links.flatMap((l, i) => {
      const a = byId.get(l.from);
      const b = byId.get(l.to);
      const ga = geoms.get(l.from);
      const gb = geoms.get(l.to);
      if (!a || !b || !ga || !gb) return [];
      return [{ key: i, link: l, ...linkGeom(a, b, ga, gb, l.bend, l.arrow) }];
    });
    const usedTones = new Set(links.filter((l) => l.link.arrow !== 'none').map((l) => l.link.tone));
    return { links, usedTones };
  }, [diagram]);

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <svg
        viewBox={`0 0 ${diagram.w} ${diagram.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={title}
        className="mx-auto block h-auto w-full"
        style={{ maxWidth: diagram.w }}
      >
        <defs>
          {ARROW_TONES.filter((tone) => scene.usedTones.has(tone)).map((tone) => (
            <marker
              key={tone}
              id={markerId(tone)}
              viewBox={`0 0 ${ARROW_VIEWBOX} ${ARROW_VIEWBOX}`}
              markerWidth={ARROW_SIZE}
              markerHeight={ARROW_SIZE}
              refX={ARROW_VIEWBOX}
              refY={ARROW_VIEWBOX / 2}
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d={ARROW_PATH} className={ARROW_FILL[tone]} />
            </marker>
          ))}
        </defs>

        {diagram.areas.map((a, i) => (
          <g key={`a${i}`}>
            <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={AREA_RADIUS} fill="none" strokeDasharray={AREA_DASH} strokeWidth={AREA_WIDTH} className={TONE_STROKE[a.tone]} />
            {a.label && (
              <text x={a.x + AREA_LABEL_PAD_X} y={a.y + a.h - AREA_LABEL_PAD_Y} fontSize={AREA_LABEL_FONT} className={`${a.tone === 'default' ? FILL_SUB : TONE_FILL[a.tone]} font-sans`}>
                {a.label}
              </text>
            )}
          </g>
        ))}

        {scene.links.map(({ key, link, path }) => (
          <path
            key={`l${key}`}
            d={path}
            fill="none"
            className={TONE_STROKE[link.tone]}
            strokeWidth={LINE_WIDTH[link.weight]}
            strokeDasharray={LINE_DASH[link.style]}
            strokeLinecap={link.style === 'dotted' ? 'round' : 'butt'}
            markerEnd={link.arrow !== 'none' ? `url(#${markerId(link.tone)})` : undefined}
            markerStart={link.arrow === 'both' ? `url(#${markerId(link.tone)})` : undefined}
          />
        ))}

        {diagram.nodes.map((n) => (
          <NodeView key={n.id} node={n} />
        ))}

        {scene.links.map(({ key, link, mid }) =>
          link.label ? (
            <g key={`p${key}`}>
              <rect
                x={num(mid.x - (textWidth(link.label, LINK_LABEL_CHAR_W) + LINK_LABEL_PAD) / 2)}
                y={num(mid.y - LINK_LABEL_H / 2)}
                width={textWidth(link.label, LINK_LABEL_CHAR_W) + LINK_LABEL_PAD}
                height={LINK_LABEL_H}
                rx={LINK_LABEL_H / 2}
                strokeWidth={LINK_LABEL_STROKE}
                className={`${FILL_PLATE} ${TONE_STROKE[link.tone]}`}
              />
              <text x={num(mid.x)} y={num(mid.y + LINK_LABEL_BASELINE)} textAnchor="middle" fontSize={LINK_LABEL_FONT} className={`${TONE_FILL[link.tone]} font-mono`}>
                {link.label}
              </text>
            </g>
          ) : null,
        )}

        {diagram.labels.map((l, i) => (
          <text key={`t${i}`} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={TEXT_SIZE[l.size]} className={`${TONE_FILL[l.tone]} ${l.mono ? 'font-mono' : 'font-sans'}`}>
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

const QuizDiagram = memo(QuizDiagramView);
export default QuizDiagram;
