const fs = require('fs');
let content = fs.readFileSync('src/services/chat.service.ts', 'utf8');

content = content.replace(
  /const rawRemoteJid = msg\.key\.remoteJidAlt \|\| msg\.key\.remoteJid!;/g,
  `if (msg.key.remoteJid?.includes('243') || msg.key.remoteJid?.includes('5543')) {
          console.log('[DEBUG LID] Incoming message key:', JSON.stringify(msg.key, null, 2));
      }
      const rawRemoteJid = msg.key.remoteJidAlt || msg.key.remoteJid!;`
);

fs.writeFileSync('src/services/chat.service.ts', content);
console.log('Successfully patched chat.service.ts via Regex');
