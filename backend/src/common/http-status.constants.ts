import { HttpStatus } from '@nestjs/common';

// `Response.status` (fetch) e um `number`, enquanto `HttpStatus` e um enum.
// Comparar os dois diretamente rebenta com @typescript-eslint/no-unsafe-enum-comparison,
// por isso expomos aqui os codigos ja como `number`.
export const HTTP_NOT_FOUND: number = HttpStatus.NOT_FOUND;
export const HTTP_GONE: number = HttpStatus.GONE;
