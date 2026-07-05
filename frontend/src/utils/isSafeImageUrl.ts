/**
 * Valida que um URL é seguro para usar como `src` de uma <img>.
 *
 * O `avatarUrl` do user acaba por vir de duas origens: o nosso próprio
 * Supabase Storage (sempre https) ou o provider de OAuth (Google/GitHub/
 * Discord, também sempre https), mas como é um valor guardado na BD e
 * devolvido pela API, o CodeQL trata-o como "untrusted", e com razão,
 * porque nada impede que passe a vir de outro sítio no futuro. Esta função
 * garante que só aceitamos esquemas inofensivos (http/https, ou blob: para
 * os previews locais gerados por URL.createObjectURL), bloqueando coisas
 * como `javascript:` ou `data:` que nunca deviam parar num src de imagem.
 */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith('blob:')) return true;

  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
