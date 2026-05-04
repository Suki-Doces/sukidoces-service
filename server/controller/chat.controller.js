import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../lib/prisma.js';

// Inicializa a API do Google com a chave do .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const chatWithGemini = async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Mensagem é obrigatória.' });
        }

        // 1. Vai buscar os produtos ativos à base de dados
        const produtosDB = await prisma.produtos.findMany(); // Traz tudo sem filtrar relações

        const catalogo = JSON.stringify(produtosDB);

        // 2. Configura a Personalidade e o Contexto
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            systemInstruction: `És a assistente virtual amigável de uma loja online de doceria chamada SukiDoces.
            O teu objetivo é ajudar os clientes a encontrar doces e/ou produtos, consultar preços e dar sugestões baseadas no orçamento deles.
            Seja simpática, use emojis e respostas curtas (máximo 2-3 parágrafos).
            Aqui está o catálogo atual da loja (NUNCA inventes produtos ou preços que não estejam aqui): ${catalogo}
            Regras:
            - Se o cliente perguntar "O que recomendam com 10 reais?", sugere combinações do catálogo (produtos com preço exato ou produtos com preço aproximado).
            - Responde na moeda Reais (R$), por exemplo R$ 1.000,00, ou de acordo com a configuração da loja.
            - NUNCA aplicar sugestões de preços ou descontos que NÃO existem na loja.
            - Se perguntarem algo fora do tema da loja, recusa educadamente.`
        });

        // 3. Inicia o Chat
        const chat = model.startChat({
            history: history || [],
            generationConfig: { temperature: 0.7 },
        });

        // 4. Envia a mensagem do cliente
        const result = await chat.sendMessage(message);
        const respostaBot = result.response.text();

        // 5. Devolve a resposta ao Angular
        res.status(200).json({ response: respostaBot });

    } catch (error) {
        console.error('Erro no SukiBot:', error);
        res.status(500).json({ error: 'Desculpe, a nosso assistente está com problemas técnicos. Tente novamente mais tarde!' });
    }
};