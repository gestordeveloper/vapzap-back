import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';

export const AuthController = {
  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name, email, password } = request.body as any;

      if (!name || !email || !password) {
        return reply.status(400).send({ error: 'Todos os campos são obrigatórios' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.status(400).send({ error: 'E-mail já está em uso' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      return reply.status(201).send({
        message: 'Usuário cadastrado com sucesso',
        user: { id: user.id, name: user.name, email: user.email, apiToken: user.apiToken },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro interno ao cadastrar usuário' });
    }
  },

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, password } = request.body as any;

      if (!email || !password) {
        return reply.status(400).send({ error: 'E-mail e senha são obrigatórios' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Credenciais inválidas' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return reply.status(401).send({ error: 'Credenciais inválidas' });
      }

      const token = request.server.jwt.sign({ id: user.id, email: user.email });

      return reply.send({
        message: 'Login realizado com sucesso',
        token,
        user: { id: user.id, name: user.name, email: user.email, apiToken: user.apiToken },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro interno ao realizar login' });
    }
  },
};
