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
        const produtos = await prisma.produto.findMany({
            select: { id_produto: true, nome: true, preco: true }
        });

        // 2. Monta uma lista em texto plano para a IA ler
        const catalogoString = produtos
            .map(p => `- ${p.nome} (ID: ${p.id_produto}, Preço: R$ ${p.preco})`)
            .join('\n');

        // 2. Configura a Personalidade e o Contexto
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            systemInstruction: `És a assistente virtual amigável de uma loja online de doceria chamada SukiDoces.
            O teu objetivo é ajudar os clientes a encontrar doces e/ou produtos, consultar preços e dar sugestões baseadas no orçamento deles.
            REGRA OBRIGATÓRIA PARA LINKS: 
            Sempre que você recomendar um produto ou o usuário perguntar sobre ele, você DEVE enviar o nome do produto como um link clicável usando o formato Markdown: [Nome do Produto](/produtos/ID).
            Exemplo: "Eu recomendo muito o nosso [Bolo de Pote Gurme](/produtos/5)!"
            Seja simpática, use emojis e respostas curtas (máximo 2-3 parágrafos).
            Aqui está o catálogo atual da loja (NUNCA inventes produtos ou preços que não estejam aqui): ${catalogoString}
            Regras:
            - Se o cliente perguntar "O que recomendam com 10 reais?", sugere combinações do catálogo (produtos com preço exato ou produtos com preço aproximado).
            - Responde na moeda Reais (R$), por exemplo R$ 1.000,00, ou de acordo com a configuração da loja.
            - NUNCA aplicar sugestões de preços ou descontos que NÃO existem na loja.
            - Se perguntarem algo fora do tema da loja, recusa educadamente.
            - Sempre que recomendar um produto, envie o link no formato Markdown: `[NomeProduto](/produtos/ID_DO_PRODUTO)`. Exemplo: Eu recomendo o [Bolo de Chocolate](/produtos/5).`
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
