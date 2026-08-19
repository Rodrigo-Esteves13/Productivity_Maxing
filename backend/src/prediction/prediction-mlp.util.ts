// MLP pequena para a feature de previsão de duração, usada só quando o
// user já tem dados de treino suficientes (ver PREDICTION_THRESHOLDS em
// prediction.service.ts).
//
// @tensorflow/tfjs (versão pura JS/WASM, não tfjs-node) - trocado do
// tfjs-node depois de este introduzir uma vulnerabilidade crítica no
// `npm audit` (arbitrary file write via tar/@mapbox/node-pre-gyp, o
// mecanismo que o tfjs-node usa para ir buscar o binário nativo
// pré-compilado - ver PREDICTION_SETUP.md para o histórico). Sem
// bindings nativos, este pacote não tem essa cadeia de dependências
// nem esse risco de build.
//
// O import continua dinâmico (nunca no topo do ficheiro) mesmo sem o
// risco de bindings nativos - falha isolada aqui (ex: um bug de
// versão) só rebenta esta chamada em concreto, PredictionService apanha
// o erro e cai para regressão linear em vez de arrastar o resto do
// backend.

type TFModule = typeof import('@tensorflow/tfjs');

export interface TrainedMlp {
  predict: (features: number[]) => number;
}

const EPOCHS = 200;
const LEARNING_RATE = 0.05;

export async function trainMlp(
  X: number[][],
  y: number[],
): Promise<TrainedMlp> {
  const tf: TFModule = await import('@tensorflow/tfjs');
  // Sem isto, o tfjs pode tentar arrancar com o backend WebGL (o
  // default em browser) que não existe em Node - tf.ready() garante que
  // fica no backend CPU puro, que é o que este pacote traz por default
  // fora do browser.
  await tf.ready();

  const numFeatures = X[0].length;
  const xTensor = tf.tensor2d(X);
  const yTensor = tf.tensor2d(y.map((v) => [v]));

  // Rede minúscula de propósito: com dezenas (não milhares) de amostras
  // de um único user, uma rede grande só ia decorar o ruído em vez de
  // aprender um padrão generalizável. 4 features -> 8 -> 4 -> 1 já é
  // mais capacidade do que os dados conseguem justificar, mas dá alguma
  // margem para relações não-lineares que a regressão linear (usada
  // abaixo dos MIN_SAMPLES_FOR_MLP amostras) não capta.
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: 8,
      activation: 'relu',
      inputShape: [numFeatures],
    }),
  );
  model.add(tf.layers.dense({ units: 4, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'meanSquaredError',
  });

  await model.fit(xTensor, yTensor, {
    epochs: EPOCHS,
    verbose: 0,
    shuffle: true,
  });

  xTensor.dispose();
  yTensor.dispose();

  return {
    predict: (features: number[]) => {
      const input = tf.tensor2d([features]);
      const output = model.predict(input) as ReturnType<TFModule['tensor2d']>;
      const [value] = output.dataSync();
      input.dispose();
      output.dispose();
      return value;
    },
  };
}
