import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prisma';
import { WhatsAppService } from '../services/whatsapp.service';

export class GroupController {
  
  static async listGroups(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const user = request.user as { id: string };

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const groups = await WhatsAppService.listGroups(name);
      return reply.send({ message: 'Groups retrieved successfully', groups });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to list groups', details: e.message });
    }
  }

  static async createGroup(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { subject, participants } = request.body as { subject: string, participants: string[] };
    const user = request.user as { id: string };

    if (!subject || !participants || !Array.isArray(participants)) {
        return reply.status(400).send({ error: 'Os campos subject e participants (array) são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.createGroup(name, subject, participants);
      return reply.send({ message: 'Group created', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to create group', details: e.message });
    }
  }

  static async updateGroupName(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { groupId, subject } = request.body as { groupId: string, subject: string };
    const user = request.user as { id: string };

    if (!groupId || !subject) {
        return reply.status(400).send({ error: 'Os campos groupId e subject são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      await WhatsAppService.updateGroupName(name, groupId, subject);
      return reply.send({ message: 'Group name updated successfully' });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to update group name', details: e.message });
    }
  }

  static async updateGroupDescription(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { groupId, description } = request.body as { groupId: string, description: string };
    const user = request.user as { id: string };

    if (!groupId || description === undefined) {
        return reply.status(400).send({ error: 'Os campos groupId e description são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      await WhatsAppService.updateGroupDescription(name, groupId, description);
      return reply.send({ message: 'Group description updated successfully' });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to update group description', details: e.message });
    }
  }

  static async addParticipant(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { groupId, participants } = request.body as { groupId: string, participants: string[] };
    const user = request.user as { id: string };

    if (!groupId || !participants || !Array.isArray(participants)) {
        return reply.status(400).send({ error: 'Os campos groupId e participants (array) são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.updateGroupParticipants(name, groupId, participants, 'add');
      return reply.send({ message: 'Participants added successfully', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to add participants', details: e.message });
    }
  }

  static async removeParticipant(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { groupId, participants } = request.body as { groupId: string, participants: string[] };
    const user = request.user as { id: string };

    if (!groupId || !participants || !Array.isArray(participants)) {
        return reply.status(400).send({ error: 'Os campos groupId e participants (array) são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.updateGroupParticipants(name, groupId, participants, 'remove');
      return reply.send({ message: 'Participants removed successfully', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to remove participants', details: e.message });
    }
  }

  static async promoteParticipant(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { groupId, participants } = request.body as { groupId: string, participants: string[] };
    const user = request.user as { id: string };

    if (!groupId || !participants || !Array.isArray(participants)) {
        return reply.status(400).send({ error: 'Os campos groupId e participants (array) são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.updateGroupParticipants(name, groupId, participants, 'promote');
      return reply.send({ message: 'Participants promoted successfully', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to promote participants', details: e.message });
    }
  }

  static async demoteParticipant(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { groupId, participants } = request.body as { groupId: string, participants: string[] };
    const user = request.user as { id: string };

    if (!groupId || !participants || !Array.isArray(participants)) {
        return reply.status(400).send({ error: 'Os campos groupId e participants (array) são obrigatórios.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      const result = await WhatsAppService.updateGroupParticipants(name, groupId, participants, 'demote');
      return reply.send({ message: 'Participants demoted successfully', result });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to demote participants', details: e.message });
    }
  }

  static async leaveGroup(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const { groupId } = request.body as { groupId: string };
    const user = request.user as { id: string };

    if (!groupId) {
        return reply.status(400).send({ error: 'O campo groupId é obrigatório.' });
    }

    try {
      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return reply.status(404).send({ error: 'Instance not found' });
      if (instance.userId !== user.id) return reply.status(403).send({ error: 'Unauthorized' });

      await WhatsAppService.leaveGroup(name, groupId);
      return reply.send({ message: 'Left group successfully' });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to leave group', details: e.message });
    }
  }
}
