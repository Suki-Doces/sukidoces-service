import express from 'express';
import prisma from '../lib/prisma.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';
import { uploadProductImage } from '../services/cloudinaryUpload.service.js';

const router = express.Router();

// ==========================================
// ROTAS PÚBLICAS — ordem importa! fixas antes de /:id
// ==========================================

router.get('/categorias', async (req, res, next) => {
  try {
    const categorias = await prisma.categorias.findMany({
      select: { id_categoria: true, nome: true, descricao: true },
      orderBy: { nome: 'asc' }
    });
    res.json({ categorias });
  } catch (error) {
    next(error);
  }
});

// Produtos mais vendidos
router.get('/mais-vendidos', async (req, res, next) => {
  try {
    const maisVendidos = await prisma.itens_pedido.groupBy({
      by: ['id_produto'],
      _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: 'desc' } },
      take: 8
    });

    if (maisVendidos.length === 0) {
      const produtos = await prisma.produtos.findMany({
        take: 8, orderBy: { id_produto: 'desc' }, include: { categorias: true }
      });
      return res.json(produtos);
    }

    const ids = maisVendidos.map(item => item.id_produto);
    const produtos = await prisma.produtos.findMany({
      where: { id_produto: { in: ids } },
      include: { categorias: true }
    });

    const ordenados = ids.map(id => produtos.find(p => p.id_produto === id)).filter(Boolean);
    return res.json(ordenados);
  } catch (error) {
    next(error);
  }
});

// Produtos novos
router.get('/novos', async (req, res, next) => {
  try {
    const produtos = await prisma.produtos.findMany({
      take: 8,
      orderBy: { data_criacao: 'desc' },
      include: { categorias: true }
    });
    return res.json(produtos);
  } catch (error) {
    next(error);
  }
});

// GET /produtos — lista com filtros completos (Incluindo Preço)
router.get('/', async (req, res, next) => {
  try {
    const { categoria, query, filtro, minPreco, maxPreco, page, limit, isAdmin } = req.query;
    let prismaWhere = {};
    
    if (categoria) prismaWhere.id_categoria = parseInt(categoria, 10);
    if (query) prismaWhere.nome = { contains: query };
    
    // FILTRO DE FAIXA DE PREÇO (Cumpre o README)
    if (minPreco || maxPreco) {
      prismaWhere.preco = {};
      if (minPreco) prismaWhere.preco.gte = parseFloat(minPreco);
      if (maxPreco) prismaWhere.preco.lte = parseFloat(maxPreco);
    }

    // Determina se é para admin (controle de estoque) ou público
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || (isAdmin ? 10 : 20));
    const skip = (pageNum - 1) * limitNum;

    let queryOptions = { where: prismaWhere, include: { categorias: true } };
    
    if (filtro === 'novos') queryOptions.orderBy = { data_criacao: 'desc' };
    if (filtro === 'menor-preco') queryOptions.orderBy = { preco: 'asc' };
    if (filtro === 'maior-preco') queryOptions.orderBy = { preco: 'desc' };

    // Adiciona paginação se for do admin (controle de estoque)
    if (isAdmin) {
      queryOptions.take = limitNum;
      queryOptions.skip = skip;
    }

    const produtos = await prisma.produtos.findMany(queryOptions);
    
    // Se for admin, retorna com informações de paginação
    if (isAdmin) {
      const total = await prisma.produtos.count({ where: prismaWhere });
      const totalPages = Math.ceil(total / limitNum);
      
      return res.status(200).json({
        produtos,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      });
    }

    return res.status(200).json(produtos);
  } catch (error) {
    next(error);
  }
});

// GET /produtos/:id — detalhe
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ mensagem: 'ID inválido' });
    const produto = await prisma.produtos.findUnique({
      where: { id_produto: id }, include: { categorias: true }
    });
    if (!produto) return res.status(404).json({ mensagem: 'Produto não encontrado' });
    return res.status(200).json(produto);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ROTAS PROTEGIDAS (Apenas Admin)
// ==========================================

// CRIAR PRODUTO (POST) - Cloudinary Ativo
router.post('/', authMiddleware, adminOnly, upload.single('imagem'), async (req, res, next) => {
  try {
    const { nome, descricao, preco, quantidade, id_categoria } = req.body;

    if (!nome || !preco) return res.status(400).json({ mensagem: 'Nome e Preço são obrigatórios' });

    const urlDaImagem = req.file ? await uploadProductImage(req.file.buffer) : null;

    const novoProduto = await prisma.produtos.create({
      data: {
        nome, 
        descricao,
        preco: parseFloat(preco),
        quantidade: quantidade ? parseInt(quantidade, 10) : 0,
        id_categoria: id_categoria ? parseInt(id_categoria, 10) : null,
        imagem: urlDaImagem 
      }
    });

    return res.status(201).json({ mensagem: 'Produto adicionado!', produto: novoProduto });
  } catch (error) {
    next(error);
  }
});

// ATUALIZAR PRODUTO (PUT) - Cloudinary Ativo
router.put('/:id', authMiddleware, adminOnly, upload.single('imagem'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { nome, descricao, preco, quantidade, id_categoria } = req.body;

    if (isNaN(id)) return res.status(400).json({ mensagem: 'ID inválido' });
    
    const produto = await prisma.produtos.findUnique({ where: { id_produto: id } });
    if (!produto) return res.status(404).json({ mensagem: 'Produto não encontrado' });

    const novaImagemUrl = req.file ? await uploadProductImage(req.file.buffer) : undefined;

    const atualizado = await prisma.produtos.update({
      where: { id_produto: id },
      data: {
        ...(nome && { nome }),
        ...(descricao !== undefined && { descricao }),
        ...(preco !== undefined && { preco: parseFloat(preco) }),
        ...(quantidade !== undefined && { quantidade: parseInt(quantidade, 10) }),
        ...(id_categoria !== undefined && { id_categoria: parseInt(id_categoria, 10) }),
        ...(novaImagemUrl && { imagem: novaImagemUrl }) 
      }
    });

    return res.status(200).json({ mensagem: 'Produto atualizado', produto: atualizado });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const produto = await prisma.produtos.findUnique({ where: { id_produto: id } });
    if (!produto) return res.status(404).json({ mensagem: 'Produto não encontrado' });
    await prisma.produtos.delete({ where: { id_produto: id } });
    return res.status(200).json({ mensagem: 'Produto removido com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
