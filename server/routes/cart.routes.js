import express from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET CART ITEMS
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario; // Ajustado para pegar o ID correto do seu middleware

    const cartItems = await prisma.carrinho_itens.findMany({
      where: { usuario_id: idUsuario },
      orderBy: { data_adicionado: 'desc' },
      include: {
        produto: {
          select: { nome: true, preco: true, imagem: true }
        }
      }
    });

    const itemsComTotal = cartItems.map(item => ({
      ...item,
      total: Number(item.produto.preco) * item.quantidade
    }));

    const total = itemsComTotal.reduce((sum, item) => sum + item.total, 0);

    res.json({
      cartItems: itemsComTotal,
      total,
      itemCount: cartItems.length
    });
  } catch (error) {
    next(error);
  }
});

// ADD TO CART
router.post('/add', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario;
    const { produto_id, quantidade } = req.body;

    if (!produto_id || !quantidade || quantidade < 1) {
      throw new AppError('Produto ou quantidade inválida', 400);
    }

    const product = await prisma.produtos.findUnique({
      where: { id_produto: Number(produto_id) }
    });

    if (!product) {
      throw new AppError('Produto não encontrado', 404);
    }

    const estoqueProduto = await prisma.estoque.findFirst({
        where: { id_produto: Number(produto_id) }
    });

    const qtdEstoque = estoqueProduto ? estoqueProduto.quantidade_atual : 0;

    if (qtdEstoque < quantidade) {
      throw new AppError('Estoque insuficiente', 400);
    }

    const existingItem = await prisma.carrinho_itens.findFirst({
      where: { usuario_id: idUsuario, produto_id: Number(produto_id) }
    });

    if (existingItem) {
      const newQuantity = existingItem.quantidade + Number(quantidade);
      
      if (qtdEstoque < newQuantity) {
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
          produto_id: Number(produto_id),
          quantidade: Number(quantidade)
        }
      });
    }

    res.json({ message: 'Produto adicionado ao carrinho' });
  } catch (error) {
    next(error);
  }
});

// UPDATE CART ITEM
router.put('/:itemId', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario;
    const { itemId } = req.params;
    const { quantidade } = req.body;

    if (!quantidade || quantidade < 1) {
      throw new AppError('Quantidade inválida', 400);
    }

    const cartItem = await prisma.carrinho_itens.findUnique({
      where: { id: Number(itemId) }
    });

    if (!cartItem || cartItem.usuario_id !== idUsuario) {
      throw new AppError('Não autorizado ou item não encontrado', 403);
    }

    const estoqueProduto = await prisma.estoque.findFirst({
        where: { id_produto: cartItem.produto_id }
    });

    const qtdEstoque = estoqueProduto ? estoqueProduto.quantidade_atual : 0;

    if (qtdEstoque < quantidade) {
      throw new AppError('Estoque insuficiente', 400);
    }

    await prisma.carrinho_itens.update({
      where: { id: Number(itemId) },
      data: { quantidade: Number(quantidade) }
    });

    res.json({ message: 'Quantidade do carrinho atualizada' });
  } catch (error) {
    next(error);
  }
});

// REMOVE FROM CART
router.delete('/:itemId', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario;
    const { itemId } = req.params;

    const cartItem = await prisma.carrinho_itens.findUnique({
      where: { id: Number(itemId) }
    });

    if (!cartItem || cartItem.usuario_id !== idUsuario) {
      throw new AppError('Não autorizado ou item não encontrado', 403);
    }

    await prisma.carrinho_itens.delete({
      where: { id: Number(itemId) }
    });

    res.json({ message: 'Item removido do carrinho' });
  } catch (error) {
    next(error);
  }
});

// CLEAR CART
router.delete('/', authMiddleware, async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id_usuario;

    await prisma.carrinho_itens.deleteMany({
      where: { usuario_id: idUsuario }
    });

    res.json({ message: 'Carrinho esvaziado com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;