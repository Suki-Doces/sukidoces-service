import express from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /carrinho — busca itens do carrinho do usuário logado
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // 🛡️ Segurança: Pega o ID independente de como o token enviou
    const idUsuario = req.usuario.id_usuario || req.usuario.id;

    const cartItems = await prisma.carrinho_itens.findMany({
      where: { usuario_id: idUsuario },
      orderBy: { data_adicionado: 'desc' },
      include: {
        produto: {
          select: { id_produto: true, nome: true, preco: true, imagem: true, quantidade: true }
        }
      }
    });

    const itemsComTotal = cartItems.map(item => ({
      ...item,
      total: Number(item.produto.preco) * item.quantidade
    }));

    const subtotal = itemsComTotal.reduce((sum, item) => sum + item.total, 0);
    
    // 🚚 REGRA DE NEGÓCIO: Frete grátis acima de R$50
    const frete = subtotal >= 50 ? 0 : 8.90;
    const total = subtotal + frete;

    res.json({
      cartItems: itemsComTotal,
      subtotal,
      frete,
      total,
      freteGratis: subtotal >= 50,
      itemCount: cartItems.length
    });
  } catch (error) {
    next(error);
  }
});

// POST /carrinho/add — adiciona produto ao carrinho
router.post('/add', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario || req.usuario.id;
    // 🛡️ Segurança: Aceita tanto id_produto quanto produto_id do Frontend
    const id_produto = req.body.id_produto || req.body.produto_id; 
    const quantidade = req.body.quantidade;

    if (!id_produto || !quantidade || quantidade < 1) {
      throw new AppError('Produto ou quantidade inválida', 400);
    }

    const product = await prisma.produtos.findUnique({
      where: { id_produto: Number(id_produto) }
    });

    if (!product) throw new AppError('Produto não encontrado', 404);

    if ((product.quantidade ?? 0) < Number(quantidade)) {
      throw new AppError('Estoque insuficiente', 400);
    }

    const existingItem = await prisma.carrinho_itens.findFirst({
      where: { usuario_id: idUsuario, id_produto: Number(id_produto) }
    });

    if (existingItem) {
      const newQuantity = existingItem.quantidade + Number(quantidade);

      if ((product.quantidade ?? 0) < newQuantity) {
        throw new AppError('Estoque insuficiente para a quantidade total', 400);
      }

      await prisma.carrinho_itens.update({
        where: { id: existingItem.id },
        data: { quantidade: newQuantity }
      });
    } else {
      await prisma.carrinho_itens.create({
        data: {
          usuario_id: idUsuario,
          id_produto: Number(id_produto),
          quantidade: Number(quantidade)
        }
      });
    }

    res.json({ message: 'Produto adicionado ao carrinho' });
  } catch (error) {
    next(error);
  }
});

// PUT /carrinho/:itemId — atualiza quantidade de um item
router.put('/:itemId', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario || req.usuario.id;
    const { itemId } = req.params;
    const { quantidade } = req.body;

    if (!quantidade || quantidade < 1) {
      throw new AppError('Quantidade inválida', 400);
    }

    const cartItem = await prisma.carrinho_itens.findUnique({
      where: { id: Number(itemId) },
      include: { produto: true } // ✅ CORREÇÃO: Necessário para acessar o estoque do produto abaixo!
    });

    if (!cartItem || cartItem.usuario_id !== idUsuario) {
      throw new AppError('Não autorizado ou item não encontrado', 403);
    }

    // Verifica o estoque antes de atualizar
    if ((cartItem.produto?.quantidade ?? 0) < Number(quantidade)) {
      throw new AppError('Estoque insuficiente', 400);
    }

    await prisma.carrinho_itens.update({
      where: { id: Number(itemId) },
      data: { quantidade: Number(quantidade) }
    });

    res.json({ message: 'Quantidade atualizada' });
  } catch (error) {
    next(error);
  }
});

// DELETE /carrinho/:itemId — remove item do carrinho
router.delete('/:itemId', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario || req.usuario.id;
    const { itemId } = req.params;

    const cartItem = await prisma.carrinho_itens.findUnique({
      where: { id: Number(itemId) }
    });

    if (!cartItem || cartItem.usuario_id !== idUsuario) {
      throw new AppError('Não autorizado ou item não encontrado', 403);
    }

    await prisma.carrinho_itens.delete({ where: { id: Number(itemId) } });
    res.json({ message: 'Item removido do carrinho' });
  } catch (error) {
    next(error);
  }
});

// DELETE /carrinho — limpa todo o carrinho
router.delete('/', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario || req.usuario.id;
    await prisma.carrinho_itens.deleteMany({ where: { usuario_id: idUsuario } });
    res.json({ message: 'Carrinho esvaziado com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;