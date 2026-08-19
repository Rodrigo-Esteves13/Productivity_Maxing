import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PredictDurationDto } from './dto/predict-duration.dto';
import { DIFFICULTY_WEIGHT } from '../common/difficulty-weight.util';
import { fitScaler, applyScaler, invertScaler, solveOls } from './prediction-math.util';
import type { Scaler } from './prediction-math.util';
import { trainMlp } from './prediction-mlp.util';
import type { DurationPrediction, PredictionMethod } from './prediction.types';

// Abaixo disto, nem regressão linear se tenta - 10 amostras não chegam
// para 5 coeficientes (bias + 4 features) sem overfitting quase garantido,
// mesmo com a regularização de Ridge em prediction-math.util.ts.
const MIN_SAMPLES_FOR_REGRESSION = 10;
// A partir daqui a MLP entra em vez da regressão linear - com poucas
// dezenas de amostras uma rede não tem dados que cheguem para superar
// uma regressão simples, e treiná-la só adicionava latência sem ganho.
const MIN_SAMPLES_FOR_MLP = 50;
// O modelo em cache só é re-treinado quando o nº de amostras de treino
// cresceu pelo menos isto desde o último treino (ou quando o método ideal
// mudou - ver getOrTrainModel) - mesmo espírito de cache do
// StudySessionsService.heatmapCache, só que invalidado por contagem de
// amostras novas em vez de tempo, como combinado com o Rodrigo.
const RETRAIN_SAMPLE_DELTA = 5;
// Suaviza a média de duração real por TaskType (target encoding) em
// direção à média global, ponderada por quantas tasks desse tipo já
// existem - sem isto, um tipo com 1-2 tasks de treino ficaria com uma
// "média" que é basicamente o próprio valor a prever, um sinal
// artificialmente forte que não generaliza.
const TYPE_AVERAGE_SMOOTHING_K = 3;

const TRAINING_SELECT = {
  id: true,
  taskTypeId: true,
  difficulty: true,
  weightPercentage: true,
  estimatedMinutes: true,
  studySessions: {
    where: { endedAt: { not: null } },
    select: { startedAt: true, endedAt: true },
  },
} satisfies Prisma.TaskSelect;

type TrainingTask = Prisma.TaskGetPayload<{ select: typeof TRAINING_SELECT }>;

interface TrainingRow {
  taskTypeId: string;
  difficulty: keyof typeof DIFFICULTY_WEIGHT;
  weightPercentage: number | null;
  estimatedMinutes: number | null;
  actualMinutes: number;
}

interface CachedModel {
  method: 'linear_regression' | 'mlp';
  trainedAtSampleSize: number;
  featureScalers: Scaler[];
  targetScaler: Scaler | null; // só para 'mlp'
  typeAverages: Map<string, number>;
  globalMeanActualMinutes: number;
  predict: (rawFeatures: number[]) => number;
}

interface ModelResult {
  method: PredictionMethod;
  sampleSize: number;
  typeAverages: Map<string, number>;
  globalMeanActualMinutes: number;
  predict: ((rawFeatures: number[]) => number) | null;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  // chave = userId. Ver RETRAIN_SAMPLE_DELTA acima para quando é
  // invalidado - perde-se com o restart do processo, o que é aceitável
  // pela mesma razão que o heatmapCache do StudySessionsService: não é a
  // fonte de verdade, só poupa retreinar o modelo em cada pedido.
  private readonly modelCache = new Map<string, CachedModel>();

  constructor(private readonly prisma: PrismaService) {}

  async predictDuration(
    userId: string,
    dto: PredictDurationDto,
  ): Promise<DurationPrediction> {
    let ownedTask: { estimatedMinutes: number | null } | null = null;
    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, userId },
        select: { estimatedMinutes: true },
      });
      if (!task) {
        throw new NotFoundException(`Task not found or you don't have access.`);
      }
      ownedTask = task;
    }

    const taskTypeId = await this.resolveTaskTypeId(dto.type);
    const model = await this.getOrTrainModel(userId);

    const actualMinutes = dto.taskId
      ? await this.computeActualMinutesForTask(userId, dto.taskId)
      : null;

    if (model.method === 'insufficient_data' || !model.predict) {
      return {
        predictedMinutes: null,
        method: 'insufficient_data',
        sampleSize: model.sampleSize,
        actualMinutes,
      };
    }

    const rawFeatures = [
      DIFFICULTY_WEIGHT[dto.difficulty],
      dto.weightPercentage ?? 0,
      ownedTask?.estimatedMinutes ?? 0,
      model.typeAverages.get(taskTypeId) ?? model.globalMeanActualMinutes,
    ];

    const predictedRaw = model.predict(rawFeatures);
    const predictedMinutes = Math.max(0, Math.round(predictedRaw));

    return {
      predictedMinutes,
      method: model.method,
      sampleSize: model.sampleSize,
      actualMinutes,
    };
  }

  /**
   * Devolve o modelo em cache se ainda for válido para o método/tamanho de
   * amostra atuais, ou treina um novo. A comparação de `method` cobre os
   * dois casos de invalidação de uma vez: cresceu o suficiente desde o
   * último treino (RETRAIN_SAMPLE_DELTA) OU ultrapassou um dos thresholds
   * (ex: passou de 9 para 10 amostras) - nesse segundo caso o método
   * "ideal" recém-computado já vem diferente do que está em cache, por
   * isso não precisa de uma verificação à parte para "mudou de fase".
   */
  private async getOrTrainModel(userId: string): Promise<ModelResult> {
    const rows = await this.loadTrainingRows(userId);
    const sampleSize = rows.length;
    const method = this.decideMethod(sampleSize);

    if (method === 'insufficient_data') {
      return {
        method,
        sampleSize,
        typeAverages: new Map(),
        globalMeanActualMinutes: 0,
        predict: null,
      };
    }

    const cached = this.modelCache.get(userId);
    const isFresh =
      !!cached &&
      cached.method === method &&
      sampleSize - cached.trainedAtSampleSize < RETRAIN_SAMPLE_DELTA;

    if (isFresh && cached) {
      return {
        method: cached.method,
        sampleSize,
        typeAverages: cached.typeAverages,
        globalMeanActualMinutes: cached.globalMeanActualMinutes,
        predict: cached.predict,
      };
    }

    const trained = await this.trainModel(method, rows, sampleSize);
    this.modelCache.set(userId, trained);

    return {
      method: trained.method,
      sampleSize,
      typeAverages: trained.typeAverages,
      globalMeanActualMinutes: trained.globalMeanActualMinutes,
      predict: trained.predict,
    };
  }

  private decideMethod(
    sampleSize: number,
  ): 'insufficient_data' | 'linear_regression' | 'mlp' {
    if (sampleSize < MIN_SAMPLES_FOR_REGRESSION) return 'insufficient_data';
    if (sampleSize < MIN_SAMPLES_FOR_MLP) return 'linear_regression';
    return 'mlp';
  }

  private async trainModel(
    method: 'linear_regression' | 'mlp',
    rows: TrainingRow[],
    sampleSize: number,
  ): Promise<CachedModel> {
    const globalMeanActualMinutes =
      rows.reduce((sum, r) => sum + r.actualMinutes, 0) / rows.length;

    const typeAverages = this.computeSmoothedTypeAverages(
      rows,
      globalMeanActualMinutes,
    );

    const rawFeatureRows = rows.map((r) => [
      DIFFICULTY_WEIGHT[r.difficulty],
      r.weightPercentage ?? 0,
      r.estimatedMinutes ?? 0,
      typeAverages.get(r.taskTypeId) ?? globalMeanActualMinutes,
    ]);

    const featureScalers: Scaler[] = [0, 1, 2, 3].map((col) =>
      fitScaler(rawFeatureRows.map((row) => row[col])),
    );
    const scaledFeatureRows = rawFeatureRows.map((row) =>
      row.map((value, col) => applyScaler(value, featureScalers[col])),
    );
    const targets = rows.map((r) => r.actualMinutes);

    if (method === 'linear_regression') {
      const X = scaledFeatureRows.map((row) => [1, ...row]);
      const beta = solveOls(X, targets);
      const predict = (rawFeatures: number[]) => {
        const scaled = rawFeatures.map((v, i) =>
          applyScaler(v, featureScalers[i]),
        );
        return beta[0] + scaled.reduce((sum, v, i) => sum + v * beta[i + 1], 0);
      };
      return {
        method: 'linear_regression',
        trainedAtSampleSize: sampleSize,
        featureScalers,
        targetScaler: null,
        typeAverages,
        globalMeanActualMinutes,
        predict,
      };
    }

    // method === 'mlp'. tfjs-node tem bindings nativos - se a instalação
    // no ambiente de deploy falhar (ver PREDICTION_SETUP.md), cai-se para
    // regressão linear em vez de rebentar o pedido com 500.
    try {
      const targetScaler = fitScaler(targets);
      const scaledTargets = targets.map((t) => applyScaler(t, targetScaler));
      const trained = await trainMlp(scaledFeatureRows, scaledTargets);
      const predict = (rawFeatures: number[]) => {
        const scaled = rawFeatures.map((v, i) =>
          applyScaler(v, featureScalers[i]),
        );
        return invertScaler(trained.predict(scaled), targetScaler);
      };
      return {
        method: 'mlp',
        trainedAtSampleSize: sampleSize,
        featureScalers,
        targetScaler,
        typeAverages,
        globalMeanActualMinutes,
        predict,
      };
    } catch (error) {
      this.logger.warn(
        `MLP training failed (falling back to linear regression): ${(error as Error).message}`,
      );
      const X = scaledFeatureRows.map((row) => [1, ...row]);
      const beta = solveOls(X, targets);
      const predict = (rawFeatures: number[]) => {
        const scaled = rawFeatures.map((v, i) =>
          applyScaler(v, featureScalers[i]),
        );
        return beta[0] + scaled.reduce((sum, v, i) => sum + v * beta[i + 1], 0);
      };
      return {
        method: 'linear_regression',
        trainedAtSampleSize: sampleSize,
        featureScalers,
        targetScaler: null,
        typeAverages,
        globalMeanActualMinutes,
        predict,
      };
    }
  }

  private computeSmoothedTypeAverages(
    rows: TrainingRow[],
    globalMeanActualMinutes: number,
  ): Map<string, number> {
    const sumByType = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      const entry = sumByType.get(row.taskTypeId) ?? { sum: 0, count: 0 };
      entry.sum += row.actualMinutes;
      entry.count += 1;
      sumByType.set(row.taskTypeId, entry);
    }

    const typeAverages = new Map<string, number>();
    for (const [taskTypeId, { sum, count }] of sumByType) {
      typeAverages.set(
        taskTypeId,
        (sum + TYPE_AVERAGE_SMOOTHING_K * globalMeanActualMinutes) /
          (count + TYPE_AVERAGE_SMOOTHING_K),
      );
    }
    return typeAverages;
  }

  /**
   * Tasks do user com pelo menos uma StudySession terminada, convertidas
   * em linhas de treino (actualMinutes = soma dessas sessões). Tasks sem
   * nenhuma sessão terminada nunca entram no treino - não há label real
   * para elas.
   */
  private async loadTrainingRows(userId: string): Promise<TrainingRow[]> {
    const tasks: TrainingTask[] = await this.prisma.task.findMany({
      where: { userId, studySessions: { some: { endedAt: { not: null } } } },
      select: TRAINING_SELECT,
    });

    const rows: TrainingRow[] = [];
    for (const task of tasks) {
      const actualMinutes = this.sumSessionMinutes(task.studySessions);
      if (actualMinutes <= 0) continue;
      rows.push({
        taskTypeId: task.taskTypeId,
        difficulty: task.difficulty,
        weightPercentage: task.weightPercentage,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes,
      });
    }
    return rows;
  }

  private async computeActualMinutesForTask(
    userId: string,
    taskId: string,
  ): Promise<number | null> {
    // Consulta sempre feita de fresco (nunca a partir da cache do modelo)
    // - uma sessão pode ter terminado agora mesmo, e o detail view deve
    // refletir isso de imediato.
    const sessions = await this.prisma.studySession.findMany({
      where: { userId, taskId, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    });
    if (sessions.length === 0) return null;
    return this.sumSessionMinutes(sessions);
  }

  private sumSessionMinutes(
    sessions: { startedAt: Date; endedAt: Date | null }[],
  ): number {
    let total = 0;
    for (const session of sessions) {
      if (!session.endedAt) continue; // já filtrado pelo where, só para o TS
      total +=
        (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;
    }
    return Math.round(Math.max(0, total));
  }

  private async resolveTaskTypeId(typeKey: string): Promise<string> {
    const taskType = await this.prisma.taskType.findUnique({
      where: { key: typeKey },
    });
    if (!taskType || !taskType.isActive) {
      throw new BadRequestException(
        `Task type "${typeKey}" invalid or inactive.`,
      );
    }
    return taskType.id;
  }
}
