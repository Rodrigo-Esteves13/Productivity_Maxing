// Geradores de perguntas de calculo (sub-redes, wildcards, OSPF). Codigo da
// app, nunca texto de uma IA: cada pergunta e reconstruida de forma
// deterministica a partir de (tipo, seed), como os GEN do quiz de exemplo
// (ccna_ospf_quiz.html), portados e alargados. O quiz so guarda que tipos de
// gerador estao ligados. Todo o texto passa por `t` (chaves quizGen.<tipo>.*).
// Implementacao nos ficheiros quizGenerator*.ts reexportados abaixo.
export type { GeneratorKind, Translate, Rand, GeneratedQuestion } from './quizGeneratorIds';
export {
  GENERATOR_KINDS,
  GENERATOR_MIN_SEED,
  GENERATOR_MAX_SEED,
  isGeneratorKind,
  generatedId,
  generatorStatKey,
  parseGeneratedId,
  statKeyOf,
  newSeed,
} from './quizGeneratorIds';
export { mulberry32, randInt, pickOne, shuffleWith } from './quizGeneratorRandom';
export type { DrCandidate } from './quizGeneratorNet';
export {
  IPV4_BITS,
  ipToNumber,
  numberToIp,
  prefixMask,
  prefixWildcard,
  blockSize,
  networkOf,
  matchesWildcard,
  toBinaryOctet,
  OSPF_COST_MIN,
  OSPF_COST_MAX,
  ospfCost,
  summarizeNetworks,
  electDrBdr,
} from './quizGeneratorNet';
export { OSPF_DEFAULT_REFERENCE_MBPS } from './quizGeneratorOspf';
export type { SpfPath } from './quizGeneratorSpf';
export { SPF_EDGES, spfPaths } from './quizGeneratorSpf';
export { generateQuestion } from './quizGeneratorBuild';
