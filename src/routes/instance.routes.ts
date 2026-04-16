import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InstanceController } from '../controllers/instance.controller';

export async function instanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
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
