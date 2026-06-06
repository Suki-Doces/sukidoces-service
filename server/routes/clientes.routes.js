import express from 'express';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// 1. LISTAR CLIENTES COM PAGINAÇÃO (GET)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Extrai os parâmetros de paginação da query string (?page=1&limit=10)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    
    // Calcula quantos registros pular
    const skip = (page - 1) * limit;

    const clientes = await prisma.usuario.findMany({
      where: { role: 'cliente' },
      include: {
        pedidos: true
      },
      orderBy: { data_criacao: 'desc' },
      take: limit,
      skip: skip
    });

    const clientesFormatados = clientes.map(c => ({
      id_cliente: c.id_usuario,
      nome: c.nome,
      telefone: c.telefone,
      email: c.email,
      data_cadastro: c.data_criacao,
      status: c.status_id ? 'ativo' : 'inativo',
      valor_total: c.pedidos.reduce((total, p) => total + Number(p.valor_total), 0),
      total_pedidos: c.pedidos.length
    }));

    // Conta o total de clientes
    const total = await prisma.usuario.count({
      where: { role: 'cliente' }
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      clientes: clientesFormatados,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('ERRO NO GET CLIENTES:', error);
    res.status(500).json({ erro: 'Erro ao buscar clientes', detalhe: error.message });
  }
});

// 2. CRIAR CLIENTE (POST)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome, email, senha, status } = req.body;
    const senhaHash = await bcrypt.hash(senha, 10);

    const novoCliente = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        role: 'cliente',
        status_id: status === 'ativo'
      }
    });

    res.status(201).json({ sucesso: true, cliente: novoCliente });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar cliente', detalhe: error.message });
  }
});

// 3. ATUALIZAR CLIENTE (PUT)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, status, senha } = req.body;

    const dadosAtualizados = {
      nome,
      status_id: status === 'ativo'
    };

    if (senha && senha.trim() !== '') {
      dadosAtualizados.senha = await bcrypt.hash(senha, 10);
    }

    const clienteAtualizado = await prisma.usuario.update({
      where: { id_usuario: Number(id) },
      data: dadosAtualizados
    });

    res.json({ sucesso: true, cliente: clienteAtualizado });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar cliente', detalhe: error.message });
  }
});

// 4. DELETAR CLIENTE (DELETE)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.usuario.delete({
      where: { id_usuario: Number(id) }
    });

    res.json({ sucesso: true, mensagem: 'Cliente removido com sucesso' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar cliente', detalhe: error.message });
  }
});

export default router;