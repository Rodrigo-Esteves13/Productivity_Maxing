import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const academico = await prisma.taskType.upsert({
    where: { key: 'ACADEMICO' },
    update: {},
    create: { key: 'ACADEMICO', label: 'Académico', order: 1, colorHex: '#8b5cf6' },
  });

  const outrosTipos = [
    { key: 'HABITO', label: 'Hábito', order: 2, colorHex: '#22c55e' },
    { key: 'PROJETO', label: 'Projeto', order: 3, colorHex: '#3b82f6' },
    { key: 'EVENTO', label: 'Evento', order: 4, colorHex: '#f59e0b' },
    { key: 'TRABALHO', label: 'Trabalho', order: 5, colorHex: '#ef4444' },
    { key: 'TAREFA_SIMPLES', label: 'Tarefa Simples', order: 6, colorHex: '#6b7280' },
  ];
  for (const t of outrosTipos) {
    await prisma.taskType.upsert({ where: { key: t.key }, update: {}, create: t });
  }

  const academicTypes = [
    { key: 'FREQUENCIA', label: 'Frequência', order: 1 },
    { key: 'TRABALHO_PRATICO', label: 'Trabalho Prático', order: 2 },
    { key: 'TAREFA_SECUNDARIA', label: 'Tarefa Secundária', order: 3 },
  ];
  for (const t of academicTypes) {
    await prisma.academicTaskType.upsert({
      where: { key: t.key },
      update: {},
      create: { ...t, taskTypeId: academico.id },
    });
  }

  console.log('Seed de TaskType/AcademicTaskType concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
