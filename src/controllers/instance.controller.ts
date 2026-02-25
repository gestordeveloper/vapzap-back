import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prisma';
import { WhatsAppService } from '../services/whatsapp.service';

export class InstanceController {
  
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string };
    
    try {
      const instances = await prisma.instance.findMany({
        where: { userId: user.id }
      });
      return reply.send(instances);
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch instances', details: e.message });
    }
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const user = request.user as { id: string };

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      return reply.send(instance);
    } catch (e: any) {
      return reply.status(500).send({ error: 'Internal Server Error', details: e.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { newName } = request.body as { newName: string };
    const user = request.user as { id: string };

    if (!newName) return reply.status(400).send({ error: 'New name is required' });

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const updated = await prisma.instance.update({
        where: { name },
        data: { name: newName }
      });
      return reply.send(updated);
    } catch (e: any) {
      if (e.code === 'P2002') return reply.status(400).send({ error: 'New instance name already exists' });
      return reply.status(500).send({ error: 'Failed to update instance', details: e.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const user = request.user as { id: string };

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      // Clean up WhatsApp session files and connection
      await WhatsAppService.deleteSession(name);

      // Delete from Database
      await prisma.instance.delete({
        where: { name }
      });

      return reply.send({ message: 'Instance deleted successfully' });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to delete instance', details: e.message });
    }
  }
  
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.body as { name: string };
    const user = request.user as { id: string };

    if (!name) return reply.status(400).send({ error: 'Name is required' });

    try {
      const instance = await prisma.instance.create({
        data: { 
          name,
          userId: user.id
        }
      });
      return reply.status(201).send(instance);
    } catch (e: any) {
      if (e.code === 'P2002') return reply.status(400).send({ error: 'Instance name already exists' });
      return reply.status(500).send({ error: 'Internal Server Error', details: e.message });
    }
  }

  static async connect(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const user = request.user as { id: string };

    const instance = await prisma.instance.findUnique({ where: { name } });
    if (!instance) return reply.status(404).send({ error: 'Instance not found' });
    if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

    try {
      const qrCode = await WhatsAppService.connect(name);
      return reply.send({ message: 'Connection started', qrCode });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to connect', details: e.message });
    }
  }

  static async setWebhook(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { webhookUrl, webhookEvents } = request.body as { webhookUrl: string, webhookEvents?: string[] };
    const user = request.user as { id: string };

    const instance = await prisma.instance.findUnique({ where: { name } });
    if (!instance) return reply.status(404).send({ error: 'Instance not found' });
    if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

    const updated = await prisma.instance.update({
      where: { name },
      data: { 
        webhookUrl,
        webhookEvents: webhookEvents || []
      }
    });

    return reply.send({ message: 'Webhook updated successfully', webhookUrl: updated.webhookUrl, webhookEvents: updated.webhookEvents });
  }

  static async sendText(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { number, text } = request.body as { number: string, text: string };
    const user = request.user as { id: string };

    if (!number || !text) {
        return reply.status(400).send({ error: 'Os campos number e text são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.sendText(name, number, text);
      return reply.send({ message: 'Message sent', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to send message', details: e.message });
    }
  }

  static async sendImage(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { number, url, caption } = request.body as { number: string, url: string, caption?: string };
    const user = request.user as { id: string };

    if (!number || !url) {
        return reply.status(400).send({ error: 'Os campos number e url são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.sendImage(name, number, url, caption);
      return reply.send({ message: 'Image sent', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to send image', details: e.message });
    }
  }

  static async sendVideo(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { number, url, caption } = request.body as { number: string, url: string, caption?: string };
    const user = request.user as { id: string };

    if (!number || !url) {
        return reply.status(400).send({ error: 'Os campos number e url são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.sendVideo(name, number, url, caption);
      return reply.send({ message: 'Video sent', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to send video', details: e.message });
    }
  }

  static async sendAudio(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { number, url } = request.body as { number: string, url: string };
    const user = request.user as { id: string };

    if (!number || !url) {
        return reply.status(400).send({ error: 'Os campos number e url são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.sendAudio(name, number, url);
      return reply.send({ message: 'Audio sent', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to send audio', details: e.message });
    }
  }
}
