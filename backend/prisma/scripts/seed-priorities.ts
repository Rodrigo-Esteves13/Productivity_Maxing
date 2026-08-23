import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const priorities = [
    { key: 'LOW', label: 'Low', order: 1, colorHex: '#64748b' },
    { key: 'MEDIUM', label: 'Medium', order: 2, colorHex: '#a3a3a3' },
    { key: 'HIGH', label: 'High', order: 3, colorHex: '#ef4444' },
  ];
  for (const p of priorities) {
    await prisma.priority.upsert({ where: { key: p.key }, update: {}, create: p });
  }

  console.log('Priority seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
