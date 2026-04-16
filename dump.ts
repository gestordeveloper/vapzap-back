import { prisma } from './src/prisma';
import { WhatsAppService } from './src/services/whatsapp.service';

// Mock interceptor for testing
async function testMessage() {
   // Assuming instance 'suporte' is connected
   const sock = WhatsAppService.getSession('suporte');
   if (!sock) return console.log('Suporte not connected. Start the API and connect first.');

   const jid = '554388367150@s.whatsapp.net';
   console.log('Sending message to', jid);
   const result = await sock.sendMessage(jid, { text: 'Test debug lid' });
   console.log('Result object from Baileys:');
   console.dir(result, { depth: null });
}

testMessage().catch(console.error);
