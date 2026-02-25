import Fastify from 'fastify';
import cors from '@fastify/cors';
import { instanceRoutes } from './routes/instance.routes';
import { groupRoutes } from './routes/group.routes';
import { authRoutes } from './routes/auth.routes';
import fastifyJwt from '@fastify/jwt';

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: '*',
});

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'supersecretvapzap'
});

app.register(authRoutes, { prefix: '/auth' });
app.register(instanceRoutes, { prefix: '/instance' });
app.register(groupRoutes, { prefix: '/group' });

import { WhatsAppService } from './services/whatsapp.service';

const start = async () => {
  try {
    await WhatsAppService.restoreSessions();
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`VapZap API is running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
