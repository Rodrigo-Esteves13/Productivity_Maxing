import type { SVGProps } from 'react';
import {
  Pencil,
  X,
  Menu,
  Trash2,
  LogOut,
  Heart,
  Download,
  Upload,
  ArrowUpRight,
  Calendar,
  Check,
  Pin,
  ChevronDown,
  Undo2,
  GraduationCap,
  TrendingUp,
  Gauge,
  Clock,
  BookOpen,
  PieChart,
  Calculator,
  Target,
  AlertTriangle,
  Flame,
  Activity,
  Search,
  Printer,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Copy,
  ArrowUp,
  Mail,
  Image,
  Flag,
  GripVertical,
  Eraser,
  Shield,
  Table2,
  Sigma,
  Network,
  Code2,
  Plus,
  Link2,
  Type,
} from 'lucide-react';

// Re-exports finos sobre o lucide-react, mantendo os nomes que o resto da
// app já usa (import { PencilIcon } from '.../Icons') - zero mudanças nos
// ~47 ficheiros que importam daqui. `size={16}` só define o default (o
// tamanho real na maioria dos sítios já vem de className, ex: "h-4 w-4",
// que o CSS sobrepõe ao atributo width/height do próprio SVG).
//
// GoogleIcon/DiscordIcon/GithubIcon ficam à parte, mais abaixo - são
// marcas (brand marks) para os botões de OAuth, não ícones genéricos, e o
// lucide-react não inclui logótipos de marcas (nunca incluiu o do
// GitHub, e descontinuou os que tinha doutras).
export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return <Pencil size={16} {...props} />;
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return <X size={16} {...props} />;
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return <Menu size={16} {...props} />;
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return <Trash2 size={16} {...props} />;
}
export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      width={16}
      height={16}
      {...props}
    >
      <path d="M15.545 6.558a9.4 9.4 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.7 7.7 0 0 1 5.352 2.082l-2.284 2.284A4.35 4.35 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.8 4.8 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.7 3.7 0 0 0 1.599-2.431H8v-3.08z" />
    </svg>
  );
}

export function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      width={16}
      height={16}
      {...props}
    >
      <path d="M6.552 6.712c-.456 0-.816.4-.816.888s.368.888.816.888c.456 0 .816-.4.816-.888.008-.488-.36-.888-.816-.888zm2.92 0c-.456 0-.816.4-.816.888s.368.888.816.888c.456 0 .816-.4.816-.888s-.36-.888-.816-.888z" />
      <path d="M13.36 0H2.64C1.736 0 1 .736 1 1.648v10.816c0 .912.736 1.648 1.64 1.648h9.072l-.424-1.48 1.024.952.968.896L15 16V1.648C15 .736 14.264 0 13.36 0zm-3.088 10.448s-.288-.344-.528-.648c1.048-.296 1.448-.952 1.448-.952-.328.216-.64.368-.92.472-.4.168-.784.28-1.16.344a5.604 5.604 0 0 1-2.072-.008 6.716 6.716 0 0 1-1.176-.344 4.688 4.688 0 0 1-.584-.272c-.024-.016-.048-.024-.072-.04-.016-.008-.024-.016-.032-.024-.144-.08-.224-.136-.224-.136s.384.64 1.4.944c-.24.304-.536.664-.536.664-1.768-.056-2.44-1.216-2.44-1.216 0-2.576 1.152-4.664 1.152-4.664 1.152-.864 2.248-.84 2.248-.84l.08.096c-1.44.416-2.104 1.048-2.104 1.048s.176-.096.472-.232c.856-.376 1.536-.48 1.816-.504.048-.008.088-.016.136-.016a6.521 6.521 0 0 1 4.024.752s-.632-.6-1.992-1.016l.112-.128s1.096-.024 2.248.84c0 0 1.152 2.088 1.152 4.664 0 0-.68 1.16-2.448 1.216z" />
    </svg>
  );
}

export function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      width={16}
      height={16}
      {...props}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return <LogOut size={16} {...props} />;
}

export function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return <Heart size={16} {...props} />;
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return <Download size={16} {...props} />;
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return <Upload size={16} {...props} />;
}

export function ArrowUpRightIcon(props: SVGProps<SVGSVGElement>) {
  return <ArrowUpRight size={16} {...props} />;
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return <Calendar size={16} {...props} />;
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <Check size={16} {...props} />;
}

export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return <Pin size={16} {...props} />;
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return <ChevronDown size={16} {...props} />;
}

// UndoIcon usa o glifo "Undo2" do lucide - é o que corresponde à seta
// curva com gancho que já usávamos (o "Undo" do lucide é uma curva
// diferente, mais parecida com um "voltar atrás" de navegador).
export function UndoIcon(props: SVGProps<SVGSVGElement>) {
  return <Undo2 size={16} {...props} />;
}

export function GraduationCapIcon(props: SVGProps<SVGSVGElement>) {
  return <GraduationCap size={16} {...props} />;
}

export function TrendingUpIcon(props: SVGProps<SVGSVGElement>) {
  return <TrendingUp size={16} {...props} />;
}

export function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return <Gauge size={16} {...props} />;
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return <Clock size={16} {...props} />;
}

export function BookOpenIcon(props: SVGProps<SVGSVGElement>) {
  return <BookOpen size={16} {...props} />;
}

// ChartPieIcon -> PieChart no lucide-react (nome diferente, mesmo glifo).
export function ChartPieIcon(props: SVGProps<SVGSVGElement>) {
  return <PieChart size={16} {...props} />;
}

export function CalculatorIcon(props: SVGProps<SVGSVGElement>) {
  return <Calculator size={16} {...props} />;
}

export function TargetIcon(props: SVGProps<SVGSVGElement>) {
  return <Target size={16} {...props} />;
}

export function AlertTriangleIcon(props: SVGProps<SVGSVGElement>) {
  return <AlertTriangle size={16} {...props} />;
}

export function FlameIcon(props: SVGProps<SVGSVGElement>) {
  return <Flame size={16} {...props} />;
}

export function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return <Activity size={16} {...props} />;
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return <Search size={16} {...props} />;
}

export function PrinterIcon(props: SVGProps<SVGSVGElement>) {
  return <Printer size={16} {...props} />;
}

// SlidersIcon usa "SlidersHorizontal" - é a variante com as barras na
// horizontal, que é o desenho que já tínhamos (o "Sliders" simples do
// lucide é a variante vertical).
export function SlidersIcon(props: SVGProps<SVGSVGElement>) {
  return <SlidersHorizontal size={16} {...props} />;
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return <Eye size={16} {...props} />;
}

export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return <EyeOff size={16} {...props} />;
}

export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return <Copy size={16} {...props} />;
}

export function ArrowUpIcon(props: SVGProps<SVGSVGElement>) {
  return <ArrowUp size={16} {...props} />;
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return <Mail size={16} {...props} />;
}

export function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return <Image size={16} {...props} />;
}

export function FlagIcon(props: SVGProps<SVGSVGElement>) {
  return <Flag size={16} {...props} />;
}

export function GripVerticalIcon(props: SVGProps<SVGSVGElement>) {
  return <GripVertical size={16} {...props} />;
}

export function EraserIcon(props: SVGProps<SVGSVGElement>) {
  return <Eraser size={16} {...props} />;
}

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return <Shield size={16} {...props} />;
}

export function TableIcon(props: SVGProps<SVGSVGElement>) {
  return <Table2 size={16} {...props} />;
}

export function SigmaIcon(props: SVGProps<SVGSVGElement>) {
  return <Sigma size={16} {...props} />;
}

export function NetworkIcon(props: SVGProps<SVGSVGElement>) {
  return <Network size={16} {...props} />;
}

export function CodeIcon(props: SVGProps<SVGSVGElement>) {
  return <Code2 size={16} {...props} />;
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return <Plus size={16} {...props} />;
}

export function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return <Link2 size={16} {...props} />;
}

export function TypeIcon(props: SVGProps<SVGSVGElement>) {
  return <Type size={16} {...props} />;
}
