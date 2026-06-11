import express from 'express';
import bcrypt from 'bcrypt'; // 1. IMPORT FALTANDO ADICIONADO AQUI!
import { authMiddleware } from '../middleware/authMiddleware.js';
import { register, login } from '../controller/auth.controller.js';
import { prisma } from '../lib/prisma.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { uploadProductImage } from '../services/cloudinaryUpload.service.js';

const router = express.Router();

// ==========================================
// ROTAS PÚBLICAS
// ==========================================

router.post('/registro', register);
router.post('/login', login);
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ mensagem: 'Logout realizado com sucesso' });
});

// ==========================================
// PERFIL DO USUÁRIO LOGADO
// ==========================================

// GET /usuario/perfil
router.get('/perfil', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id_usuario || req.usuario.id; // Proteção extra de ID
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: usuarioId },
      select: {
        id_usuario: true, nome: true, email: true, telefone: true,
        cpf: true, enderecos: true, data_nascimento: true,
        foto_perfil: true, role: true, data_criacao: true, status_id: true
      }
    });
    if (!usuario) return res.status(404).json({ message: 'Usuário não encontrado' });
    return res.status(200).json({ user: usuario });
  } catch (error) { next(error); }
});

// PUT /usuario/perfil
router.put('/perfil', authMiddleware, upload.single('foto_perfil'), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id_usuario || req.usuario.id;
    const { nome, telefone, cpf, data_nascimento } = req.body;

    let enderecos = req.body.enderecos;
    if (typeof enderecos === 'string') {
      enderecos = JSON.parse(enderecos);
    }

    const dadosParaAtualizar = {
      ...(nome && { nome: nome.trim() }),
      ...(telefone !== undefined && { telefone }),
      ...(cpf !== undefined && { cpf }),
      ...(enderecos !== undefined && { enderecos }),
      ...(data_nascimento !== undefined && {
        data_nascimento: data_nascimento ? new Date(data_nascimento) : null
      })
    };

    if (req.file) {
      const fotoUrl = await uploadProductImage(req.file.buffer);
      if (fotoUrl) {
        dadosParaAtualizar.foto_perfil = fotoUrl;
      }
    }

    const atualizado = await prisma.usuario.update({
      where: { id_usuario: usuarioId },
      data: dadosParaAtualizar,
      select: {
        id_usuario: true, nome: true, email: true, telefone: true,
        cpf: true, enderecos: true, data_nascimento: true,
        foto_perfil: true, role: true
      }
    });

    return res.status(200).json({ message: 'Dados atualizados!', user: atualizado });
  } catch (error) { next(error); }
});

// PUT /usuario/senha
router.put('/senha', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id_usuario || req.usuario.id;
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha)
      return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias' });

    if (novaSenha.length < 6)
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres' });

    const usuario = await prisma.usuario.findUnique({ where: { id_usuario: usuarioId } });
    if (!usuario) return res.status(404).json({ message: 'Usuário não encontrado' });

    // 2. O bcrypt agora vai funcionar corretamente!
    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) return res.status(401).json({ message: 'Senha atual incorreta' });

    await prisma.usuario.update({
      where: { id_usuario: usuarioId },
      data: { senha: await bcrypt.hash(novaSenha, 10) }
    });

    return res.status(200).json({ message: 'Senha alterada com sucesso!' });
  } catch (error) { next(error); }
});

// GET /usuario/pedidos
router.get('/pedidos', authMiddleware, async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id_usuario || req.usuario.id;
    const pedidos = await prisma.pedidos.findMany({
      where: { id_usuario: usuarioId },
      include: {
        itens_pedido: {
          include: { produtos: { select: { nome: true, imagem: true, preco: true } } }
        }
      },
      orderBy: { data_pedido: 'desc' }
    });
    return res.status(200).json(pedidos);
  } catch (error) { next(error); }
});

// PATCH /usuario/pedidos/:id/cancelar
router.patch('/pedidos/:id/cancelar', authMiddleware, async (req, res, next) => {
  try {
    const idPedido = parseInt(req.params.id);
    const usuarioId = req.usuario.id_usuario || req.usuario.id;

    const pedido = await prisma.pedidos.findUnique({
      where: { id_pedido: idPedido },
      include: { itens_pedido: true } // Já incluímos os itens aqui para devolver o estoque mais fácil
    });

    if (!pedido) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
    }

    if (pedido.id_usuario !== usuarioId) {
      return res.status(403).json({ mensagem: 'Você não tem permissão para cancelar este pedido.' });
    }

    if (pedido.status === 'cancelado') {
      return res.status(400).json({ mensagem: 'Este pedido já foi cancelado.' });
    }
    if (pedido.status === 'entregue') {
      return res.status(400).json({ mensagem: 'Pedidos entregues não podem ser cancelados.' });
    }

    const dataCompra = new Date(pedido.data_pedido);
    const agora = new Date();
    const diferencaHoras = (agora - dataCompra) / (1000 * 60 * 60);

    if (diferencaHoras > 2) {
      const horasPassadas = diferencaHoras.toFixed(1);
      return res.status(400).json({
        mensagem: `O prazo de 2 horas para cancelamento expirou (${horasPassadas}h após a compra). Entre em contato com o suporte.`,
        prazo_expirado: true
      });
    }

    // 3. TRANSACTION ADICIONADO: Atualiza o status E devolve o estoque de forma 100% segura
    const pedidoCancelado = await prisma.$transaction(async (tx) => {
      const pedidoAtualizado = await tx.pedidos.update({
        where: { id_pedido: idPedido },
        data: { status: 'cancelado' }
      });

      for (const item of pedido.itens_pedido) {
        await tx.produtos.update({
          where: { id_produto: item.id_produto },
          data: { quantidade: { increment: item.quantidade } }
        });
      }
      return pedidoAtualizado;
    });

    const admin = await prisma.administradores.findFirst();
    if (admin) {
      await prisma.notificacoes.create({
        data: {
          id_usuario: admin.id_admin,
          titulo: 'Pedido Cancelado',
          mensagem: `O pedido #${idPedido} foi cancelado pelo cliente.`,
          tipo: 'cancelamento',
          lido: false
        }
      });
    }

    return res.status(200).json({
      mensagem: 'Pedido cancelado com sucesso!',
      pedido: pedidoCancelado
    });

  } catch (error) { next(error); }
});

export default router;