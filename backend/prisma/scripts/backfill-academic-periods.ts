// scripts/backfill-academic-periods.ts
//
// Corre isto DEPOIS do `prisma migrate dev --name add_academic_programs_and_periods`
// e ANTES de tornar Task.periodId obrigatório no schema.
//
// Por cada user sem activePeriodId ainda: cria um AcademicProgram "Geral" +
// um AcademicPeriod default, associa todas as Tasks desse user (que ainda
// não tenham periodId) a esse período, e marca-o como dashboard ativo.
//
// Idempotente: um user que já tenha activePeriodId definido é ignorado -
// dá para correr este script várias vezes (ex: novo deploy) sem duplicar
// programas.
//
// Correr com: npx ts-node scripts/backfill-academic-periods.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { activePeriodId: null },
    select: { id: true, createdAt: true },
  });

  console.log(`A processar ${users.length} user(s) sem período ativo...`);

  let migrated = 0;
  for (const user of users) {
    try {
      await prisma.$transaction(async (tx) => {
        // Data mais antiga entre as tasks do user (fallback: data de
        // registo). Area é global (sem userId/createdAt), por isso não dá
        // para derivar isto a partir das Areas do user.
        const earliestTask = await tx.task.findFirst({
          where: { userId: user.id },
          orderBy: { date: 'asc' },
          select: { date: true },
        });
        const startDate = earliestTask?.date ?? user.createdAt;

        const program = await tx.academicProgram.create({
          data: { userId: user.id, name: 'Geral' },
        });

        const period = await tx.academicPeriod.create({
          data: {
            programId: program.id,
            name: 'Antes da organização por período',
            startDate,
          },
        });

        // Só tasks que ainda não têm período (evita reatribuir nada numa
        // segunda corrida do script).
        await tx.task.updateMany({
          where: { userId: user.id, periodId: null },
          data: { periodId: period.id },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { activeProgramId: program.id, activePeriodId: period.id },
        });
      });
      migrated++;
    } catch (err) {
      // Um user a falhar não pode travar os restantes - regista e segue
      // em frente, corre o script outra vez no fim para apanhar os que
      // faltaram (é idempotente).
      console.error(`Falhou para o user ${user.id}:`, err);
    }
  }

  console.log(`Concluído: ${migrated}/${users.length} user(s) migrados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
