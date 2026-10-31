import type { SVGProps } from 'react';

// Re-exports diretos do lucide-react, mantendo os nomes que o resto da
// app já usa (import { PencilIcon } from '.../Icons') - zero mudanças nos
// ficheiros que importam daqui. O tamanho 16 por defeito vem do
// <LucideProvider size={16}> no App.tsx (o tamanho real na maioria dos
// sítios já vem de className, ex: "h-4 w-4", que o CSS sobrepõe ao
// atributo width/height do próprio SVG). Antes eram funções embrulho num
// só módulo, e por isso TODOS os ícones iam no JS de arranque; reexportados,
// cada ícone vai só para o chunk da página que o usa.
//
// GoogleIcon/DiscordIcon/GithubIcon ficam à parte, mais abaixo - são
// marcas (brand marks) para os botões de OAuth, não ícones genéricos, e o
// lucide-react não inclui logótipos de marcas (nunca incluiu o do
// GitHub, e descontinuou os que tinha doutras).
export {
  Pencil as PencilIcon,
  X as XIcon,
  Menu as MenuIcon,
  Trash2 as TrashIcon,
  LogOut as LogoutIcon,
  Heart as HeartIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  ArrowUpRight as ArrowUpRightIcon,
  Calendar as CalendarIcon,
  Check as CheckIcon,
  Repeat as RepeatIcon,
  Pin as PinIcon,
  ChevronDown as ChevronDownIcon,
  // UndoIcon usa o glifo "Undo2" do lucide - é o que corresponde à seta
  // curva com gancho que já usávamos (o "Undo" do lucide é uma curva
  // diferente, mais parecida com um "voltar atrás" de navegador).
  Undo2 as UndoIcon,
  Redo2 as RedoIcon,
  GraduationCap as GraduationCapIcon,
  TrendingUp as TrendingUpIcon,
  Gauge as GaugeIcon,
  Clock as ClockIcon,
  BookOpen as BookOpenIcon,
  // ChartPieIcon -> PieChart no lucide-react (nome diferente, mesmo glifo).
  PieChart as ChartPieIcon,
  Calculator as CalculatorIcon,
  Target as TargetIcon,
  AlertTriangle as AlertTriangleIcon,
  Flame as FlameIcon,
  Activity as ActivityIcon,
  Search as SearchIcon,
  Printer as PrinterIcon,
  // SlidersIcon usa "SlidersHorizontal" - é a variante com as barras na
  // horizontal, que é o desenho que já tínhamos (o "Sliders" simples do
  // lucide é a variante vertical).
  SlidersHorizontal as SlidersIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Copy as CopyIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  Mail as MailIcon,
  Image as ImageIcon,
  Flag as FlagIcon,
  GripVertical as GripVerticalIcon,
  Eraser as EraserIcon,
  Shield as ShieldIcon,
  Table2 as TableIcon,
  Sigma as SigmaIcon,
  Network as NetworkIcon,
  Code2 as CodeIcon,
  Plus as PlusIcon,
  Link2 as LinkIcon,
  Type as TypeIcon,
  File as FileIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ArrowRight as ArrowRightIcon,
  ZoomIn as ZoomInIcon,
  PenTool as PenToolIcon,
  // Botao Partilhar do Safari (quadrado com seta para cima), para os passos
  // de "Adicionar ao ecra principal" no iPhone/iPad.
  Share as ShareIcon,
  // Pedido de notificacoes ao entrar na app.
  Bell as BellIcon,
  Lock as LockIcon,
  CircleHelp as HelpCircleIcon,
  Zap as ZapIcon,
  Dumbbell as DumbbellIcon,
  // Ferramenta Selecionar do quadro e as acoes da selecao.
  SquareDashedMousePointer as SelectAreaIcon,
  ClipboardPaste as PasteIcon,
  CopyPlus as DuplicateIcon,
  CalendarX as CalendarXIcon,
  CalendarClock as CalendarClockIcon,
  UserPlus as UserPlusIcon,
  Plane as PlaneIcon,
  Hourglass as HourglassIcon,
  // Pagina Devices: tipo de aparelho de cada sessao.
  Monitor as MonitorIcon,
  Smartphone as SmartphoneIcon,
  Tablet as TabletIcon,
} from 'lucide-react';

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
