import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { register, login } from '../controller/auth.controller.js';
import { prisma } from '../lib/prisma.js';

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
// Usa req.usuario.id do token JWT — não aceita ID na URL por segurança
// ==========================================

// GET /usuario/perfil
router.get('/perfil', authMiddleware, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: req.usuario.id },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        telefone: true,
        cpf: true,
        enderecos: true,
        data_nascimento: true,
        role: true,
        data_criacao: true,
        status_id: true
      }
    });
    if (!usuario) return res.status(404).json({ message: 'Usuário não encontrado' });
    return res.status(200).json({ user: usuario });
  } catch (error) { next(error); }
});

// PUT /usuario/perfil
router.put('/perfil', authMiddleware, async (req, res, next) => {
  try {
    const { nome, telefone, cpf, enderecos, data_nascimento } = req.body;
    const atualizado = await prisma.usuario.update({
      where: { id_usuario: req.usuario.id },
      data: {
        ...(nome && { nome: nome.trim() }),
        ...(telefone !== undefined && { telefone }),
        ...(cpf !== undefined && { cpf }),
        ...(enderecos !== undefined && { enderecos: JSON.parse(req.body.enderecos) }),
        ...(data_nascimento !== undefined && {
          data_nascimento: data_nascimento ? new Date(data_nascimento) : null
        })
      },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        telefone: true,
        cpf: true,
        enderecos: true,
        data_nascimento: true,
        role: true
      }
    });
    return res.status(200).json({ message: 'Dados atualizados!', user: atualizado });
  } catch (error) { next(error); }
});

// PUT /usuario/senha
router.put('/senha', authMiddleware, async (req, res, next) => {
  try {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha)
      return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias' });

    if (novaSenha.length < 6)
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres' });

    const usuario = await prisma.usuario.findUnique({ where: { id_usuario: req.usuario.id } });
    if (!usuario) return res.status(404).json({ message: 'Usuário não encontrado' });

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) return res.status(401).json({ message: 'Senha atual incorreta' });

    await prisma.usuario.update({
      where: { id_usuario: req.usuario.id },
      data: { senha: await bcrypt.hash(novaSenha, 10) }
    });

    return res.status(200).json({ message: 'Senha alterada com sucesso!' });
  } catch (error) { next(error); }
});

// GET /usuario/pedidos — histórico de pedidos do usuário logado
router.get('/pedidos', authMiddleware, async (req, res, next) => {
  try {
    const pedidos = await prisma.pedidos.findMany({
      where: { id_usuario: req.usuario.id },
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

// ==========================================
// ADICIONADO: CANCELAMENTO COM REGRA DE 2 HORAS
// PATCH /usuario/pedidos/:id/cancelar
// Regra de Negócio: cancelamento permitido até 2 horas após a compra
// ==========================================
router.patch('/pedidos/:id/cancelar', authMiddleware, async (req, res, next) => {
  try {
    const idPedido = parseInt(req.params.id);
    const usuarioId = req.usuario.id;

    // 1. Busca o pedido e verifica se pertence ao usuário logado
    const pedido = await prisma.pedidos.findUnique({
      where: { id_pedido: idPedido }
    });

    if (!pedido) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
    }

    // Segurança: só o dono do pedido pode cancelar
    if (pedido.id_usuario !== usuarioId) {
      return res.status(403).json({ mensagem: 'Você não tem permissão para cancelar este pedido.' });
    }

    // 2. Verificar se o pedido já está cancelado ou entregue
    if (pedido.status === 'cancelado') {
      return res.status(400).json({ mensagem: 'Este pedido já foi cancelado.' });
    }
    if (pedido.status === 'entregue') {
      return res.status(400).json({ mensagem: 'Pedidos entregues não podem ser cancelados.' });
    }

    // 3. REGRA DE NEGÓCIO: cancelamento permitido até 2 horas após a compra
    const dataCompra = new Date(pedido.data_pedido);
    const agora = new Date();
    const diferencaHoras = (agora - dataCompra) / (1000 * 60 * 60); // conversão ms → horas

    if (diferencaHoras > 2) {
      const horasPassadas = diferencaHoras.toFixed(1);
      return res.status(400).json({
        mensagem: `O prazo de 2 horas para cancelamento expirou (${horasPassadas}h após a compra). Entre em contato com o suporte.`,
        prazo_expirado: true
      });
    }

    // 4. Cancelar o pedido
    const pedidoCancelado = await prisma.pedidos.update({
      where: { id_pedido: idPedido },
      data: { status: 'cancelado' }
    });

    // 5. Devolver estoque dos produtos
    const itensPedido = await prisma.itens_pedido.findMany({
      where: { id_pedido: idPedido }
    });

    for (const item of itensPedido) {
      await prisma.produtos.update({
        where: { id_produto: item.id_produto },
        data: { quantidade: { increment: item.quantidade } }
      });
    }

    // 6. Notificar o admin sobre o cancelamento
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