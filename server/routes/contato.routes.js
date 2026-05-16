import express from 'express';
import { prisma } from '../lib/prisma.js';
import { optionalAuth, authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.post('/', optionalAuth, async (req, res) => {
  const { nome, email, telefone, assunto, mensagem } = req.body;

  if (!nome || typeof nome !== 'string' || nome.trim().length < 3) {
    return res.status(400).json({ message: 'Nome é obrigatório e deve ter pelo menos 3 caracteres.' });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ message: 'E-mail válido é obrigatório.' });
  }
  if (!telefone || typeof telefone !== 'string' || telefone.trim().length < 8) {
    return res.status(400).json({ message: 'Telefone é obrigatório.' });
  }
  if (!assunto || typeof assunto !== 'string') {
    return res.status(400).json({ message: 'Assunto é obrigatório.' });
  }
  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length < 10) {
    return res.status(400).json({ message: 'Mensagem é obrigatória e deve ter ao menos 10 caracteres.' });
  }

  try {
    const contato = await prisma.contatoMensagens.create({
      data: {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone.trim(),
        assunto: assunto.trim(),
        mensagem: mensagem.trim(),
        id_usuario: req.usuario && req.usuario.role !== 'admin' ? req.usuario.id : undefined
      }
    });

    return res.status(201).json({ message: 'Mensagem recebida com sucesso. Em breve entraremos em contato.', id: contato.id_contato });
  } catch (error) {
    console.error('Erro ao salvar mensagem de contato:', error);
    return res.status(500).json({ message: 'Erro ao salvar a mensagem. Tente novamente mais tarde.' });
  }
});

adminRouter.use(authMiddleware, adminOnly);

adminRouter.get('/', async (req, res) => {
  try {
    const messages = await prisma.contatoMensagens.findMany({
      orderBy: { data_criacao: 'desc' }
    });

    return res.json({ messages });
  } catch (error) {
    console.error('Erro ao buscar mensagens de contato:', error);
    return res.status(500).json({ message: 'Erro ao buscar mensagens.' });
  }
});

adminRouter.put('/:id/respond', async (req, res) => {
  const { id } = req.params;
  const { resposta } = req.body;

  if (!resposta || typeof resposta !== 'string' || resposta.trim().length < 5) {
    return res.status(400).json({ message: 'Resposta deve ter pelo menos 5 caracteres.' });
  }

  try {
    const updated = await prisma.contatoMensagens.update({
      where: { id_contato: Number(id) },
      data: {
        respondido: true,
        resposta: resposta.trim(),
        data_resposta: new Date()
      }
    });

    return res.json({ message: 'Resposta gravada com sucesso.', contato: updated });
  } catch (error) {
    console.error('Erro ao atualizar resposta de contato:', error);
    return res.status(404).json({ message: 'Mensagem não encontrada.' });
  }
});

publicRouter.get('/me', authMiddleware, async (req, res) => {
  if (!req.usuario || req.usuario.role === 'admin') {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const messages = await prisma.contatoMensagens.findMany({
      where: { id_usuario: req.usuario.id },
      orderBy: { data_criacao: 'desc' }
    });

    return res.json({ messages });
  } catch (error) {
    console.error('Erro ao buscar histórico de contato do usuário:', error);
    return res.status(500).json({ message: 'Erro ao buscar histórico de mensagens.' });
  }
});

export default publicRouter;
export { adminRouter as adminContatoRouter };