const fs = require('fs');
let content = fs.readFileSync('src/services/chat.service.ts', 'utf8');

// Use regex to find the start of the media download block
content = content.replace(
  /\/\/ Download media if applicable\s+if \(\['image', 'video', 'audio', 'document', 'sticker'\]\.includes\(type\)\) \{/,
  `// Download media if applicable
    if (msg._localMediaUrl) {
      mediaUrl = msg._localMediaUrl;
    } else if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {`
);

fs.writeFileSync('src/services/chat.service.ts', content);
console.log('Successfully patched chat.service.ts via Regex');
