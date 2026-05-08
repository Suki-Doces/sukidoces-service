import express from 'express';
import { prisma } from '../lib/prisma.js';
import { login } from '../controller/auth.controller.js';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rota pública de login do admin
router.post('/login', login);

// ==========================================
// ROTAS PROTEGIDAS (authMiddleware + adminOnly)
// ==========================================

// ADICIONADO: Dashboard com dados reais do banco
// dashboard.component.ts chama: GET /admin/dashboard
router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    // 1. Contadores de pedidos
    const totalPedidos = await prisma.pedidos.count();
    const pendentes = await prisma.pedidos.count({ where: { status: 'pendente' } });
    const cancelados = await prisma.pedidos.count({ where: { status: 'cancelado' } });

    // 2. Total de vendas (soma pedidos pagos/enviados/entregues)
    const vendasAggregate = await prisma.pedidos.aggregate({
      _sum: { valor_total: true },
      where: { status: { in: ['pago', 'enviado', 'entregue'] } }
    });

    // 3. Pedidos desta semana vs semana passada (para calcular aumento %)
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 7);
    const inicioSemanaPassada = new Date(hoje);
    inicioSemanaPassada.setDate(hoje.getDate() - 14);

    const vendasSemana = await prisma.pedidos.aggregate({
      _sum: { valor_total: true },
      _count: true,
      where: {
        data_pedido: { gte: inicioSemana },
        status: { in: ['pago', 'enviado', 'entregue'] }
      }
    });

    const vendasSemanaPassada = await prisma.pedidos.aggregate({
      _sum: { valor_total: true },
      _count: true,
      where: {
        data_pedido: { gte: inicioSemanaPassada, lt: inicioSemana },
        status: { in: ['pago', 'enviado', 'entregue'] }
      }
    });

    // 4. Produtos mais vendidos (top 5)
    const topProdutosGroupBy = await prisma.itens_pedido.groupBy({
      by: ['id_produto'],
      _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: 'desc' } },
      take: 5
    });

    const idsProdutos = topProdutosGroupBy.map(p => p.id_produto);
    const produtosDetalhes = await prisma.produtos.findMany({
      where: { id_produto: { in: idsProdutos } },
      select: { id_produto: true, nome: true, preco: true, imagem: true, quantidade: true }
    });

    const produtosDestaque = topProdutosGroupBy.map(item => {
      const produto = produtosDetalhes.find(p => p.id_produto === item.id_produto);
      return {
        id_produto: item.id_produto,
        nome: produto?.nome || 'Produto',
        vendas: item._sum.quantidade || 0,
        preco: Number(produto?.preco || 0),
        imagem: produto?.imagem,
        status: (produto?.quantidade ?? 0) > 0 ? 'Em Estoque' : 'Sem Estoque',
        corStatus: (produto?.quantidade ?? 0) > 0 ? '#21c45d' : '#ef4343'
      };
    });

    // 5. Transações recentes (últimos 10 pedidos)
    const transacoesRecentes = await prisma.pedidos.findMany({
      take: 10,
      orderBy: { data_pedido: 'desc' },
      include: {
        usuario: { select: { nome: true } }
      }
    });

    // Calcula % de aumento de vendas
    const valorSemana = Number(vendasSemana._sum.valor_total || 0);
    const valorPassada = Number(vendasSemanaPassada._sum.valor_total || 0);
    const aumentoVendas = valorPassada > 0
      ? ((valorSemana - valorPassada) / valorPassada * 100).toFixed(1)
      : 0;

    const pedidosSemana = vendasSemana._count || 0;
    const pedidosPassada = vendasSemanaPassada._count || 0;
    const aumentoPedidos = pedidosPassada > 0
      ? ((pedidosSemana - pedidosPassada) / pedidosPassada * 100).toFixed(1)
      : 0;

    return res.json({
      resumo: {
        vendasSemana: valorSemana,
        aumentoVendas: Number(aumentoVendas),
        vendasPassada: valorPassada,
        pedidosSemana,
        aumentoPedidos: Number(aumentoPedidos),
        pedidosPassada,
        pendentes,
        cancelados,
        totalVendas: Number(vendasAggregate._sum.valor_total || 0),
        totalPedidos
      },
      produtosDestaque,
      transacoes: transacoesRecentes.map(p => ({
        id_pedido: p.id_pedido,
        cliente_nome: p.usuario?.nome || `#${p.id_pedido}`,
        data_pedido: p.data_pedido,
        status: p.status,
        valor_total: Number(p.valor_total)
      }))
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({ mensagem: 'Erro ao carregar dados do dashboard' });
  }
});

// ADICIONADO: Listar todos os pedidos para o painel admin
// lista-pedidos.component.ts chama: GET /admin/pedidos (via orders.routes.js)
// Mas colocamos aqui também para o admin ter acesso direto
router.get('/pedidos', authMiddleware, adminOnly, async (req, res) => {
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

    const pedidosFormatados = pedidos.map(p => ({
      id_pedido: p.id_pedido,
      cliente_nome: p.usuario?.nome || 'Cliente',
      cliente_email: p.usuario?.email || '',
      data_pedido: p.data_pedido,
      status: p.status,
      valor_total: Number(p.valor_total),
      metodo_pagamento: p.metodo_pagamento,
      itens: p.itens_pedido.map(i => ({
        produto_nome: i.produtos?.nome,
        quantidade: i.quantidade,
        preco_unitario: Number(i.preco_unitario)
      }))
    }));

    return res.json(pedidosFormatados);
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ mensagem: 'Erro ao buscar pedidos' });
  }
});

// PATCH /:id/status — atualiza status do pedido e notifica cliente
router.patch('/:id/status', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { novoStatus } = req.body;

  const statusValidos = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado'];
  if (!statusValidos.includes(novoStatus)) {
    return res.status(400).json({ mensagem: 'Status inválido' });
  }

  try {
    const pedidoAtualizado = await prisma.pedidos.update({
      where: { id_pedido: Number(id) },
      data: { status: novoStatus },
      include: { usuario: true }
    });

    await prisma.notificacoes.create({
      data: {
        id_usuario: pedidoAtualizado.id_usuario,
        titulo: 'Atualização no seu pedido!',
        mensagem: `O status do seu pedido #${id} mudou para: ${novoStatus}.`,
        tipo: 'status',
        lido: false
      }
    });

    return res.json({
      mensagem: 'Status atualizado e cliente notificado!',
      pedido: pedidoAtualizado
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ mensagem: 'Erro ao atualizar status. Verifique se o ID existe.' });
  }
});

export default router;