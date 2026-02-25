import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { WebhookService } from './webhook.service';
import { prisma } from '../prisma';
import fs from 'fs';
import path from 'path';

export class WhatsAppService {
  private static sessions: Map<string, ReturnType<typeof makeWASocket>> = new Map();

  /**
   * Restore all previously connected sessions on server startup.
   */
  static async restoreSessions() {
    const instances = await prisma.instance.findMany({
      where: { status: 'CONNECTED' }
    });
    for (const instance of instances) {
      console.log(`[WhatsApp] Restoring session for instance: ${instance.name}`);
      this.connect(instance.name).catch(console.error);
    }
  }

  /**
   * Initializes and connects a WhatsApp Instance.
   */
  static async connect(instanceName: string): Promise<string | undefined> {
    const sessionDir = path.join(process.cwd(), 'sessions', instanceName);
    
    // Ensure directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
      version,
      auth: state,
      browser: ['VapZap', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      logger: require('pino')({ level: 'silent' }) // Silence noisy logs
    });

    this.sessions.set(instanceName, sock);

    sock.ev.on('creds.update', saveCreds);

    let qrCodeBase64: string | undefined;
    let isResolved = false;

    return new Promise((resolve, reject) => {
      // Timeout to avoid hanging the API request forever for slow instances
      const timeout = setTimeout(() => {
        if (!isResolved) {
           isResolved = true;
           reject(new Error('A geração do QR Code demorou muito. Tente novamente clicando no botão.'));
        }
      }, 25000); // Increased to 25 seconds

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log(`[WhatsApp Debug] Instance ${instanceName} update:`, { connection, qr: !!qr, error: lastDisconnect?.error });

        if (qr && !isResolved) {
          console.log(`[WhatsApp] QR Code received for ${instanceName}`);
          clearTimeout(timeout);
          isResolved = true;
          // Send QR Code to frontend
          try {
             qrCodeBase64 = await QRCode.toDataURL(qr);
             resolve(qrCodeBase64);
          } catch (err) {
             reject(new Error('Erro ao converter QR Code para imagem.'));
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          // 401 = Logged Out, 440 = Connection Replaced / Conflict
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440 && statusCode !== 401;
          
          if (shouldReconnect) {
            console.log(`[WhatsApp] Connection closed (Code: ${statusCode}), reconnecting...`);
            this.connect(instanceName).catch(reject); // Auto-reconnect
          } else {
             // Logged out or Connection Replaced
             this.sessions.delete(instanceName);
             try {
               if (fs.existsSync(sessionDir)) {
                 fs.rmSync(sessionDir, { recursive: true, force: true });
               }
             } catch (err) {
               console.error(`[WhatsApp] Failed to delete session dir for ${instanceName}:`, err);
             }
             
             await prisma.instance.update({
               where: { name: instanceName },
               data: { status: 'DISCONNECTED' }
             });
             console.log(`[WhatsApp] Instance ${instanceName} logged out or replaced (Code: ${statusCode}).`);
             clearTimeout(timeout);
             
             if (!isResolved) {
                isResolved = true;
                reject(new Error(`A sessão foi desconectada (Erro ${statusCode}). Remova o dispositivo do WhatsApp e tente novamente.`));
             }
          }
        } else if (connection === 'open') {
          console.log(`[WhatsApp] Instance ${instanceName} connected successfully!`);
          await prisma.instance.update({
             where: { name: instanceName },
             data: { status: 'CONNECTED' }
          });
          clearTimeout(timeout);
          resolve(undefined); // Resolves undefined if it connects without QR (restoring session)
        }

        // Dispatch connection updates via Webhook
        await WebhookService.dispatch(instanceName, 'connection.update', update).catch(console.error);
      });

      // Listen to messages
      sock.ev.on('messages.upsert', async (m) => {
        await WebhookService.dispatch(instanceName, 'messages.upsert', m).catch(console.error);;
      });
    });
  }

  static getSession(instanceName: string) {
    return this.sessions.get(instanceName);
  }

  static async deleteSession(instanceName: string) {
    const sock = this.getSession(instanceName);
    if (sock) {
      try {
        await sock.logout();
      } catch (e) {
        console.error(`[WhatsApp] Error logging out instance ${instanceName}:`, e);
      }
    }
    
    this.sessions.delete(instanceName);
    const sessionDir = path.join(process.cwd(), 'sessions', instanceName);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[WhatsApp] Failed to delete session dir for ${instanceName}:`, err);
    }
  }

  static async sendText(instanceName: string, number: string, text: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    
    // Format number to JID
    const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
    
    const result = await sock.sendMessage(jid, { text });
    return result;
  }

  static async sendImage(instanceName: string, number: string, url: string, caption?: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    
    const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
    return await sock.sendMessage(jid, { image: { url }, caption });
  }

  static async sendVideo(instanceName: string, number: string, url: string, caption?: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    
    const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
    return await sock.sendMessage(jid, { video: { url }, caption });
  }

  static async sendAudio(instanceName: string, number: string, url: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    
    const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
    // ptt: true ensures it plays as a voice note in the recipient's phone
    return await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mp4', ptt: true });
  }

  // --- Group Management Methods --- //

  static async createGroup(instanceName: string, subject: string, participants: string[]) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    const jids = participants.map(p => p.includes('@s.whatsapp.net') ? p : `${p}@s.whatsapp.net`);
    return await sock.groupCreate(subject, jids);
  }

  static async listGroups(instanceName: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    
    // Fetch all groups the bot is currently in
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups);
  }

  static async updateGroupName(instanceName: string, groupId: string, subject: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
    return await sock.groupUpdateSubject(jid, subject);
  }

  static async updateGroupDescription(instanceName: string, groupId: string, description: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
    return await sock.groupUpdateDescription(jid, description);
  }

  static async updateGroupParticipants(instanceName: string, groupId: string, participants: string[], action: 'add' | 'remove' | 'promote' | 'demote') {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
    const jids = participants.map(p => p.includes('@s.whatsapp.net') ? p : `${p}@s.whatsapp.net`);
    return await sock.groupParticipantsUpdate(jid, jids, action);
  }

  static async leaveGroup(instanceName: string, groupId: string) {
    const sock = this.getSession(instanceName);
    if (!sock) throw new Error('Instance not connected.');
    const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
    return await sock.groupLeave(jid);
  }
}
