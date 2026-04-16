import { prisma } from './src/prisma';
import fs from 'fs';

async function checkSentAudio() {
  const msgs = await prisma.message.findMany({
    where: { fromMe: true, type: 'audio' },
    orderBy: { timestamp: 'desc' },
    take: 3
  });
  console.log('Recent sent audios:');
  console.dir(msgs, { depth: null });
}

checkSentAudio().catch(console.error).finally(()=>prisma.$disconnect());
