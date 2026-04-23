import express from 'express';
import { prisma } from '../lib/prisma.js'; // <-- NÃO ESQUEÇA ESSA LINHA
import { login } from '../controller/auth.controller.js';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Porta de entrada pública para o dono da loja
router.post('/login', login);

// === Daqui pra baixo ficam as rotas protegidas do admin ===

// Dashboard: Apenas admin logado entra
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  res.json({ mensagem: 'Bem-vindo ao Dashboard Admin' });
});

// ATUALIZAR STATUS DO PEDIDO + NOTIFICAR CLIENTE
// Adicionamos os middlewares de segurança aqui também!
router.patch('/:id/status', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { novoStatus } = req.body; // ex: "em_preparo", "saiu_para_entrega", "entregue"

  try {
    // 1. Atualiza o status no banco
    const pedidoAtualizado = await prisma.pedidos.update({
      where: { id_pedido: Number(id) },
      data: { status: novoStatus },
      include: { usuario: true } // Pegamos os dados do dono do pedido para a notificação
    });

    // 2. Cria uma notificação PARA O CLIENTE
    await prisma.notificacoes.create({
      data: {
        id_usuario: pedidoAtualizado.id_usuario, // ID do cliente que comprou
        titulo: "Atualização no seu pedido!",
        mensagem: `O status do seu pedido #${id} mudou para: ${novoStatus}.`,
        tipo: "status",
        lido: false
      }
    });

    return res.json({ 
      mensagem: "Status atualizado e cliente notificado!", 
      pedido: pedidoAtualizado 
    });

  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    res.status(500).json({ mensagem: "Erro ao atualizar status. Verifique se o ID do pedido existe." });
  }
});

export default router;