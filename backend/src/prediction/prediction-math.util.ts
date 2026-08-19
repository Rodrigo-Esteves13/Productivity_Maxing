// Helpers numéricos puros para a feature de previsão de duração (ver
// PredictionService). Sem dependências - escrito à mão em vez de puxar
// uma lib de álgebra linear, porque as matrizes aqui são sempre pequenas
// (nº de features + bias, no máximo 5-6).

export interface Scaler {
  mean: number;
  std: number;
}

// Standardização z-score: (x - mean) / std, com proteção contra uma
// coluna de variância zero (ex: todas as tasks de treino calharem ter
// exatamente a mesma dificuldade) que faria uma divisão por zero.
export function fitScaler(values: number[]): Scaler {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return { mean, std: std > 1e-8 ? std : 1 };
}

export function applyScaler(value: number, scaler: Scaler): number {
  return (value - scaler.mean) / scaler.std;
}

export function invertScaler(scaledValue: number, scaler: Scaler): number {
  return scaledValue * scaler.std + scaler.mean;
}

// Ordinary Least Squares pelas equações normais: beta = (X^T X)^-1 X^T y.
// X já vem com a coluna de bias incluída (um 1 no início de cada linha)
// quando chega aqui. Resolvido por eliminação de Gauss-Jordan sobre a
// matriz aumentada [X^T X | X^T y] - adequado para o nº de features
// sempre pequeno desta feature, NÃO seria a escolha certa para nada de
// dimensão mais alta.
//
// RIDGE_LAMBDA (regularização de Ridge, aplicada à diagonal, excluindo o
// bias): com tão poucas linhas de treino quanto o mínimo de 10 e 5
// colunas (bias + 4 features), X^T X pode ficar quase singular se duas
// features calharem correlacionadas nos dados deste user em concreto
// (ex: todas as tasks HARD também terem weightPercentage alto). Sem
// isto, a eliminação de Gauss-Jordan explodiria ou devolveria
// coeficientes absurdos numa matriz quase singular, em vez de só uma
// previsão pouco precisa.
const RIDGE_LAMBDA = 0.5;

export function solveOls(X: number[][], y: number[]): number[] {
  const numFeatures = X[0].length;

  const XtX: number[][] = Array.from({ length: numFeatures }, () =>
    new Array<number>(numFeatures).fill(0),
  );
  const Xty: number[] = new Array<number>(numFeatures).fill(0);

  for (const row of X) {
    for (let i = 0; i < numFeatures; i++) {
      for (let j = 0; j < numFeatures; j++) {
        XtX[i][j] += row[i] * row[j];
      }
    }
  }
  for (let rowIdx = 0; rowIdx < X.length; rowIdx++) {
    for (let i = 0; i < numFeatures; i++) {
      Xty[i] += X[rowIdx][i] * y[rowIdx];
    }
  }

  for (let i = 1; i < numFeatures; i++) {
    XtX[i][i] += RIDGE_LAMBDA;
  }

  return gaussJordanSolve(XtX, Xty);
}

// Resolve A * beta = b para beta, por eliminação de Gauss-Jordan com
// pivotagem parcial. A matriz de entrada nunca é mutada - trabalha-se
// sempre sobre uma cópia local aumentada [A | b].
function gaussJordanSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) {
        pivotRow = row;
      }
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) {
      // Singular mesmo depois da regularização de Ridge - extremamente
      // improvável dado RIDGE_LAMBDA acima, mas falha em segurança em vez
      // de dividir por quase-zero e devolver coeficientes de lixo.
      throw new Error('Matrix is singular, cannot solve for OLS coefficients.');
    }

    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}
