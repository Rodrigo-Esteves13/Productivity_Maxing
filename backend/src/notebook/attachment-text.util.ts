// Anexos de texto puro (md, txt, py, json, csv) nao tem magic bytes, por isso
// a validacao e "parece texto?". O Bloco de Notas do Windows grava muitas
// vezes em UTF-16 ("Unicode"), que tem um NUL byte a cada caracter ASCII e
// era recusado como binario (era a causa de um .md nao subir). Aqui um
// UTF-16 com BOM e convertido para UTF-8 antes da verificacao.

const UTF16_LE_BOM = [0xff, 0xfe];
const UTF16_BE_BOM = [0xfe, 0xff];

function startsWith(buffer: Buffer, bom: number[]): boolean {
  return bom.every((byte, index) => buffer[index] === byte);
}

function decodeUtf16(buffer: Buffer, bigEndian: boolean): Buffer {
  const body = Buffer.from(buffer.subarray(2));
  if (bigEndian) body.swap16();
  return Buffer.from(body.toString('utf16le'), 'utf8');
}

// Heurística "isto parece texto ou binário": um NUL byte não aparece em
// texto normal UTF-8/Latin1, é o sinal clássico de conteúdo binário
// (o mesmo que o git usa para a mesma decisão). Não é uma prova formal,
// mas combinada com a extensão pedida e o ficheiro nunca ser executado
// em lado nenhum, é uma barreira razoável para o que resta depois da
// deteção por magic bytes.
function looksLikeBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

/**
 * Conteudo do ficheiro como texto UTF-8 pronto a guardar, ou null se o
 * ficheiro parece binario. UTF-16 com BOM (par de bytes valido) e convertido.
 */
export function toUtf8TextBuffer(buffer: Buffer): Buffer | null {
  const hasEvenLength = buffer.length % 2 === 0;
  let text = buffer;
  if (hasEvenLength && startsWith(buffer, UTF16_LE_BOM)) {
    text = decodeUtf16(buffer, false);
  } else if (hasEvenLength && startsWith(buffer, UTF16_BE_BOM)) {
    text = decodeUtf16(buffer, true);
  }
  return looksLikeBinary(text) ? null : text;
}
