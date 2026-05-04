import express from 'express';
import prisma from '../lib/prisma.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// ROTAS PÚBLICAS (Clientes podem acessar)
// ==========================================

// IMPORTANTE: /categorias deve vir ANTES de /:id
// senão o Express interpreta "categorias" como um ID
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

// CORRIGIDO: removido upload.single('imagem') do GET — middleware de upload
// num GET não faz sentido e pode causar erros
router.get('/', async (req, res, next) => {
  try {
    const { categoria, query, filtro } = req.query;

    let prismaWhere = {};

    if (categoria) {
      prismaWhere.id_categoria = parseInt(categoria, 10);
    }

    if (query) {
      prismaWhere.nome = {
        contains: query
      };
    }

    let queryOptions = {
      where: prismaWhere,
      include: {
        categorias: true
      }
    };

    if (filtro === 'novos') {
      queryOptions.orderBy = { id_produto: 'desc' };
    }

    const produtos = await prisma.produtos.findMany(queryOptions);
    return res.status(200).json(produtos);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ mensagem: 'ID de produto inválido' });
    }

    const produto = await prisma.produtos.findUnique({
      where: { id_produto: id },
      include: { categorias: true }
    });

    if (!produto) {
      return res.status(404).json({ mensagem: 'Produto não encontrado' });
    }

    return res.status(200).json(produto);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ROTAS PROTEGIDAS (Apenas Admin)
// ==========================================

// CORRIGIDO: adicionado authMiddleware + adminOnly no POST
// antes qualquer um podia criar produtos
router.post('/', authMiddleware, adminOnly, upload.single('imagem'), async (req, res, next) => {
  try {
    const { nome, descricao, preco, quantidade, id_categoria } = req.body;
    const nomeDaImagem = req.file ? req.file.filename : null;

    if (!nome || !preco) {
      return res.status(400).json({ mensagem: 'Nome e Preço são obrigatórios' });
    }

    const novoProduto = await prisma.produtos.create({
      data: {
        nome,
        descricao,
        preco: parseFloat(preco),
        quantidade: quantidade ? parseInt(quantidade, 10) : 0,
        id_categoria: id_categoria ? parseInt(id_categoria, 10) : null,
        imagem: nomeDaImagem
      }
    });

    return res.status(201).json({
      mensagem: 'Produto adicionado ao catálogo com sucesso!',
      produto: novoProduto
    });
  } catch (error) {
    next(error);
  }
});

// CORRIGIDO: adicionado authMiddleware + adminOnly no PUT
// antes qualquer um podia editar produtos
router.put('/:id', authMiddleware, adminOnly, upload.single('imagem'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { nome, descricao, preco, quantidade, id_categoria } = req.body;

    const produto = await prisma.produtos.findUnique({
      where: { id_produto: id }
    });

    if (!produto) {
      return res.status(404).json({ mensagem: 'Produto não encontrado' });
    }

    // Se enviou nova imagem, usa o nome gerado pelo Multer
    // senão mantém a imagem atual
    const novaImagem = req.file ? req.file.filename : undefined;

    const atualizado = await prisma.produtos.update({
      where: { id_produto: id },
      data: {
        ...(nome && { nome }),
        ...(descricao !== undefined && { descricao }),
        ...(preco && { preco: parseFloat(preco) }),
        ...(quantidade !== undefined && { quantidade: parseInt(quantidade, 10) }),
        ...(id_categoria && { id_categoria: parseInt(id_categoria, 10) }),
        ...(novaImagem && { imagem: novaImagem })
      }
    });

    return res.status(200).json({
      mensagem: 'Produto atualizado com sucesso',
      produto: atualizado
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const produto = await prisma.produtos.findUnique({
      where: { id_produto: id }
    });

    if (!produto) {
      return res.status(404).json({ mensagem: 'Produto não encontrado' });
    }

    await prisma.produtos.delete({
      where: { id_produto: id }
    });

    return res.status(200).json({ mensagem: 'Produto removido do catálogo com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;