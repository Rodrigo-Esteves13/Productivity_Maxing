// Catálogo de referência para o painel de Ferramentas do Notebook
// (NotebookToolsPanel). Cada item é um par (label curto mostrado no
// botão, valor real inserido/copiado) - dados de conteúdo, não regras de
// negócio, por isso vivem como constantes simples aqui em vez de virem
// de uma tabela na base de dados (o Notebook é um caderno pessoal, isto
// é o equivalente a um "teclado de símbolos", não uma entidade do
// domínio da app).

export interface SnippetItem {
  /** Texto curto mostrado no botão. */
  label: string;
  /** Texto realmente inserido/copiado quando o botão é usado. */
  value: string;
  /** Chave i18n opcional da descrição, mostrada como title="" (tooltip) ao passar o rato. */
  description?: string;
}

export interface SnippetSection {
  id: string;
  /** Chave i18n do título da secção. */
  title: string;
  items: SnippetItem[];
}

const MATH_SYMBOLS: SnippetItem[] = [
  { label: '±', value: '±' },
  { label: '×', value: '×' },
  { label: '÷', value: '÷' },
  { label: '≈', value: '≈', description: 'snippet.approximatelyEqual' },
  { label: '≠', value: '≠', description: 'snippet.notEqual' },
  { label: '≤', value: '≤' },
  { label: '≥', value: '≥' },
  { label: '∞', value: '∞', description: 'snippet.infinity' },
  { label: '√', value: '√', description: 'snippet.squareRoot' },
  { label: '∑', value: '∑', description: 'snippet.sum' },
  { label: '∏', value: '∏', description: 'snippet.product' },
  { label: '∫', value: '∫', description: 'snippet.integral' },
  { label: '∂', value: '∂', description: 'snippet.partialDerivative' },
  { label: 'Δ', value: 'Δ', description: 'snippet.deltaChangeIn' },
  { label: 'π', value: 'π', description: 'snippet.pi' },
  { label: 'θ', value: 'θ', description: 'snippet.theta' },
  { label: 'λ', value: 'λ', description: 'snippet.lambda' },
  { label: 'μ', value: 'μ', description: 'snippet.mu' },
  { label: 'σ', value: 'σ', description: 'snippet.sigma' },
  { label: 'ω', value: 'ω', description: 'snippet.omega' },
  { label: '∈', value: '∈', description: 'snippet.elementOf' },
  { label: '∉', value: '∉', description: 'snippet.notAnElementOf' },
  { label: '∀', value: '∀', description: 'snippet.forAll' },
  { label: '∃', value: '∃', description: 'snippet.thereExists' },
  { label: '→', value: '→', description: 'snippet.arrowImplies' },
  { label: '⇒', value: '⇒', description: 'snippet.implies' },
  { label: '⇔', value: '⇔', description: 'snippet.ifAndOnlyIf' },
  { label: '∅', value: '∅', description: 'snippet.emptySet' },
  { label: '∪', value: '∪', description: 'snippet.union' },
  { label: '∩', value: '∩', description: 'snippet.intersection' },
];

// Abreviaturas/comandos que aparecem constantemente em apontamentos de
// redes (Cisco IOS-style, mas a maioria é padrão da indústria) - o
// objetivo é poupar a escrita repetida destes tokens, não ser um
// simulador de CLI.
const NETWORKING_SNIPPETS: SnippetItem[] = [
  { label: 'Gi0/0', value: 'GigabitEthernet0/0' },
  { label: 'Fa0/0', value: 'FastEthernet0/0' },
  { label: 'Se0/0/0', value: 'Serial0/0/0' },
  { label: 'Te0/0', value: 'TenGigabitEthernet0/0' },
  { label: 'Lo0', value: 'Loopback0' },
  { label: 'Po1', value: 'Port-channel1', description: 'snippet.etherchannelLogicalInterface' },
  { label: 'VLAN', value: 'VLAN ' },
  { label: 'SVI', value: 'SVI (Switch Virtual Interface)' },
  { label: 'Trunk', value: 'Trunk' },
  { label: 'Access port', value: 'Access port' },
  { label: 'ACL', value: 'ACL (Access Control List)' },
  { label: 'NAT', value: 'NAT (Network Address Translation)' },
  { label: 'PAT', value: 'PAT (Port Address Translation)' },
  { label: 'DHCP', value: 'DHCP' },
  { label: 'DNS', value: 'DNS' },
  { label: 'OSPF', value: 'OSPF' },
  { label: 'EIGRP', value: 'EIGRP' },
  { label: 'BGP', value: 'BGP' },
  { label: 'STP', value: 'STP (Spanning Tree Protocol)' },
  { label: 'HSRP', value: 'HSRP (Hot Standby Router Protocol)' },
  { label: 'VRRP', value: 'VRRP (Virtual Router Redundancy Protocol)' },
  { label: 'DMZ', value: 'DMZ (Demilitarized Zone)' },
  { label: 'WAN', value: 'WAN' },
  { label: 'LAN', value: 'LAN' },
  { label: 'MAC', value: 'MAC address' },
  { label: 'ARP', value: 'ARP' },
  { label: 'TTL', value: 'TTL' },
  { label: 'MTU', value: 'MTU' },
  { label: '/16', value: '/16' },
  { label: '/24', value: '/24' },
  { label: '/28', value: '/28' },
  { label: '/30', value: '/30' },
  { label: '::/64', value: '::/64', description: 'snippet.ipv6Prefix' },
  { label: 'show run', value: 'show running-config' },
  { label: 'ping', value: 'ping ' },
  { label: 'traceroute', value: 'traceroute ' },
  { label: '↔', value: '↔', description: 'snippet.linkBetweenTwoDevices' },
  { label: '→', value: '→', description: 'snippet.trafficDirection' },
  { label: '[Router]', value: '[Router]' },
  { label: '[Switch]', value: '[Switch]' },
  { label: '[Firewall]', value: '[Firewall]' },
  { label: '[Server]', value: '[Server]' },
  { label: '[PC]', value: '[PC]' },
  { label: '[Cloud]', value: '[Cloud]' },
  { label: '[AP]', value: '[AP]', description: 'snippet.wirelessAccessPoint' },
];

const PROGRAMMING_SNIPPETS: SnippetItem[] = [
  { label: '=>', value: '=>' },
  { label: '->', value: '->' },
  { label: '===', value: '===' },
  { label: '!==', value: '!==' },
  { label: '&&', value: '&&' },
  { label: '||', value: '||' },
  { label: '??', value: '??', description: 'snippet.nullishCoalescing' },
  { label: '?.', value: '?.', description: 'snippet.optionalChaining' },
  { label: '<=', value: '<=' },
  { label: '>=', value: '>=' },
  { label: '{}', value: '{}' },
  { label: '[]', value: '[]' },
  { label: '<>', value: '<>' },
  { label: '//', value: '//' },
  { label: '/* */', value: '/*  */' },
  { label: 'O(n)', value: 'O(n)' },
  { label: 'O(log n)', value: 'O(log n)' },
  { label: 'O(n²)', value: 'O(n²)' },
];

export const SNIPPET_SECTIONS: SnippetSection[] = [
  { id: 'math', title: 'snippet.sectionMath', items: MATH_SYMBOLS },
  { id: 'networking', title: 'snippet.sectionNetworking', items: NETWORKING_SNIPPETS },
  { id: 'programming', title: 'snippet.sectionProgramming', items: PROGRAMMING_SNIPPETS },
];

// Templates de tabela em Markdown - inseridos como texto simples dentro
// de textContent (o mesmo campo que já guarda o resto da entrada), sem
// exigir nenhuma alteração ao schema/backend. `cols`/`rows` só definem a
// grelha vazia gerada; o utilizador escreve o conteúdo por cima.
export function buildMarkdownTable(rows: number, cols: number): string {
  const safeCols = Math.min(Math.max(cols, 1), 10);
  const safeRows = Math.min(Math.max(rows, 1), 20);

  const header = `| ${Array.from({ length: safeCols }, (_, i) => `Column ${i + 1}`).join(' | ')} |`;
  const divider = `| ${Array.from({ length: safeCols }, () => '---').join(' | ')} |`;
  const bodyRows = Array.from(
    { length: safeRows },
    () => `| ${Array.from({ length: safeCols }, () => ' ').join(' | ')} |`,
  );

  return ['', header, divider, ...bodyRows, ''].join('\n');
}

export const TABLE_PRESETS: { label: string; rows: number; cols: number }[] = [
  { label: '2 x 2', rows: 2, cols: 2 },
  { label: '3 x 3', rows: 3, cols: 3 },
  { label: '4 x 3', rows: 4, cols: 3 },
];
