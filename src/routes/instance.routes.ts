import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InstanceController } from '../controllers/instance.controller';

import { prisma } from '../prisma';

export async function instanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
      }
      
      const token = authHeader.split(' ')[1];
      
      // JWTs usually have 3 parts separated by dots
      if (token.split('.').length === 3) {
         await request.jwtVerify();
      } else {
         // Fallback: Check if it's a permanent API Token
         const user = await prisma.user.findUnique({ where: { apiToken: token } });
         if (!user) return reply.status(401).send({ error: 'Invalid API Token' });
         
         // Attach user payload to request like jwtVerify does
         request.user = { id: user.id, email: user.email };
      }
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized', details: err.message });
    }
  });

  fastify.get('/', InstanceController.list);
  fastify.post('/create', InstanceController.create);
  fastify.get('/:name', InstanceController.getOne);
  fastify.put('/:name', InstanceController.update);
  fastify.delete('/:name', InstanceController.delete);
  fastify.get('/connect/:name', InstanceController.connect);
  fastify.post('/disconnect/:name', InstanceController.disconnect);
  fastify.post('/webhook/:name', InstanceController.setWebhook);
  fastify.post('/sendText/:name', InstanceController.sendText);
  fastify.post('/sendImage/:name', InstanceController.sendImage);
  fastify.post('/sendVideo/:name', InstanceController.sendVideo);
  fastify.post('/sendAudio/:name', InstanceController.sendAudio);
  fastify.post('/sendDocument/:name', InstanceController.sendDocument);
  
  fastify.get('/agent/:name', InstanceController.getAgent);
  fastify.post('/agent/:name', InstanceController.setAgent);
}
