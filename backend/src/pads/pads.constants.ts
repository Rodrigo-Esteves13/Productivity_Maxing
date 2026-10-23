import { MS_PER_DAY } from '../common/time.constants';

// Nome do pad no URL (/pad/<slug>): minusculas, digitos, - e _. Guardado
// sempre em minusculas, por isso /pad/Fisica e /pad/fisica sao o mesmo.
export const PAD_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,99}$/;
export const PAD_SLUG_MAX_LENGTH = 100;
export const PAD_MAX_CONTENT_LENGTH = 100_000;
// Sem conta o pad e mais pequeno: o endpoint e publico (abuso, espaco).
export const PAD_ANON_MAX_CONTENT_LENGTH = 20_000;

// Autosave com debounce no frontend + polling enquanto a pagina esta aberta.
// Por IP; sem sessao o limite de gravacoes e mais baixo.
export const PAD_WRITES_PER_MINUTE = 120;
export const PAD_ANON_WRITES_PER_MINUTE = 30;
export const PAD_READS_PER_MINUTE = 120;
export const PAD_LOCKS_PER_MINUTE = 20;

// Pads sem edicoes ha este tempo sao apagados (os trancados nao).
export const PAD_EXPIRY_DAYS = 90;
export const PAD_EXPIRY_MS = PAD_EXPIRY_DAYS * MS_PER_DAY;

// Moderacao (admin): pads mais recentes e quanto do texto mostrar na lista.
export const ADMIN_PADS_PAGE_SIZE = 100;
export const ADMIN_PAD_PREVIEW_LENGTH = 200;
export const ADMIN_PAD_DELETES_PER_MINUTE = 30;
