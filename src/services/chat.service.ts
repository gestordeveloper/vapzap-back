import { prisma } from '../prisma';
import { downloadMediaMessage, getContentType, jidNormalizedUser } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { WhatsAppService } from './whatsapp.service';

export class ChatService {
  static async handleIncomingMessage(instanceName: string, m: any) {
    if (m.type !== 'notify' && m.type !== 'append') return;

    for (const msg of m.messages) {
      if (!msg.message) continue;

      if (msg.key.remoteJid?.includes('243') || msg.key.remoteJid?.includes('5543')) {
          console.log('[DEBUG LID] Incoming message key:', JSON.stringify(msg.key, null, 2));
      }
      const rawRemoteJid = msg.key.remoteJidAlt || msg.key.remoteJid!;
      const remoteJid = jidNormalizedUser(rawRemoteJid);
      const messageId = msg.key.id!;
      const fromMe = msg.key.fromMe || false;
      const pushName = msg.pushName || '';
      const isGroup = remoteJid.includes('@g.us') || msg.key.remoteJid?.includes('@g.us');
      
      const instance = await prisma.instance.findUnique({ where: { name: instanceName } });
      if (!instance) continue;

      let chatName = isGroup ? undefined : (pushName || undefined);
      let profilePicUrl = null;
      let participantJid = undefined;
      let participantName = undefined;
      let participantThumb = null;

      try {
        const sock = WhatsAppService.getSession(instanceName);
        if (sock) {
          if (isGroup) {
            participantJid = msg.key.participant || undefined;
            participantName = pushName || undefined;

            try {
               const groupMetadata = await sock.groupMetadata(remoteJid);
               chatName = groupMetadata.subject;
            } catch (e) {}
            
            try {
               profilePicUrl = await sock.profilePictureUrl(remoteJid, 'image');
            } catch (e) {}

            if (participantJid) {
               try {
                 participantThumb = await sock.profilePictureUrl(participantJid, 'image');
               } catch (e) {}
            }
          } else {
             try {
               profilePicUrl = await sock.profilePictureUrl(remoteJid, 'image');
             } catch (e) {}
          }
        }
      } catch (err) {
        // Ignore errors if profile picture is not public or not found
      }

      // Extract content
      const messageType = getContentType(msg.message);
      let text = '';
      let type = 'unknown';
      let mediaUrl = null;
      let mimetype = null;

      if (messageType === 'conversation') {
        text = msg.message.conversation || '';
        type = 'text';
      } else if (messageType === 'extendedTextMessage') {
        text = msg.message.extendedTextMessage?.text || '';
        type = 'text';
      } else if (messageType === 'imageMessage') {
        type = 'image';
        mimetype = msg.message.imageMessage?.mimetype;
        text = msg.message.imageMessage?.caption || '';
      } else if (messageType === 'videoMessage') {
        type = 'video';
        mimetype = msg.message.videoMessage?.mimetype;
        text = msg.message.videoMessage?.caption || '';
      } else if (messageType === 'audioMessage') {
        type = 'audio';
        mimetype = msg.message.audioMessage?.mimetype;
      } else if (messageType === 'documentMessage') {
        type = 'document';
        mimetype = msg.message.documentMessage?.mimetype;
        text = msg.message.documentMessage?.fileName || '';
      } else if (messageType === 'stickerMessage') {
        type = 'sticker';
        mimetype = msg.message.stickerMessage?.mimetype;
      } else {
        // Fallback for other message types (e.g. protocolMessage, contactsArrayMessage)
        continue; // Or save as 'unsupported'
      }

      // Download media if applicable
    if (msg._localMediaUrl) {
      mediaUrl = msg._localMediaUrl;
    } else if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
        try {
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { 
              logger: require('pino')({ level: 'silent' }),
              reuploadRequest: (msg: any) => new Promise((resolve) => resolve(msg)) 
            }
          );
          
          if (buffer) {
            const mediaDir = path.join(process.cwd(), 'sessions', instanceName, 'media');
            if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
            
            // derive extension from mimetype or default to bin
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
            const fileName = `${messageId}.${ext}`;
            const filePath = path.join(mediaDir, fileName);
            fs.writeFileSync(filePath, buffer);
            mediaUrl = `sessions/${instanceName}/media/${fileName}`;
          }
        } catch (err) {
          console.error(`[ChatService] Failed to download media for message ${messageId}:`, err);
        }
      }

      // Upsert Chat
      const chat = await prisma.chat.upsert({
        where: {
          instanceId_remoteJid: {
            instanceId: instance.id,
            remoteJid: remoteJid
          }
        },
        update: {
          name: chatName || undefined,
          profilePicUrl: profilePicUrl || undefined,
          lastMessageAt: new Date(),
          unreadCount: fromMe ? 0 : { increment: 1 }
        },
        create: {
          instanceId: instance.id,
          remoteJid: remoteJid,
          name: chatName,
          profilePicUrl: profilePicUrl,
          unreadCount: fromMe ? 0 : 1,
          lastMessageAt: new Date()
        }
      });

      // Insert Message
      await prisma.message.upsert({
        where: {
          chatId_messageId: {
            chatId: chat.id,
            messageId: messageId
          }
        },
        update: {},
        create: {
          chatId: chat.id,
          messageId: messageId,
          text: text,
          type: type,
          mediaUrl: mediaUrl,
          mimetype: mimetype,
          fromMe: fromMe,
          participant: participantJid,
          participantName: participantName,
          participantThumb: participantThumb,
          timestamp: new Date((msg.messageTimestamp as number) * 1000 || Date.now()),
          status: fromMe ? 'SENT' : 'DELIVERED'
        }
      });
    }
  }

  static async listChats(instanceName: string) {
    const instance = await prisma.instance.findUnique({ where: { name: instanceName } });
    if (!instance) throw new Error('Instance not found');

    return await prisma.chat.findMany({
      where: { instanceId: instance.id },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });
  }

  static async listAllChats(userId: string) {
    return await prisma.chat.findMany({
      where: { instance: { userId: userId } },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        instance: { select: { name: true } },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });
  }

  static async listMessages(instanceName: string, remoteJid: string, limit = 50) {
    const instance = await prisma.instance.findUnique({ where: { name: instanceName } });
    if (!instance) throw new Error('Instance not found');

    const chat = await prisma.chat.findUnique({
      where: {
        instanceId_remoteJid: {
          instanceId: instance.id,
          remoteJid: remoteJid
        }
      }
    });

    if (!chat) return [];

    // Reset unread count when fetching messages
    await prisma.chat.update({
      where: { id: chat.id },
      data: { unreadCount: 0 }
    });

    return await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { timestamp: 'asc' },
      take: limit
    });
  }
}
