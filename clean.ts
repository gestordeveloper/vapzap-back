import { prisma } from './src/prisma';

async function clean() {
  const lids = await prisma.chat.findMany({
    where: { remoteJid: { contains: '@lid' } }
  });
  console.log('Found ' + lids.length + ' LID chats');
  for (const c of lids) {
    await prisma.chat.delete({ where: { id: c.id } });
  }
  console.log('Cleaned up LID chats');
}

clean().catch(console.error).finally(()=>prisma.$disconnect());
