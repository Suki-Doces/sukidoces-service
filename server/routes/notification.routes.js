import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js'; // Ajuste o nome se necessário

const router = express.Router();

// 1. BUSCAR NOTIFICAÇÕES (GET)
router.get('/', authMiddleware, async (req, res) => {
    try {
        // No Prisma, usamos o findMany com filtros
        const notifications = await prisma.notificacoes.findMany({
            where: {
                // Aqui garantimos que o admin/usuário só veja as suas notificações
                id_usuario: req.usuario.id 
            },
            orderBy: {
                data_criacao: 'desc'
            },
            take: 50 // Limite de 50 notificações
        });

        const unreadCount = await prisma.notificacoes.count({
            where: {
                id_usuario: req.usuario.id,
                lido: false
            }
        });

        res.json({
            notifications,
            unreadCount
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