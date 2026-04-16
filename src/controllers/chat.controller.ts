import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prisma';
import { ChatService } from '../services/chat.service';
import { WhatsAppService } from '../services/whatsapp.service';
import fs from 'fs';
import path from 'path';

export class ChatController {
  
  static async listChats(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const user = request.user as { id: string };

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const chats = await ChatService.listChats(name);
      return reply.send({ success: true, chats });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch chats', details: e.message });
    }
  }

  static async listAllChats(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string };

    try {
      const chats = await ChatService.listAllChats(user.id);
      return reply.send({ success: true, chats });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch all chats', details: e.message });
    }
  }

  static async listMessages(request: FastifyRequest, reply: FastifyReply) {
    const { name, remoteJid } = request.params as { name: string, remoteJid: string };
    const limit = Number((request.query as any).limit) || 50;
    const user = request.user as { id: string };

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const messages = await ChatService.listMessages(name, remoteJid, limit);
      return reply.send({ success: true, messages });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch messages', details: e.message });
    }
  }

  static async getMedia(request: FastifyRequest, reply: FastifyReply) {
    const { name, fileName } = request.params as { name: string, fileName: string };
    
    try {
      const filePath = path.join(process.cwd(), 'sessions', name, 'media', fileName);
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: 'Media not found' });
      }

      const stream = fs.createReadStream(filePath);
      return reply.type(ChatController.getMimeType(fileName)).send(stream);
    } catch (e: any) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  }

  private static getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  static async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const user = request.user as { id: string };

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      if (!request.isMultipart()) {
         return reply.status(400).send({ error: 'Request is not multipart' });
      }

      let number = '';
      let text = '';
      let fileBuffer: Buffer | null = null;
      let mimetype = '';
      let originalFileName = '';

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer();
          mimetype = part.mimetype;
          originalFileName = part.filename;
        } else {
          // Fields
          if (part.fieldname === 'number') number = part.value as string;
          if (part.fieldname === 'text') text = part.value as string;
        }
      }

      if (!number) return reply.status(400).send({ error: 'Number is required' });

      let result;
      const sock = WhatsAppService.getSession(name);
      if (!sock) return reply.status(400).send({ error: 'Instance not connected' });
      
      const jid = await WhatsAppService.formatJid(sock, number);

      if (fileBuffer) {
        if (mimetype.startsWith('image/')) {
          result = await sock.sendMessage(jid, { image: fileBuffer, caption: text });
        } else if (mimetype.startsWith('video/')) {
          result = await sock.sendMessage(jid, { video: fileBuffer, caption: text });
        } else if (mimetype.startsWith('audio/')) {
          result = await sock.sendMessage(jid, { audio: fileBuffer, mimetype: 'audio/mp4', ptt: true });
        } else {
          result = await sock.sendMessage(jid, { document: fileBuffer, mimetype, fileName: originalFileName, caption: text });
        }
      } else {
        if (!text) return reply.status(400).send({ error: 'Text or file is required' });
        result = await sock.sendMessage(jid, { text });
      }

      // Automatically mock an incoming 'append' event so ChatService saves our outbound message
      if (result) {
         try {
           // If it's a media message, Baileys `downloadMediaMessage` won't work on the outbound result object
           // So we save the file buffer directly to disk right now and inject a custom media path
           let savedMediaUrl = undefined;
           if (fileBuffer && result.key.id) {
              const mediaDir = path.join(process.cwd(), 'sessions', name, 'media');
              if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
              
              let ext = 'bin';
              if (mimetype) {
                if (mimetype.includes('image/jpeg')) ext = 'jpg';
                else if (mimetype.includes('image/png')) ext = 'png';
                else if (mimetype.includes('image/webp')) ext = 'webp';
                else if (mimetype.includes('video/mp4')) ext = 'mp4';
                else if (mimetype.includes('audio/ogg')) ext = 'ogg';
                else if (mimetype.includes('audio/mp4')) ext = 'mp3';
                else ext = mimetype.split('/')[1]?.split(';')[0] || 'bin';
              }
              const fileName = `${result.key.id}.${ext}`;
              const filePath = path.join(mediaDir, fileName);
              fs.writeFileSync(filePath, fileBuffer);
              savedMediaUrl = `sessions/${name}/media/${fileName}`;
           }

           const mockMessageEvent = {
              type: 'append',
              messages: [{
                 ...result,
                 key: {
                    ...result.key,
                    fromMe: true
                 },
                 // Inject the local media URL we just saved so ChatService can just use it
                 _localMediaUrl: savedMediaUrl
              }]
           };
           await ChatService.handleIncomingMessage(name, mockMessageEvent);
         } catch (e) {
           console.error('[ChatController] Failed to persist outgoing message locally:', e);
         }
      }

      return reply.send({ success: true, message: 'Message sent', result });

    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to send message', details: e.message });
    }
  }
}
