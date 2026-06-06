import express from 'express';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { uploadProductImage } from '../services/cloudinaryUpload.service.js';

const router = express.Router();

// ========================================
// GET - Buscar dados do administrador logado
// ========================================
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = req.usuario.id;

    const admin = await prisma.administradores.findUnique({
      where: {
        id_admin: Number(id)
      },
      select: {
        id_admin: true,
        nome: true,
        email: true,
        foto_perfil: true
      }
    });

    if (!admin) {
      return res.status(404).json({
        mensagem: 'Admin não encontrado'
      });
    }

    return res.json(admin);

  } catch (error) {
    console.error('Erro ao buscar administrador:', error);

    return res.status(500).json({
      mensagem: 'Erro ao buscar dados',
      detalhe: error.message
    });
  }
});

// ========================================
// PUT - Atualizar perfil do administrador
// ========================================
router.put(
  '/',
  authMiddleware,
  adminOnly,
  upload.single('foto_perfil'),
  async (req, res) => {
    try {
      const id = req.usuario.id;

      const {
        nome,
        email,
        senhaAtual,
        novaSenha
      } = req.body;

      const adminAtual = await prisma.administradores.findUnique({
        where: {
          id_admin: Number(id)
        }
      });

      if (!adminAtual) {
        return res.status(404).json({
          mensagem: 'Admin não encontrado'
        });
      }

      const dadosParaAtualizar = {
        nome,
        email
      };

      // ========================================
      // Upload da foto para Cloudinary
      // ========================================
      if (req.file) {
        const fotoUrl = await uploadProductImage(req.file.buffer);

        if (fotoUrl) {
          dadosParaAtualizar.foto_perfil = fotoUrl;
        }
      }

      // ========================================
      // Alteração de senha
      // ========================================
      if (novaSenha && novaSenha.trim() !== '') {

        if (!senhaAtual) {
          return res.status(400).json({
            mensagem: 'Digite a senha atual para alterar a senha.'
          });
        }

        const senhaValida = await bcrypt.compare(
          senhaAtual,
          adminAtual.senha
        );

        if (!senhaValida) {
          return res.status(401).json({
            mensagem: 'A senha atual está incorreta.'
          });
        }

        dadosParaAtualizar.senha = await bcrypt.hash(
          novaSenha,
          10
        );
      }

      await prisma.administradores.update({
        where: {
          id_admin: Number(id)
        },
        data: dadosParaAtualizar
      });

      return res.json({
        sucesso: true,
        mensagem: 'Perfil atualizado com sucesso!'
      });

    } catch (error) {
      console.error('Erro no PUT Perfil:', error);

      return res.status(500).json({
        mensagem: 'Erro ao atualizar perfil',
        detalhe: error.message
      });
    }
  }
);

export default router;