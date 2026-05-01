import express from 'express';
// Note que importei o prisma do seu ficheiro como você faz no admin.routes.js
import { prisma } from '../lib/prisma.js'; 
import bcrypt from 'bcrypt';
// Importando as suas travas de segurança!
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// 1. LER (GET) - Buscar os dados atuais do admin para preencher o formulário
// Protegido: Só o admin logado pode aceder
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await prisma.administradores.findUnique({
      where: { id_admin: Number(id) },
      // Escondemos a senha, devolvemos só o que interessa ao formulário
      select: { id_admin: true, nome: true, email: true } 
    });

    if (!admin) return res.status(404).json({ erro: 'Admin não encontrado' });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar dados', detalhe: error.message });
  }
});

// 2. ATUALIZAR (PUT) - Salvar os novos dados e a nova senha
// Protegido: Só o admin logado pode alterar
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, senhaAtual, novaSenha } = req.body;

    const adminAtual = await prisma.administradores.findUnique({
      where: { id_admin: Number(id) }
    });

    if (!adminAtual) return res.status(404).json({ erro: 'Admin não encontrado' });

    const dadosParaAtualizar = { nome, email };

    // Se o utilizador preencheu o campo de Nova Senha
    if (novaSenha && novaSenha.trim() !== '') {
      if (!senhaAtual) {
        return res.status(400).json({ erro: 'Digite a senha atual para alterar a senha.' });
      }

      // Valida a senha atual
      const senhaValida = await bcrypt.compare(senhaAtual, adminAtual.senha);
      if (!senhaValida) {
        return res.status(401).json({ erro: 'A senha atual está incorreta.' });
      }

      // Encripta a nova senha
      dadosParaAtualizar.senha = await bcrypt.hash(novaSenha, 10);
    }

    // Salva na base de dados
    const adminAtualizado = await prisma.administradores.update({
      where: { id_admin: Number(id) },
      data: dadosParaAtualizar
    });

    res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso!' });

  } catch (error) {
    console.error("Erro no PUT Perfil:", error);
    res.status(500).json({ erro: 'Erro ao atualizar perfil', detalhe: error.message });
  }
});

export default router;