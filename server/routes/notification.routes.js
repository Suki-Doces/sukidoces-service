import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js'; // Ajuste o nome se necessário

const router = express.Router();

// 1. BUSCAR NOTIFICAÇÕES COM PAGINAÇÃO (GET)
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Extrai os parâmetros de paginação da query string (?page=1&limit=4)
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 4);
        
        // Calcula quantos registros pular
        const skip = (page - 1) * limit;

        // Busca as notificações da página atual
        const notifications = await prisma.notificacoes.findMany({
            where: {
                id_usuario: req.usuario.id 
            },
            orderBy: {
                data_criacao: 'desc'
            },
            take: limit,
            skip: skip
        });

        // Conta o total de notificações para calcular o número de páginas
        const total = await prisma.notificacoes.count({
            where: {
                id_usuario: req.usuario.id
            }
        });

        const unreadCount = await prisma.notificacoes.count({
            where: {
                id_usuario: req.usuario.id,
                lido: false
            }
        });

        // Calcula o total de páginas
        const totalPages = Math.ceil(total / limit);

        res.json({
            notifications,
            unreadCount,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao buscar notificações" });
    }
});

// 2. MARCAR UMA COMO LIDA (PUT)
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // O updateMany é útil para garantir que só o dono da notificação consiga editá-la
        const updated = await prisma.notificacoes.updateMany({
            where: {
                id_notificacao: Number(id),
                id_usuario: req.usuario.id
            },
            data: {
                lido: true
            }
        });

        if (updated.count === 0) {
            return res.status(403).json({ erro: "Não autorizado ou notificação inexistente" });
        }

        res.json({ message: 'Notificação marcada como lida' });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao atualizar" });
    }
});

// 3. MARCAR TODAS COMO LIDAS (PUT)
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        await prisma.notificacoes.updateMany({
            where: {
                id_usuario: req.usuario.id
            },
            data: {
                lido: true
            }
        });

        res.json({ message: 'Todas as notificações marcadas como lidas' });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao limpar notificações" });
    }
});

// 4. DELETAR NOTIFICAÇÃO (DELETE)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await prisma.notificacoes.deleteMany({
            where: {
                id_notificacao: Number(id),
                id_usuario: req.usuario.id
            }
        });

        if (deleted.count === 0) {
            return res.status(403).json({ erro: "Não autorizado ou inexistente" });
        }

        res.json({ message: 'Notificação deletada' });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao deletar" });
    }
});

export default router;