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
import {
  fitScaler,
  applyScaler,
  invertScaler,
  solveOls,
} from './prediction-math.util';
import type { Scaler } from './prediction-math.util';
import { trainMlp } from './prediction-mlp.util';
import {
  hasStudyTimeWhere,
  resolveStudyMinutes,
  sumSessionMinutes,
} from '../common/session-minutes.util';
import {
  NEUTRAL_INTERVAL,
  computeRatioInterval,
  keepIndicesWithoutUpperOutliers,
} from './prediction-stats.util';
import type { RatioInterval } from './prediction-stats.util';
import type {
  DurationPrediction,
  PredictionMethod,
  EstimationAccuracy,
} from './prediction.types';

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
// Igual ao anterior, mas por Area (a disciplina): uma cadeira "pesada"
// tende a pedir mais tempo seja qual for o tipo de task, e isso o TaskType
// sozinho não apanha. K maior que o do tipo porque há mais Areas do que
// tipos, cada uma com menos tasks.
const AREA_AVERAGE_SMOOTHING_K = 4;
// Piso da previsão usada para calcular rácios e intervalos (evita
// divisões por valores ~0 ou negativos de uma regressão mal comportada).
const MIN_PREDICTED_MINUTES = 5;
// Dentro disto (para qualquer lado) conta como "estimativa acertada" em
// getEstimationAccuracy - sem alguma margem, praticamente nenhuma
// estimativa manual bateria certo ao minuto e accurateCount seria sempre
// ~0, o que não diz nada de útil ao Rodrigo.
const ESTIMATION_ACCURACY_TOLERANCE_PCT = 20;
// Calibração das estimativas manuais: só entram tasks CONCLUÍDAS (numa
// task em curso o tempo real ainda está incompleto e puxaria o fator para
// baixo) e só com amostra suficiente para não ser ruído.
const MIN_SAMPLES_FOR_CALIBRATION = 3;
// Um fator fora disto quase de certeza vem de dados estranhos (ex: uma
// sessão esquecida ligada), não de um viés real de estimativa.
const CALIBRATION_FACTOR_MIN = 0.5;
const CALIBRATION_FACTOR_MAX = 2.5;
const CALIBRATION_DECIMALS = 100;

const TRAINING_SELECT = {
  id: true,
  taskTypeId: true,
  areaId: true,
  difficulty: true,
  weightPercentage: true,
  estimatedMinutes: true,
  recalledStudyMinutes: true,
  studySessions: {
    where: { endedAt: { not: null } },
    select: { startedAt: true, endedAt: true },
  },
} satisfies Prisma.TaskSelect;

type TrainingTask = Prisma.TaskGetPayload<{ select: typeof TRAINING_SELECT }>;

interface TrainingRow {
  taskTypeId: string;
  areaId: string;
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
  areaAverages: Map<string, number>;
  interval: RatioInterval;
  trimmedSamples: number;
  globalMeanActualMinutes: number;
  predict: (rawFeatures: number[]) => number;
}

interface ModelResult {
  method: PredictionMethod;
  sampleSize: number;
  typeAverages: Map<string, number>;
  areaAverages: Map<string, number>;
  interval: RatioInterval;
  trimmedSamples: number;
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
    let ownedTask: {
      estimatedMinutes: number | null;
      areaId: string;
    } | null = null;
    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, userId },
        select: { estimatedMinutes: true, areaId: true },
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
        rangeMinutes: null,
        trimmedSamples: model.trimmedSamples,
        method: 'insufficient_data',
        sampleSize: model.sampleSize,
        actualMinutes,
      };
    }

    const rawFeatures = this.buildRawFeatures(
      {
        difficulty: dto.difficulty,
        weightPercentage: dto.weightPercentage ?? null,
        estimatedMinutes: ownedTask?.estimatedMinutes ?? null,
        taskTypeId,
        // Numa task ainda por criar não há Area: cai na média global.
        areaId: ownedTask?.areaId ?? dto.areaId ?? null,
      },
      model,
    );

    const predictedRaw = model.predict(rawFeatures);
    const predictedMinutes = Math.max(0, Math.round(predictedRaw));

    return {
      predictedMinutes,
      rangeMinutes: this.toRange(predictedMinutes, model.interval),
      trimmedSamples: model.trimmedSamples,
      method: model.method,
      sampleSize: model.sampleSize,
      actualMinutes,
    };
  }

  /**
   * Fator multiplicativo que corrige o viés das estimativas manuais do
   * próprio utilizador: soma do tempo real / soma do estimado, sobre
   * tasks concluídas. 1.3 = costuma demorar 30% mais do que estima.
   * null quando ainda não há amostra suficiente. Somas em vez de média
   * de rácios: uma task minúscula com rácio absurdo não domina o fator.
   */
  async getCalibrationFactor(userId: string): Promise<number | null> {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        progressStatus: 'COMPLETED',
        estimatedMinutes: { gt: 0 },
        AND: [hasStudyTimeWhere()],
      },
      select: {
        estimatedMinutes: true,
        recalledStudyMinutes: true,
        studySessions: {
          where: { endedAt: { not: null } },
          select: { startedAt: true, endedAt: true },
        },
      },
    });

    let sumEstimated = 0;
    let sumActual = 0;
    let samples = 0;
    for (const task of tasks) {
      const actual = resolveStudyMinutes(
        task.studySessions,
        task.recalledStudyMinutes,
      );
      if (actual <= 0 || !task.estimatedMinutes) continue;
      sumEstimated += task.estimatedMinutes;
      sumActual += actual;
      samples += 1;
    }

    if (samples < MIN_SAMPLES_FOR_CALIBRATION || sumEstimated <= 0) return null;

    const raw = sumActual / sumEstimated;
    const clamped = Math.min(
      CALIBRATION_FACTOR_MAX,
      Math.max(CALIBRATION_FACTOR_MIN, raw),
    );
    return Math.round(clamped * CALIBRATION_DECIMALS) / CALIBRATION_DECIMALS;
  }

  /**
   * Previsão de duração em lote para o plano de estudo: treina/reutiliza
   * o modelo do utilizador UMA vez e prevê todas as tasks pedidas (em vez
   * de N chamadas a predictDuration, cada uma a recarregar os dados de
   * treino). O chamador já filtrou para tasks do próprio utilizador.
   */
  async predictForTasks(
    userId: string,
    tasks: {
      id: string;
      taskTypeId: string;
      areaId: string;
      difficulty: keyof typeof DIFFICULTY_WEIGHT;
      weightPercentage: number | null;
    }[],
  ): Promise<{
    method: PredictionMethod;
    minutesByTaskId: Map<string, number>;
  }> {
    const minutesByTaskId = new Map<string, number>();
    if (tasks.length === 0) {
      return { method: 'insufficient_data', minutesByTaskId };
    }

    const model = await this.getOrTrainModel(userId);
    if (model.method === 'insufficient_data' || !model.predict) {
      return { method: model.method, minutesByTaskId };
    }

    for (const task of tasks) {
      const predicted = model.predict(
        this.buildRawFeatures(
          {
            difficulty: task.difficulty,
            weightPercentage: task.weightPercentage,
            estimatedMinutes: null, // sem estimativa manual: é para estas que se prevê
            taskTypeId: task.taskTypeId,
            areaId: task.areaId,
          },
          model,
        ),
      );
      if (Number.isFinite(predicted) && predicted > 0) {
        minutesByTaskId.set(task.id, Math.round(predicted));
      }
    }
    return { method: model.method, minutesByTaskId };
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
    const { rows, trimmedSamples } = await this.loadTrainingRows(userId);
    const sampleSize = rows.length;
    const method = this.decideMethod(sampleSize);

    if (method === 'insufficient_data') {
      return {
        method,
        sampleSize,
        typeAverages: new Map(),
        areaAverages: new Map(),
        interval: NEUTRAL_INTERVAL,
        trimmedSamples: 0,
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
        areaAverages: cached.areaAverages,
        interval: cached.interval,
        trimmedSamples: cached.trimmedSamples,
        globalMeanActualMinutes: cached.globalMeanActualMinutes,
        predict: cached.predict,
      };
    }

    const trained = await this.trainModel(
      method,
      rows,
      sampleSize,
      trimmedSamples,
    );
    this.modelCache.set(userId, trained);

    return {
      method: trained.method,
      sampleSize,
      typeAverages: trained.typeAverages,
      areaAverages: trained.areaAverages,
      interval: trained.interval,
      trimmedSamples: trained.trimmedSamples,
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
    trimmedSamples: number,
  ): Promise<CachedModel> {
    const core = await this.trainCore(method, rows, sampleSize);

    // Intervalo a partir de quanto o real se desviou do previsto no treino.
    const predictions = rows.map((row) =>
      Math.max(
        MIN_PREDICTED_MINUTES,
        core.predict(this.buildRawFeatures(row, core)),
      ),
    );
    const interval = computeRatioInterval(
      rows.map((row) => row.actualMinutes),
      predictions,
    );

    return { ...core, interval, trimmedSamples };
  }

  // Features na MESMA ordem usada no treino e nas previsões. Uma única
  // função para as duas pontas evita que treino e previsão divirjam.
  private buildRawFeatures(
    input: {
      difficulty: keyof typeof DIFFICULTY_WEIGHT;
      weightPercentage: number | null;
      estimatedMinutes: number | null;
      taskTypeId: string;
      areaId: string | null;
    },
    model: Pick<
      CachedModel,
      'typeAverages' | 'areaAverages' | 'globalMeanActualMinutes'
    >,
  ): number[] {
    return [
      DIFFICULTY_WEIGHT[input.difficulty],
      input.weightPercentage ?? 0,
      input.estimatedMinutes ?? 0,
      model.typeAverages.get(input.taskTypeId) ?? model.globalMeanActualMinutes,
      (input.areaId ? model.areaAverages.get(input.areaId) : undefined) ??
        model.globalMeanActualMinutes,
    ];
  }

  private async trainCore(
    method: 'linear_regression' | 'mlp',
    rows: TrainingRow[],
    sampleSize: number,
  ): Promise<CachedModel> {
    const globalMeanActualMinutes =
      rows.reduce((sum, r) => sum + r.actualMinutes, 0) / rows.length;

    const typeAverages = this.computeSmoothedAverages(
      rows,
      (row) => row.taskTypeId,
      globalMeanActualMinutes,
      TYPE_AVERAGE_SMOOTHING_K,
    );
    const areaAverages = this.computeSmoothedAverages(
      rows,
      (row) => row.areaId,
      globalMeanActualMinutes,
      AREA_AVERAGE_SMOOTHING_K,
    );

    const rawFeatureRows = rows.map((r) =>
      this.buildRawFeatures(r, {
        typeAverages,
        areaAverages,
        globalMeanActualMinutes,
      }),
    );

    const featureScalers: Scaler[] = rawFeatureRows[0].map((_, col) =>
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
        areaAverages,
        interval: NEUTRAL_INTERVAL,
        trimmedSamples: 0,
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
        areaAverages,
        interval: NEUTRAL_INTERVAL,
        trimmedSamples: 0,
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
        areaAverages,
        interval: NEUTRAL_INTERVAL,
        trimmedSamples: 0,
        globalMeanActualMinutes,
        predict,
      };
    }
  }

  private computeSmoothedAverages(
    rows: TrainingRow[],
    keyOf: (row: TrainingRow) => string,
    globalMeanActualMinutes: number,
    smoothingK: number,
  ): Map<string, number> {
    const sumByKey = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      const key = keyOf(row);
      const entry = sumByKey.get(key) ?? { sum: 0, count: 0 };
      entry.sum += row.actualMinutes;
      entry.count += 1;
      sumByKey.set(key, entry);
    }

    const averages = new Map<string, number>();
    for (const [key, { sum, count }] of sumByKey) {
      averages.set(
        key,
        (sum + smoothingK * globalMeanActualMinutes) / (count + smoothingK),
      );
    }
    return averages;
  }

  /**
   * Tasks do user com tempo de estudo conhecido (sessões terminadas, ou o
   * tempo aproximado recordado quando não há sessões), convertidas em
   * linhas de treino. Tasks sem nenhum tempo nunca entram no treino - não
   * há label real para elas.
   */
  private async loadTrainingRows(
    userId: string,
  ): Promise<{ rows: TrainingRow[]; trimmedSamples: number }> {
    const tasks: TrainingTask[] = await this.prisma.task.findMany({
      where: { userId, AND: [hasStudyTimeWhere()] },
      select: TRAINING_SELECT,
    });

    const rows: TrainingRow[] = [];
    for (const task of tasks) {
      const actualMinutes = resolveStudyMinutes(
        task.studySessions,
        task.recalledStudyMinutes,
      );
      if (actualMinutes <= 0) continue;
      rows.push({
        taskTypeId: task.taskTypeId,
        areaId: task.areaId,
        difficulty: task.difficulty,
        weightPercentage: task.weightPercentage,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes,
      });
    }
    // Sessões esquecidas ligadas inflacionam a duração real e ensinam ao
    // modelo que tudo demora horas: fora do treino, mas contadas.
    const keep = new Set(
      keepIndicesWithoutUpperOutliers(rows.map((row) => row.actualMinutes)),
    );
    const cleaned = rows.filter((_, index) => keep.has(index));
    return { rows: cleaned, trimmedSamples: rows.length - cleaned.length };
  }

  /**
   * Historical accuracy of Rodrigo's own manual `estimatedMinutes` against
   * real time logged via StudySession - deliberately separate from
   * getOrTrainModel()/predictDuration() above: those predict a duration
   * going forward, this looks backward at how good the human guess itself
   * has been. Only tasks with both a manual estimate AND at least one
   * finished session qualify - a task with no session yet has nothing to
   * compare against.
   */
  async getEstimationAccuracy(userId: string): Promise<EstimationAccuracy> {
    const tasks = await this.prisma.task.findMany({
      where: { userId, estimatedMinutes: { not: null } },
      select: {
        estimatedMinutes: true,
        recalledStudyMinutes: true,
        studySessions: {
          where: { endedAt: { not: null } },
          select: { startedAt: true, endedAt: true },
        },
      },
    });

    let sampleSize = 0;
    let sumAbsPercentError = 0;
    let sumEstimated = 0;
    let sumActual = 0;
    let accurateCount = 0;
    let overestimatedCount = 0;
    let underestimatedCount = 0;

    for (const task of tasks) {
      const estimated = task.estimatedMinutes as number; // filtrado no where acima
      if (estimated <= 0) continue; // evita divisão por zero abaixo, sem sentido de qualquer forma

      const actual = resolveStudyMinutes(
        task.studySessions,
        task.recalledStudyMinutes,
      );
      if (actual <= 0) continue; // sem tempo conhecido não há com que comparar
      const percentError = (Math.abs(actual - estimated) / estimated) * 100;

      sampleSize += 1;
      sumAbsPercentError += percentError;
      sumEstimated += estimated;
      sumActual += actual;

      if (percentError <= ESTIMATION_ACCURACY_TOLERANCE_PCT) {
        accurateCount += 1;
      } else if (estimated > actual) {
        overestimatedCount += 1;
      } else {
        underestimatedCount += 1;
      }
    }

    if (sampleSize === 0) {
      return {
        sampleSize: 0,
        avgAbsPercentError: null,
        avgEstimatedMinutes: null,
        avgActualMinutes: null,
        accurateCount: 0,
        overestimatedCount: 0,
        underestimatedCount: 0,
      };
    }

    return {
      sampleSize,
      avgAbsPercentError:
        Math.round((sumAbsPercentError / sampleSize) * 10) / 10,
      avgEstimatedMinutes: Math.round(sumEstimated / sampleSize),
      avgActualMinutes: Math.round(sumActual / sampleSize),
      accurateCount,
      overestimatedCount,
      underestimatedCount,
    };
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
    return sumSessionMinutes(sessions);
  }

  private toRange(
    predictedMinutes: number,
    interval: RatioInterval,
  ): { low: number; high: number } | null {
    if (interval.lowRatio === 1 && interval.highRatio === 1) return null;
    return {
      low: Math.max(1, Math.round(predictedMinutes * interval.lowRatio)),
      high: Math.round(predictedMinutes * interval.highRatio),
    };
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
