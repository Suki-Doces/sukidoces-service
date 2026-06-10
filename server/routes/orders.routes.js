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
            produtos: {
              select: {
                nome: true,
                imagem: true
              }
            }
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
    res.status(500).json({
      mensagem: 'Erro ao buscar pedidos'
    });
  }
});

// ==========================================
// 2. POST / — Checkout (Criar novo pedido + Baixa de Estoque)
// ==========================================
router.post('/', authMiddleware, async (req, res) => {
  const { produtos, metodo_pagamento, codigo_cupom } = req.body;

  const usuarioId =
    req.usuario.id_usuario || req.usuario.id;

  if (
    !produtos ||
    produtos.length === 0 ||
    !metodo_pagamento
  ) {
    return res.status(400).json({
      mensagem: 'Dados obrigatórios ausentes.'
    });
  }

  try {
    console.log(
      'Método de pagamento recebido:',
      metodo_pagamento
    );

    // A. Buscar dados reais dos produtos
    const idsProdutos = produtos.map(
      (item) => item.id_produto
    );

    const produtosDoBanco =
      await prisma.produtos.findMany({
        where: {
          id_produto: {
            in: idsProdutos
          }
        }
      });

    // B. Validar estoque
    for (const itemRequest of produtos) {
      const produtoReal = produtosDoBanco.find(
        (p) =>
          p.id_produto === itemRequest.id_produto
      );

      if (!produtoReal) {
        return res.status(404).json({
          mensagem: `Produto ID ${itemRequest.id_produto} não encontrado.`
        });
      }

      if (
        (produtoReal.quantidade ?? 0) <
        itemRequest.quantidade
      ) {
        return res.status(400).json({
          mensagem: `Estoque insuficiente para: ${produtoReal.nome}. Disponível: ${produtoReal.quantidade}`
        });
      }
    }

    // C. Calcular subtotal
    let subtotal = 0;

    const itensParaSalvar = [];

    for (const itemRequest of produtos) {
      const produtoReal = produtosDoBanco.find(
        (p) =>
          p.id_produto === itemRequest.id_produto
      );

      const preco = Number(produtoReal.preco);

      subtotal +=
        preco * itemRequest.quantidade;

      itensParaSalvar.push({
        id_produto: itemRequest.id_produto,
        quantidade: itemRequest.quantidade,
        preco_unitario: preco
      });
    }

    // D. Validar cupom
    let desconto = 0;
    let cupomUsado = null;

    if (codigo_cupom) {
      const cupom =
        await prisma.cupons.findUnique({
          where: {
            codigo: codigo_cupom
              .toUpperCase()
              .trim()
          }
        });

      if (
        cupom &&
        cupom.ativo &&
        (!cupom.validade ||
          new Date(cupom.validade) >=
            new Date())
      ) {
        if (cupom.tipo === 'percentual') {
          desconto =
            subtotal *
            (Number(cupom.valor) / 100);
        } else {
          desconto = Math.min(
            Number(cupom.valor),
            subtotal
          );
        }

        cupomUsado = cupom;
      }
    }

    const valor_total = Math.max(
      0,
      subtotal - desconto
    );

    // ==========================================
    // Define status inicial automaticamente
    // ==========================================
    let statusInicial = 'pendente';

    if (
      metodo_pagamento === 'pix' ||
      metodo_pagamento === 'cartao'
    ) {
      statusInicial = 'pago';
    }

    console.log(
      'Status inicial definido:',
      statusInicial
    );

    // ==========================================
    // TRANSAÇÃO
    // ==========================================
    const novoPedido =
      await prisma.$transaction(
        async (tx) => {
          const pedido =
            await tx.pedidos.create({
              data: {
                id_usuario: usuarioId,
                valor_total,
                status: statusInicial,
                metodo_pagamento,

                ...(cupomUsado && {
                  id_cupom:
                    cupomUsado.id_cupom
                }),

                itens_pedido: {
                  create: itensParaSalvar
                }
              }
            });

          // Baixa de estoque
          for (const item of itensParaSalvar) {
            await tx.produtos.update({
              where: {
                id_produto:
                  item.id_produto
              },
              data: {
                quantidade: {
                  decrement:
                    item.quantidade
                }
              }
            });
          }

          return pedido;
        }
      );

    // ==========================================
    // Notificação para Admin
    // ==========================================
    const admin =
      await prisma.administradores.findFirst();

    if (admin) {
      await prisma.notificacoes.create({
        data: {
          id_usuario: admin.id_admin,
          titulo: 'Novo Pedido Suki Doces!',
          mensagem: `Pedido #${novoPedido.id_pedido} de R$ ${valor_total.toFixed(
            2
          )}.`,
          tipo: 'venda'
        }
      });
    }

    return res.status(201).json({
      mensagem:
        'Pedido realizado com sucesso!',
      pedido: novoPedido,
      resumo: {
        subtotal,
        desconto,
        valor_total
      }
    });
  } catch (error) {
    console.error(
      'Erro no checkout:',
      error
    );

    return res.status(500).json({
      mensagem:
        'Erro interno ao processar pedido'
    });
  }
});

// ==========================================
// 3. PATCH /:id/status
// ==========================================
router.patch(
  '/:id/status',
  authMiddleware,
  adminOnly,
  async (req, res) => {
    const idPedido = parseInt(
      req.params.id
    );

    const { status } = req.body;

    try {
      const pedido =
        await prisma.pedidos.findUnique({
          where: {
            id_pedido: idPedido
          },
          include: {
            itens_pedido: true
          }
        });

      if (!pedido) {
        return res.status(404).json({
          mensagem:
            'Pedido não encontrado'
        });
      }

      // Devolve estoque ao cancelar
      if (
        status === 'cancelado' &&
        pedido.status !== 'cancelado'
      ) {
        for (const item of pedido.itens_pedido) {
          await prisma.produtos.update({
            where: {
              id_produto:
                item.id_produto
            },
            data: {
              quantidade: {
                increment:
                  item.quantidade
              }
            }
          });
        }
      }

      // Retira estoque novamente
      if (
        pedido.status === 'cancelado' &&
        status !== 'cancelado'
      ) {
        for (const item of pedido.itens_pedido) {
          await prisma.produtos.update({
            where: {
              id_produto:
                item.id_produto
            },
            data: {
              quantidade: {
                decrement:
                  item.quantidade
              }
            }
          });
        }
      }

      const pedidoAtualizado =
        await prisma.pedidos.update({
          where: {
            id_pedido: idPedido
          },
          data: {
            status
          }
        });

      // ... código anterior de atualização do pedido (pedidoAtualizado) ...

      // 🪄 REGRA DE NOTIFICAÇÃO: Avisar o Admin sobre a mudança
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

      res.json({
        mensagem: `Status atualizado para ${status}`,
        pedido: pedidoAtualizado
      });
    } catch (error) {
      console.error(
        'Erro ao atualizar status:',
        error
      );

      res.status(500).json({
        mensagem:
          'Erro ao atualizar pedido'
      });
    }
  }
);

export default router;