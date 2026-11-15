import { BadRequestException, ValidationPipe } from '@nestjs/common';
import express, { json, type Request, type Response } from 'express';
import request from 'supertest';
import {
  createQuizImportBodyParser,
  importBodyReviver,
  quizImportBodyOnly,
} from './quiz-import-body';
import { ImportQuizDto } from './dto/quiz.dto';
import { QUIZ_IMPORT_PATH } from './quizzes.constants';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_LARGE = 413;
// Maior que o limite por defeito (100 KB), menor que o do import.
const BIG_BODY_BYTES = 500 * 1024;
// Objeto largo do audit H1 (~110k chaves): 4.6 s no class-transformer.
const WIDE_KEYS = 110_000;
const DEEP_NESTING = 100_000;
// Tempo maximo da ValidationPipe para um corpo hostil ja lido. Antes da
// correcao eram 4.6 s; o limite tem folga para runners de CI lentos e com
// workers em paralelo, mas continua muito abaixo do caso vulneravel.
const HOSTILE_BODY_MAX_MS = 1000;

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const wideObject = (n: number) =>
  `{${Array.from({ length: n }, (_, i) => `"${i.toString(36)}":1`).join(',')}}`;

// App minima como a do main.ts: o parser do import antes do parser global.
function app() {
  const server = express();
  server.use(createQuizImportBodyParser());
  server.use(json());
  server.all('/{*path}', (req: Request, res: Response) => {
    const body = req.body as { quizJson?: string } | undefined;
    res.json({ length: body?.quizJson?.length ?? 0 });
  });
  return server;
}

describe('importBodyReviver', () => {
  const parse = (text: string) =>
    JSON.parse(text, importBodyReviver) as unknown;

  it('keeps only a flat { quizJson: string } body', () => {
    expect(parse('{"quizJson":"{\\"a\\":[1]}"}')).toEqual({
      quizJson: '{"a":[1]}',
    });
    expect(parse('{"quizJson":{"a":1}}')).toEqual({ quizJson: null });
    expect(parse('{"quizJson":[1,2]}')).toEqual({ quizJson: null });
    [
      '{"quiz":{"a":1}}',
      '{"quizJson":"x","evil":1}',
      '{"__proto__":{"x":1}}',
      '{"":{"quizJson":"x"}}',
      '[1,2]',
      '"text"',
      '1',
      'null',
      '{}',
    ].forEach((text) => expect(parse(text)).toEqual({}));
  });

  it('refuses wide or extra-key bodies fast through the pipe', async () => {
    const bodies = [
      `{"quiz":${wideObject(WIDE_KEYS)}}`,
      wideObject(WIDE_KEYS),
      `{"quizJson":${wideObject(WIDE_KEYS)}}`,
    ];
    for (const text of bodies) {
      // O JSON.parse nativo fica fora da medicao: varia com a maquina e
      // nao era o problema (o custo quadratico estava na pipe).
      const body = parse(text);
      const start = performance.now();
      await expect(
        pipe.transform(body, { type: 'body', metatype: ImportQuizDto }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(performance.now() - start).toBeLessThan(HOSTILE_BODY_MAX_MS);
    }
  });

  it('answers 400 (not 500) to a very deep body on the import route', async () => {
    const deep = `{"quiz":{"a":${'['.repeat(DEEP_NESTING)}${']'.repeat(DEEP_NESTING)}}}`;
    const start = performance.now();
    const res = await request(app())
      .post(QUIZ_IMPORT_PATH)
      .set('Content-Type', 'application/json')
      .send(deep);
    expect(res.status).toBe(HTTP_BAD_REQUEST);
    expect(performance.now() - start).toBeLessThan(HOSTILE_BODY_MAX_MS);
  });
});

describe('quizImportBodyOnly', () => {
  it('uses the import parser only for POST on the exact path', () => {
    const cases: [string, string, boolean][] = [
      ['POST', QUIZ_IMPORT_PATH, true],
      ['GET', QUIZ_IMPORT_PATH, false],
      ['PUT', QUIZ_IMPORT_PATH, false],
      ['POST', `${QUIZ_IMPORT_PATH}/x`, false],
      ['POST', `${QUIZ_IMPORT_PATH}/`, false],
      ['POST', `${QUIZ_IMPORT_PATH}x`, false],
      ['POST', QUIZ_IMPORT_PATH.toUpperCase(), false],
      ['POST', '/quizzes', false],
    ];
    cases.forEach(([method, path, parsed]) => {
      const parser = jest.fn();
      const next = jest.fn();
      quizImportBodyOnly(parser)(
        { method, path } as Request,
        {} as Response,
        next,
      );
      expect([method, path, parser.mock.calls.length]).toEqual([
        method,
        path,
        parsed ? 1 : 0,
      ]);
      expect(next).toHaveBeenCalledTimes(parsed ? 0 : 1);
    });
  });

  it('is not named jsonParser (Nest would skip its own parser)', () => {
    expect(quizImportBodyOnly(json()).name).not.toBe('jsonParser');
  });

  it('accepts a big body on the import route only', async () => {
    const body = { quizJson: 'x'.repeat(BIG_BODY_BYTES) };
    const ok = await request(app()).post(`${QUIZ_IMPORT_PATH}?a=1`).send(body);
    expect(ok.status).toBe(HTTP_OK);
    expect(ok.body).toEqual({ length: BIG_BODY_BYTES });
    for (const path of [`${QUIZ_IMPORT_PATH}/x`, '/quizzes', '/tasks']) {
      const res = await request(app()).post(path).send(body);
      expect([path, res.status]).toEqual([path, HTTP_TOO_LARGE]);
    }
  });
});
