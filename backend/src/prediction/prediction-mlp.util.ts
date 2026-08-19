// MLP pequena para a feature de previsão de duração, usada só quando o
// user já tem dados de treino suficientes (ver PREDICTION_THRESHOLDS em
// prediction.service.ts).
//
// @tensorflow/tfjs-node é importado DINAMICAMENTE aqui dentro, nunca no
// topo do ficheiro - é exatamente por isto que se torna arriscado usar
// tfjs-node (bindings nativos C++) em vez do tfjs puro (ver a nota de
// `npm install` em PREDICTION_SETUP.md): se o import estivesse no topo e
// os bindings falhassem a carregar num ambiente de deploy (Render sem a
// imagem certa), TODO o boot do Nest cairia, não só esta feature. Com o
// import dinâmico, uma falha aqui só rebenta esta chamada em concreto -
// PredictionService apanha o erro e cai para regressão linear em vez de
// derrubar o backend inteiro.

type TFModule = typeof import('@tensorflow/tfjs-node');

export interface TrainedMlp {
  predict: (features: number[]) => number;
}

const EPOCHS = 200;
const LEARNING_RATE = 0.05;

export async function trainMlp(
  X: number[][],
  y: number[],
): Promise<TrainedMlp> {
  const tf: TFModule = await import('@tensorflow/tfjs-node');

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
