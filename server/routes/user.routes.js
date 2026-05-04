import express from 'express';
import bcrypt from 'bcrypt';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { register, login } from '../controller/auth.controller.js';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

// ==========================================
// ROTAS PÚBLICAS
// ==========================================

router.post('/registro', register);
router.post('/login', login);

router.post('/logout', authMiddleware, async (req, res) => {
  res.json({ mensagem: 'Logout realizado com sucesso' });
});

// ==========================================
// ROTAS PROTEGIDAS DO PERFIL DO CLIENTE
// CORRIGIDO: usamos req.usuario.id do TOKEN JWT (não da URL)
// Isso garante que um usuário não edite o perfil de outro
// ==========================================

// GET /usuario/perfil — busca dados do usuário logado
// user.service.ts chama: this.http.get(`${API_URL}/perfil`)
router.get('/perfil', authMiddleware, async (req, res, next) => {
  try {
    const id = req.usuario.id; // vem do token JWT, não da URL

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        telefone: true,
        role: true,
        data_criacao: true,
        status_id: true
      }
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    return res.status(200).json({ user: usuario });
  } catch (error) {
    next(error);
  }
});

// PUT /usuario/perfil — atualiza dados do usuário logado
// user.service.ts chama: this.http.put(`${API_URL}/perfil`, profileData)
router.put('/perfil', authMiddleware, async (req, res, next) => {
  try {
    const id = req.usuario.id; // vem do token JWT, não da URL
    const { nome, telefone } = req.body;

    const atualizado = await prisma.usuario.update({
      where: { id_usuario: id },
      data: {
        ...(nome && { nome: nome.trim() }),
        ...(telefone !== undefined && { telefone })
      },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        telefone: true,
        role: true
      }
    });

    return res.status(200).json({
      message: 'Dados atualizados com sucesso!',
      user: atualizado
    });
  } catch (error) {
    next(error);
  }
});

// PUT /usuario/senha — altera a senha do usuário logado
// user.service.ts chama: this.http.put(`${API_URL}/senha`, { userId, senhaAtual, novaSenha })
router.put('/senha', authMiddleware, async (req, res, next) => {
  try {
    const id = req.usuario.id; // vem do token JWT
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias' });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id }
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ message: 'Senha atual incorreta' });
    }

    const hashNovaSenha = await bcrypt.hash(novaSenha, 10);

    await prisma.usuario.update({
      where: { id_usuario: id },
      data: { senha: hashNovaSenha }
    });

    return res.status(200).json({ message: 'Senha alterada com sucesso!' });
  } catch (error) {
    next(error);
  }
});

// GET /usuario/pedidos — busca pedidos do usuário logado
// order.service.ts chama: getUserOrders(userId)
// NOTA: a rota usa o ID do token, não da URL — mais seguro
router.get('/pedidos', authMiddleware, async (req, res, next) => {
  try {
    const id = req.usuario.id;

    const pedidos = await prisma.pedidos.findMany({
      where: { id_usuario: id },
      include: {
        itens_pedido: {
          include: {
            produtos: {
              select: { nome: true, imagem: true, preco: true }
            }
          }
        }
      },
      orderBy: { data_pedido: 'desc' }
    });

    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
});

export default router;