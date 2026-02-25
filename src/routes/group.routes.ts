import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GroupController } from '../controllers/group.controller';

export async function groupRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
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
