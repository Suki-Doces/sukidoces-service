import express from 'express';
import { prisma } from '../lib/prisma.js'; 
import bcrypt from 'bcrypt';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

// Ajuste o nome da função ('uploadImage') para o nome exato exportado no seu service
import { uploadProductImage } from '../services/cloudinaryUpload.service.js';

const router = express.Router();

// 1. LER (GET) - Pega o ID seguro do Token.
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = req.usuario.id;

    const admin = await prisma.administradores.findUnique({
      where: { id_admin: Number(id) },
      // Adicionado 'foto_perfil: true' para que o frontend consiga exibir a imagem salva
      select: { id_admin: true, nome: true, email: true, foto_perfil: true } 
    });

    if (!admin) return res.status(404).json({ mensagem: 'Admin não encontrado' });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao buscar dados', detalhe: error.message });
  }
});

// 2. ATUALIZAR (PUT) - Intercepta 'foto_perfil' via multer e envia para a nuvem
router.put('/', authMiddleware, adminOnly, upload.single('foto_perfil'), async (req, res) => {
  try {
    const id = req.usuario.id;
    const { nome, email, senhaAtual, novaSenha } = req.body;

    let fotoUrl = null;

    // Validação e Processamento na Nuvem
    if (req.file) {
      // Ajuste os parâmetros caso sua função de upload precise de algo específico além do caminho do arquivo
      const uploadResult = await uploadProductImage(req.file.path); 
      
      // O Cloudinary geralmente retorna um objeto contendo a propriedade secure_url
      fotoUrl = uploadResult.secure_url || uploadResult.url || uploadResult; 
    }

    const adminAtual = await prisma.administradores.findUnique({
      where: { id_admin: Number(id) }
    });

    if (!adminAtual) return res.status(404).json({ mensagem: 'Admin não encontrado' });

    const dadosParaAtualizar = { nome, email };

    // Inclusão no Banco de Dados: a propriedade só é adicionada se o upload tiver sucesso
    if (fotoUrl) {
      dadosParaAtualizar.foto_perfil = fotoUrl;
    }

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