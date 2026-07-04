-- Adiciona o novo valor "COMPLETED" ao enum ProgressStatus existente.
-- Nota: no Postgres, ALTER TYPE ... ADD VALUE não pode correr dentro da
-- mesma transação que outros comandos que já usem esse tipo, por isso
-- este ficheiro fica isolado na sua própria migration (é o que o
-- `prisma migrate dev` já teria gerado sozinho).
ALTER TYPE "ProgressStatus" ADD VALUE 'COMPLETED';
