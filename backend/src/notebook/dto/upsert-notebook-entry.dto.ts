import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  IsNumber,
  IsInt,
  IsEnum,
  IsIn,
  IsHexColor,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotebookEntryType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Um ponto de um traço. `pressure` é opcional (nem todo o rato/touchpad
// reporta pressão - só canetas/ecrãs sensíveis a isso) e nunca é usado
// para nada no backend, só passa direto para o frontend redesenhar o
// traço com a mesma espessura variável de quando foi feito.
export class StrokePointDto {
  @ApiProperty({ example: 120.5 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 340.2 })
  @IsNumber()
  y: number;

  @ApiPropertyOptional({ example: 0.8 })
  @IsOptional()
  @IsNumber()
  pressure?: number;
}

// Um traço completo (do pointerdown ao pointerup). Guardado vetorial, não
// rasterizado - ver comentário em NotebookEntry.drawingStrokes no schema.
export class StrokeDto {
  @ApiProperty({ type: [StrokePointDto] })
  @IsArray()
  // Um traço muito longo (rabisco contínuo sem levantar o rato) facilmente
  // passa de milhares de pontos - sem limite nenhum, um cliente malicioso
  // podia mandar um "traço" com milhões de pontos só para inchar o JSONB.
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => StrokePointDto)
  points: StrokePointDto[];

  @ApiProperty({ example: '#7C3AED' })
  @IsHexColor()
  color: string;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  @Min(0.5)
  width: number;
}

// Uma linha de uma tabela estruturada - lista de células de texto livre.
// Sem limite de largura de coluna imposto aqui (MaxLength por célula
// chega para o caso de DoS), o número de colunas é o que o array `cells`
// tiver.
export class NotebookTableRowDto {
  @ApiProperty({
    type: [String],
    example: ['Router', 'GigabitEthernet0/0', '192.168.1.1'],
  })
  @IsArray()
  // Uma tabela realista de apontamentos não passa disto - acima é mais
  // provável ser um erro de cliente (ou abuso) do que uma tabela real.
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  cells: string[];
}

// Uma tabela estruturada dentro de uma entrada. `id` é gerado no
// frontend (crypto.randomUUID()) só para servir de key/referência ao
// editar - o backend não faz nada com ele além de o guardar tal como
// veio, não é FK de nada.
export class NotebookTableDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @ApiProperty({ type: [NotebookTableRowDto] })
  @IsArray()
  // Uma entrada de caderno é um apontamento, não uma folha de cálculo -
  // 30 linhas por tabela dá margem larga sem deixar o JSONB crescer sem
  // controlo.
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => NotebookTableRowDto)
  rows: NotebookTableRowDto[];
}

// Sete tipos por agora - os pedidos mais comuns em apontamentos de redes
// (ver NETWORKING_SNIPPETS no frontend). Novos tipos só acrescentam a
// esta lista + o respetivo desenho em canvasShapeDefs.ts, nada mais muda.
const CANVAS_SHAPE_TYPES = [
  'router',
  'switch',
  'firewall',
  'server',
  'pc',
  'cloud',
  'ap',
] as const;

// Uma forma posicionável no canvas (router/switch/etc.) - ao contrário de
// Stroke (traço à mão, imutável depois de desenhado), isto tem
// posição/tamanho próprios que o frontend deixa arrastar e redimensionar
// depois de colocados. x/y sem Min/Max de propósito (mesmo critério do
// StrokePointDto acima - é a mesma superfície/coordenadas); width/height
// têm limites porque controlam diretamente o custo de render.
export class CanvasShapeDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @ApiProperty({ enum: CANVAS_SHAPE_TYPES })
  @IsIn(CANVAS_SHAPE_TYPES)
  type: (typeof CANVAS_SHAPE_TYPES)[number];

  @ApiProperty({ example: 120 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 80 })
  @IsNumber()
  y: number;

  @ApiProperty({ example: 96 })
  @IsNumber()
  @Min(20)
  @Max(400)
  width: number;

  @ApiProperty({ example: 72 })
  @IsNumber()
  @Min(20)
  @Max(400)
  height: number;

  @ApiProperty({ example: 'R1' })
  @IsString()
  @MaxLength(40)
  label: string;
}

// Sem FK real a CanvasShapeDto de propósito (isto é um blob JSON, não uma
// tabela relacional) - fromShapeId/toShapeId só precisam de corresponder
// a um id presente em canvasShapes para a ligação aparecer desenhada; se
// não corresponderem (forma apagada por fora deste fluxo, por exemplo),
// o frontend simplesmente não desenha a ligação, não é um erro de validação.
export class CanvasLinkDto {
  @ApiProperty({ example: 'e5f6...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  fromShapeId: string;

  @ApiProperty({ example: 'b2c3d4e5-...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  toShapeId: string;

  @ApiProperty({ example: 'Gi0/0' })
  @IsString()
  @MaxLength(40)
  label: string;
}

// Etiqueta de texto solta no canvas - x/y sem Min/Max (mesmo critério do
// StrokePointDto/CanvasShapeDto acima); text limitado a 300 chars, é uma
// etiqueta curta sobre o desenho, não um campo de notas (isso já existe
// em textContent). fontSize/color opcionais - entradas criadas antes
// desta feature não os têm, o frontend aplica um default ao ler.
export class CanvasTextDto {
  @ApiProperty({ example: 'f7a8...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @ApiProperty({ example: 200 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  y: number;

  @ApiProperty({ example: 'VLAN 10 - Sales' })
  @IsString()
  @MaxLength(300)
  text: string;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(72)
  fontSize?: number;

  @ApiPropertyOptional({ example: '#1C1C1E' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class CreateNotebookEntryDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsUUID()
  areaId: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-...',
    description:
      'ClassOccurrence detected as "happening now" when the entry was started (see GET /notebook/detect-class). Omit if there was no match.',
  })
  @IsOptional()
  @IsUUID()
  classOccurrenceId?: string;

  @ApiProperty({ example: 'Aula 12 de quinta, 18/09' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    enum: NotebookEntryType,
    default: NotebookEntryType.NOTE,
    description:
      'NOTE (apontamento livre), STUDY (sessão de estudo) or CLASS (aula).',
  })
  @IsOptional()
  @IsEnum(NotebookEntryType)
  entryType?: NotebookEntryType;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Only meaningful when entryType is CLASS. Never auto-computed server-side - the frontend suggests the next number (max classNumber already used in this area + 1) and the user can always override it, including reusing the same number across two entries when one physical class covered two different subjects.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  classNumber?: number;

  @ApiPropertyOptional({ example: 'Hoje vimos normalização até 3FN...' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  textContent?: string;

  @ApiPropertyOptional({ type: [StrokeDto] })
  @IsOptional()
  @IsArray()
  // Um caderno de aula real facilmente tem centenas de traços; 5000 dá
  // margem larga sem deixar o payload crescer sem controlo nenhum.
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => StrokeDto)
  drawingStrokes?: StrokeDto[];

  @ApiPropertyOptional({ type: [NotebookTableDto] })
  @IsOptional()
  @IsArray()
  // Poucas tabelas por entrada é o caso de uso real (1-3); 20 dá margem
  // sem permitir inchar o JSONB.
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => NotebookTableDto)
  tables?: NotebookTableDto[];

  @ApiPropertyOptional({ type: [CanvasShapeDto] })
  @IsOptional()
  @IsArray()
  // Um diagrama de rede razoável não passa disto - 200 dá margem larga
  // sem deixar o JSONB crescer sem controlo.
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CanvasShapeDto)
  canvasShapes?: CanvasShapeDto[];

  @ApiPropertyOptional({ type: [CanvasLinkDto] })
  @IsOptional()
  @IsArray()
  // Mais generoso que canvasShapes (um diagrama denso tem mais ligações
  // do que formas), mas ainda um limite sensato para não inchar o JSONB.
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => CanvasLinkDto)
  canvasLinks?: CanvasLinkDto[];

  @ApiPropertyOptional({ type: [CanvasTextDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => CanvasTextDto)
  canvasTexts?: CanvasTextDto[];

  @ApiProperty({ example: '2026-09-18T00:00:00.000Z' })
  @IsDateString()
  date: string;
}

// Igual ao create, mas tudo opcional (PATCH parcial) e sem areaId - mover
// uma entrada de cadeira depois de criada não é um caso de uso real
// (seria "esta aula afinal era de outra cadeira", melhor apagar e criar
// de novo do que arrastar fotos/traços entre Areas diferentes).
export class UpdateNotebookEntryDto {
  @ApiPropertyOptional({ example: 'Aula 12 de quinta, 18/09' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: NotebookEntryType })
  @IsOptional()
  @IsEnum(NotebookEntryType)
  entryType?: NotebookEntryType;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  classNumber?: number;

  @ApiPropertyOptional({ example: 'Hoje vimos normalização até 3FN...' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  textContent?: string;

  @ApiPropertyOptional({ type: [StrokeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => StrokeDto)
  drawingStrokes?: StrokeDto[];

  @ApiPropertyOptional({ type: [NotebookTableDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => NotebookTableDto)
  tables?: NotebookTableDto[];

  @ApiPropertyOptional({ type: [CanvasShapeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CanvasShapeDto)
  canvasShapes?: CanvasShapeDto[];

  @ApiPropertyOptional({ type: [CanvasLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => CanvasLinkDto)
  canvasLinks?: CanvasLinkDto[];

  @ApiPropertyOptional({ type: [CanvasTextDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => CanvasTextDto)
  canvasTexts?: CanvasTextDto[];

  @ApiPropertyOptional({ example: '2026-09-18T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
