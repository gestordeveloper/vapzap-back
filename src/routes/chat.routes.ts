import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ChatController } from '../controllers/chat.controller';
import { prisma } from '../prisma';

export async function chatRoutes(fastify: FastifyInstance) {
  // Public route for media
  fastify.get('/media/:name/:fileName', ChatController.getMedia);

  // Authenticated routes
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
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

    protectedRoutes.get('/', ChatController.listAllChats);
    protectedRoutes.get('/:name', ChatController.listChats);
    protectedRoutes.get('/:name/:remoteJid/messages', ChatController.listMessages);
    protectedRoutes.post('/:name/send', ChatController.sendMessage);
  });
}
