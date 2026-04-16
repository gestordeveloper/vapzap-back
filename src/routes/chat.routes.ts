import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ChatController } from '../controllers/chat.controller';

export async function chatRoutes(fastify: FastifyInstance) {
  // Public route for media
  fastify.get('/media/:name/:fileName', ChatController.getMedia);

  // Authenticated routes
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    });

    protectedRoutes.get('/', ChatController.listAllChats);
    protectedRoutes.get('/:name', ChatController.listChats);
    protectedRoutes.get('/:name/:remoteJid/messages', ChatController.listMessages);
    protectedRoutes.post('/:name/send', ChatController.sendMessage);
  });
}
