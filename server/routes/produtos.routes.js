import express from 'express';
import prisma from '../lib/prisma.js';
// 1. Importando nossos "cadeados" de segurança
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// ROTAS PÚBLICAS (Clientes podem acessar)
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

// -------------- < ROTA ANTIGA > -------------- 
// router.get('/', async (req, res, next) => {
//   try {
//     const produtos = await prisma.produtos.findMany({
//       include: {
//         categorias: true
//       }
//     });
//     return res.status(200).json(produtos);
//   } catch (error) {
//     next(error);
//   }
// });

// -------------- < ROTA NOVA COM FILTROS > --------------
router.get('/', async (req, res, next) => {
  try {
    // 1. Captura os filtros que o Angular enviou na URL
    const { categoria, query, filtro } = req.query;

    // 2. Prepara o objeto "where" para o Prisma
    let prismaWhere = {};

    // Se o utilizador clicou numa categoria, filtra pelo ID
    if (categoria) {
      prismaWhere.id_categoria = parseInt(categoria, 10);
    }

    // Se o utilizador digitou algo na barra de pesquisa, filtra pelo nome
    if (query) {
      prismaWhere.nome = {
        contains: query // Procura produtos que contenham este texto
      };
    }

    // 3. Prepara as opções completas de busca
    let queryOptions = {
      where: prismaWhere,
      include: {
        categorias: true // Traz o nome da categoria junto
      }
    };

    // 4. Se o utilizador clicou no botão "Novos", ordena pelos mais recentes
    if (filtro === 'novos') {
      queryOptions.orderBy = { id_produto: 'desc' };
    }

    // 5. Executa a busca no banco de dados com todos os filtros aplicados
    const produtos = await prisma.produtos.findMany(queryOptions);
    
    return res.status(200).json(produtos);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ROTAS PROTEGIDAS (Apenas Admin)
// ==========================================

// CRIAR NOVO PRODUTO (POST)
router.post('/', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const { nome, descricao, preco, quantidade, id_categoria, imagem } = req.body;

    // Validação básica
    if (!nome || !preco) {
      return res.status(400).json({ mensagem: 'Nome e Preço são obrigatórios' });
    }

    const novoProduto = await prisma.produtos.create({
      data: {
        nome,
        descricao,
        preco,
        quantidade: quantidade || 0, // Se não mandar quantidade, entra como 0
        id_categoria,
        imagem
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

// EDITAR PRODUTO (PUT)
router.put('/:id', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { nome, descricao, preco, quantidade, id_categoria, imagem } = req.body;

    const produto = await prisma.produtos.findUnique({
      where: { id_produto: id }
    });

    if (!produto) {
      return res.status(404).json({ mensagem: 'Produto não encontrado' });
    }

    const atualizado = await prisma.produtos.update({
      where: { id_produto: id },
      data: {
        ...(nome && { nome }),
        ...(descricao && { descricao }),
        ...(preco && { preco }),
        ...(quantidade !== undefined && { quantidade }), 
        ...(id_categoria && { id_categoria }),
        ...(imagem && { imagem })
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

// DELETAR PRODUTO (DELETE)
router.delete('/:id', authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    // 1. Verifica se o doce existe antes de tentar apagar
    const produto = await prisma.produtos.findUnique({
      where: { id_produto: id }
    });

    if (!produto) {
      return res.status(404).json({ mensagem: 'Produto não encontrado' });
    }

    // 2. Deleta do banco
    await prisma.produtos.delete({
      where: { id_produto: id }
    });

    return res.status(200).json({ mensagem: 'Produto removido do catálogo com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;