import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GroupController } from '../controllers/group.controller';

import { prisma } from '../prisma';

export async function groupRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
      }
      
      const token = authHeader.split(' ')[1];
      
      if (token.split('.').length === 3) {
         await request.jwtVerify();
      } else {
         const user = await prisma.user.findUnique({ where: { apiToken: token } });
         if (!user) return reply.status(401).send({ error: 'Invalid API Token' });
         request.user = { id: user.id, email: user.email };
      }
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized', details: err.message });
    }
  });

  fastify.get('/list/:name', GroupController.listGroups);
  fastify.post('/create/:name', GroupController.createGroup);
  fastify.put('/updateName/:name', GroupController.updateGroupName);
  fastify.put('/updateDescription/:name', GroupController.updateGroupDescription);
  fastify.post('/addParticipant/:name', GroupController.addParticipant);
  fastify.post('/removeParticipant/:name', GroupController.removeParticipant);
  fastify.post('/promoteParticipant/:name', GroupController.promoteParticipant);
  fastify.post('/demoteParticipant/:name', GroupController.demoteParticipant);
  fastify.post('/leave/:name', GroupController.leaveGroup);
}
