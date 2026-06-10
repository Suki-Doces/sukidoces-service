import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// 1. GET / — Lista todos os pedidos (Apenas Admin)
// ==========================================
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const pedidos = await prisma.pedidos.findMany({
      orderBy: { data_pedido: 'desc' },
      include: {
        usuario: { select: { nome: true, email: true } },
        itens_pedido: {
          include: {
            produtos: { select: { nome: true, imagem: true } }
          }
        }
      }
    });

    return res.json(
      pedidos.map((p) => ({
        id_pedido: p.id_pedido,
        cliente_nome: p.usuario?.nome || 'Cliente',
        cliente_email: p.usuario?.email || '',
        data_pedido: p.data_pedido,
        status: p.status,
        valor_total: Number(p.valor_total),
        metodo_pagamento: p.metodo_pagamento,
        itens: p.itens_pedido.map((i) => ({
          nome: i.produtos?.nome,
          quantidade: i.quantidade,
          imagem: i.produtos?.imagem
        }))
      }))
    );
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ mensagem: 'Erro ao buscar pedidos' });
  }
});

// ==========================================
// 2. POST / — Checkout (Criar novo pedido + Baixa de Estoque)
// ==========================================
router.post('/', authMiddleware, async (req, res) => {
  const { produtos, metodo_pagamento, codigo_cupom } = req.body;
  const usuarioId = req.usuario.id_usuario || req.usuario.id;

  if (!produtos || produtos.length === 0 || !metodo_pagamento) {
    return res.status(400).json({ mensagem: 'Dados obrigatórios ausentes.' });
  }

  try {
    const idsProdutos = produtos.map((item) => item.id_produto);
    const produtosDoBanco = await prisma.produtos.findMany({
      where: { id_produto: { in: idsProdutos } }
    });

    for (const itemRequest of produtos) {
      const produtoReal = produtosDoBanco.find((p) => p.id_produto === itemRequest.id_produto);
      if (!produtoReal) {
        return res.status(404).json({ mensagem: `Produto ID ${itemRequest.id_produto} não encontrado.` });
      }
      if ((produtoReal.quantidade ?? 0) < itemRequest.quantidade) {
        return res.status(400).json({
          mensagem: `Estoque insuficiente para: ${produtoReal.nome}. Disponível: ${produtoReal.quantidade}`
        });
      }
    }

    let subtotal = 0;
    const itensParaSalvar = [];

    for (const itemRequest of produtos) {
      const produtoReal = produtosDoBanco.find((p) => p.id_produto === itemRequest.id_produto);
      const preco = Number(produtoReal.preco);
      subtotal += preco * itemRequest.quantidade;
      itensParaSalvar.push({
        id_produto: itemRequest.id_produto,
        quantidade: itemRequest.quantidade,
        preco_unitario: preco
      });
    }

    let desconto = 0;
    let cupomUsado = null;

    if (codigo_cupom) {
      const cupom = await prisma.cupons.findUnique({
        where: { codigo: codigo_cupom.toUpperCase().trim() }
      });
      if (cupom && cupom.ativo && (!cupom.validade || new Date(cupom.validade) >= new Date())) {
        desconto = cupom.tipo === 'percentual' ? subtotal * (Number(cupom.valor) / 100) : Math.min(Number(cupom.valor), subtotal);
        cupomUsado = cupom;
      }
    }

    const valor_total = Math.max(0, subtotal - desconto);
    let statusInicial = (metodo_pagamento === 'pix' || metodo_pagamento === 'cartao') ? 'pago' : 'pendente';

    const novoPedido = await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidos.create({
        data: {
          id_usuario: usuarioId,
          valor_total,
          status: statusInicial,
          metodo_pagamento,
          ...(cupomUsado && { id_cupom: cupomUsado.id_cupom }),
          itens_pedido: { create: itensParaSalvar }
        }
      });

      for (const item of itensParaSalvar) {
        await tx.produtos.update({
          where: { id_produto: item.id_produto },
          data: { quantidade: { decrement: item.quantidade } }
        });
      }
      return pedido;
    });

    const admin = await prisma.administradores.findFirst();
    if (admin) {
      await prisma.notificacoes.create({
        data: {
          id_usuario: admin.id_admin,
          titulo: 'Novo Pedido Suki Doces!',
          mensagem: `Pedido #${novoPedido.id_pedido} de R$ ${valor_total.toFixed(2)}.`,
          tipo: 'venda'
        }
      });
    }

    return res.status(201).json({ mensagem: 'Pedido realizado com sucesso!', pedido: novoPedido });
  } catch (error) {
    console.error('Erro no checkout:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao processar pedido' });
  }
});

// ==========================================
// 4. POST /:id/pagar — Tentar Pagar Novamente (Rota Específica ANTES da Genérica)
// ==========================================
router.post('/:id/pagar', authMiddleware, async (req, res) => {
  const idPedido = parseInt(req.params.id);
  const usuarioId = req.usuario.id_usuario || req.usuario.id;

  try {
    const pedido = await prisma.pedidos.findUnique({ where: { id_pedido: idPedido } });
    if (!pedido) return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
    if (pedido.id_usuario !== usuarioId) return res.status(403).json({ mensagem: 'Você não tem permissão.' });
    if (pedido.status !== 'pendente') return res.status(400).json({ mensagem: 'Pedido já processado.' });

    const pedidoPago = await prisma.pedidos.update({
      where: { id_pedido: idPedido },
      data: { status: 'pago' }
    });

    const admin = await prisma.administradores.findFirst();
    if (admin) {
      await prisma.notificacoes.create({
        data: { id_usuario: admin.id_admin, titulo: 'Pagamento Confirmado!', mensagem: `Pedido #${idPedido} pago.`, tipo: 'venda' }
      });
    }
    return res.json({ sucesso: true, pedido: pedidoPago });
  } catch (error) {
    console.error('Erro ao pagar:', error);
    return res.status(500).json({ mensagem: 'Erro interno.' });
  }
});

// ==========================================
// 3. PATCH /:id/status (Admin atualiza status)
// ==========================================
router.patch('/:id/status', authMiddleware, adminOnly, async (req, res) => {
  const idPedido = parseInt(req.params.id);
  const { status } = req.body;

  try {
    const pedido = await prisma.pedidos.findUnique({
      where: { id_pedido: idPedido },
      include: { itens_pedido: true }
    });

    if (!pedido) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado' });
    }

    // 1. Lógica de estoque (Cancelamento/Reversão)
    if (status === 'cancelado' && pedido.status !== 'cancelado') {
      for (const item of pedido.itens_pedido) {
        await prisma.produtos.update({
          where: { id_produto: item.id_produto },
          data: { quantidade: { increment: item.quantidade } }
        });
      }
    } else if (pedido.status === 'cancelado' && status !== 'cancelado') {
      for (const item of pedido.itens_pedido) {
        await prisma.produtos.update({
          where: { id_produto: item.id_produto },
          data: { quantidade: { decrement: item.quantidade } }
        });
      }
    }

    // 2. Atualização principal
    const pedidoAtualizado = await prisma.pedidos.update({
      where: { id_pedido: idPedido },
      data: { status }
    });

    // 3. Notificação (apenas uma vez)
    const admin = await prisma.administradores.findFirst();
    if (admin) {
      await prisma.notificacoes.create({
        data: {
          id_usuario: admin.id_admin,
          titulo: 'Atualização de Status!',
          mensagem: `O Pedido #${idPedido} foi atualizado para: ${status.toUpperCase()}.`,
          tipo: 'pedido'
        }
      });
    }

    return res.json({
      mensagem: `Status atualizado para ${status}`,
      pedido: pedidoAtualizado
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return res.status(500).json({ mensagem: 'Erro ao atualizar pedido no banco' });
  }
});

// ==========================================
// 5. PATCH /:id/cancelar — Cliente cancela o próprio pedido
// ==========================================
router.patch('/:id/cancelar', authMiddleware, async (req, res) => {
  const idPedido = parseInt(req.params.id);
  // Pega o ID do usuário logado (cliente) vindo do token
  const usuarioId = req.usuario.id_usuario || req.usuario.id;

  try {
    // 1. Busca o pedido incluindo os itens para poder devolver ao estoque se necessário
    const pedido = await prisma.pedidos.findUnique({
      where: { id_pedido: idPedido },
      include: { itens_pedido: true }
    });

    if (!pedido) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
    }

    // 2. Segurança: Garante que o cliente só pode cancelar o seu próprio pedido
    if (pedido.id_usuario !== usuarioId) {
      return res.status(403).json({ mensagem: 'Você não tem permissão para cancelar este pedido.' });
    }

    // 3. Regra de negócio: Só pode cancelar se estiver 'pendente' ou 'pago'
    if (pedido.status === 'cancelado') {
      return res.status(400).json({ mensagem: 'Este pedido já está cancelado.' });
    }

    if (pedido.status !== 'pendente' && pedido.status !== 'pago') {
      return res.status(400).json({
        mensagem: 'Este pedido já está em preparo ou rota de entrega e não pode mais ser cancelado.'
      });
    }

    // 4. Executa a atualização do status e a devolução do estoque numa transação
    const pedidoCancelado = await prisma.$transaction(async (tx) => {
      // Devolve a quantidade de cada produto para o estoque
      for (const item of pedido.itens_pedido) {
        await tx.produtos.update({
          where: { id_produto: item.id_produto },
          data: { quantidade: { increment: item.quantidade } }
        });
      }

      // Atualiza o status do pedido para cancelado
      return await tx.pedidos.update({
        where: { id_pedido: idPedido },
        data: { status: 'cancelado' }
      });
    });

    // 5. Cria uma notificação para o Painel do Administrador saber do cancelamento
    const admin = await prisma.administradores.findFirst();
    if (admin) {
      await prisma.notificacoes.create({
        data: {
          id_usuario: admin.id_admin,
          titulo: 'Pedido Cancelado pelo Cliente',
          mensagem: `O cliente cancelou o Pedido #${idPedido}. O estoque foi devolvido.`,
          tipo: 'pedido'
        }
      });
    }

    return res.json({
      sucesso: true,
      mensagem: 'Pedido cancelado com sucesso!',
      pedido: pedidoCancelado
    });

  } catch (error) {
    console.error('Erro ao cancelar pedido pelo cliente:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao processar cancelamento.' });
  }
});

export default router;