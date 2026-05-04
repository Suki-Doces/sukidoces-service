import express from 'express';
import { chatWithGemini } from '../controller/chat.controller.js';

const router = express.Router();

// Rota POST para enviar mensagens para a IA
router.post('/', chatWithGemini);

export default router;