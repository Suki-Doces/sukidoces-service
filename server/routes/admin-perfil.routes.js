import express from 'express';
import { prisma } from '../lib/prisma.js'; 
import bcrypt from 'bcrypt';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// 1. LER (GET) - Removido o "/:id". Agora pega o ID seguro do Token.
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = req.usuario.id; // Pegando a identidade direto do Token!

    const admin = await prisma.administradores.findUnique({
      where: { id_admin: Number(id) },
      select: { id_admin: true, nome: true, email: true } 
    });

    if (!admin) return res.status(404).json({ mensagem: 'Admin não encontrado' });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao buscar dados', detalhe: error.message });
  }
});

// 2. ATUALIZAR (PUT) - Removido o "/:id". Usa o Token.
router.put('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = req.usuario.id; // Identidade segura
    const { nome, email, senhaAtual, novaSenha } = req.body;

    const adminAtual = await prisma.administradores.findUnique({
      where: { id_admin: Number(id) }
    });

    if (!adminAtual) return res.status(404).json({ mensagem: 'Admin não encontrado' });

    const dadosParaAtualizar = { nome, email };

    if (novaSenha && novaSenha.trim() !== '') {
      if (!senhaAtual) {
        return res.status(400).json({ mensagem: 'Digite a senha atual para alterar a senha.' });
      }

      const senhaValida = await bcrypt.compare(senhaAtual, adminAtual.senha);
      if (!senhaValida) {
        return res.status(401).json({ mensagem: 'A senha atual está incorreta.' });
      }

      dadosParaAtualizar.senha = await bcrypt.hash(novaSenha, 10);
    }

    const adminAtualizado = await prisma.administradores.update({
      where: { id_admin: Number(id) },
      data: dadosParaAtualizar
    });

    res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso!' });

  } catch (error) {
    console.error("Erro no PUT Perfil:", error);
    res.status(500).json({ mensagem: 'Erro ao atualizar perfil', detalhe: error.message });
  }
});

export default router;