// S-17/S-20/S-22/S-31: metadados das rotas (sem levantar a app).
import { ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { StudySessionsController } from './study-sessions.controller';
import { PredictionController } from '../prediction/prediction.controller';
import {
  STUDY_SESSION_STATS_PER_MINUTE,
  STUDY_SESSION_WRITES_PER_MINUTE,
} from './study-sessions.constants';
import { PREDICTION_ACCURACY_PER_MINUTE } from '../prediction/prediction.constants';

// Chave do @nestjs/throttler para o limite do throttler "default".
const THROTTLE_LIMIT_KEY = 'THROTTLER:LIMITdefault';

type Handler = (...args: unknown[]) => unknown;

function handlerOf(controller: { prototype: object }, name: string): Handler {
  return (controller.prototype as Record<string, Handler>)[name];
}

function limitOf(controller: { prototype: object }, name: string) {
  return Reflect.getMetadata(
    THROTTLE_LIMIT_KEY,
    handlerOf(controller, name),
  ) as number | undefined;
}

function idPipes(name: string): unknown[] {
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    StudySessionsController,
    name,
  ) as Record<string, { data?: string; pipes?: unknown[] }>;
  const idArg = Object.values(args).find((arg) => arg.data === 'id');
  return idArg?.pipes ?? [];
}

describe('StudySessionsController route metadata', () => {
  it.each(['stop', 'heartbeat', 'recordDistraction', 'update', 'remove'])(
    '%s validates :id with ParseUUIDPipe',
    (name) => {
      expect(idPipes(name)).toContain(ParseUUIDPipe);
    },
  );

  it('throttles time-by-area like the other aggregated stats', () => {
    expect(limitOf(StudySessionsController, 'getTimeByArea')).toBe(
      STUDY_SESSION_STATS_PER_MINUTE,
    );
    expect(limitOf(StudySessionsController, 'getDistractionStats')).toBe(
      STUDY_SESSION_STATS_PER_MINUTE,
    );
    expect(STUDY_SESSION_STATS_PER_MINUTE).toBe(30);
  });

  it('keeps the old write limits under named constants', () => {
    for (const name of ['createManual', 'update', 'remove']) {
      expect(limitOf(StudySessionsController, name)).toBe(
        STUDY_SESSION_WRITES_PER_MINUTE,
      );
    }
    expect(STUDY_SESSION_WRITES_PER_MINUTE).toBe(30);
  });
});

describe('PredictionController route metadata', () => {
  it('throttles /predictions/accuracy at 30 per minute', () => {
    expect(limitOf(PredictionController, 'getEstimationAccuracy')).toBe(
      PREDICTION_ACCURACY_PER_MINUTE,
    );
    expect(PREDICTION_ACCURACY_PER_MINUTE).toBe(30);
  });
});
