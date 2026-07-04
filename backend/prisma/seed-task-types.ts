import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const academic = await prisma.taskType.upsert({
    where: { key: 'ACADEMICO' },
    update: {},
    create: { key: 'ACADEMICO', label: 'Academic', order: 1, colorHex: '#8b5cf6' },
  });

  const otherTypes = [
    { key: 'HABITO', label: 'Habit', order: 2, colorHex: '#22c55e' },
    { key: 'PROJETO', label: 'Project', order: 3, colorHex: '#3b82f6' },
    { key: 'EVENTO', label: 'Event', order: 4, colorHex: '#f59e0b' },
    { key: 'TRABALHO', label: 'Job', order: 5, colorHex: '#ef4444' },
    { key: 'TAREFA_SIMPLES', label: 'Simple Task', order: 6, colorHex: '#6b7280' },
  ];
  for (const t of otherTypes) {
    await prisma.taskType.upsert({ where: { key: t.key }, update: {}, create: t });
  }

  const academicTypes = [
    { key: 'FREQUENCIA', label: 'Test', order: 1 },
    { key: 'TRABALHO_PRATICO', label: 'Practical Assignment', order: 2 },
    { key: 'TAREFA_SECUNDARIA', label: 'Secondary Task', order: 3 },
  ];
  for (const t of academicTypes) {
    await prisma.academicTaskType.upsert({
      where: { key: t.key },
      update: {},
      create: { ...t, taskTypeId: academic.id },
    });
  }

  console.log('TaskType/AcademicTaskType seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
