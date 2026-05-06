import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const chatWithGemini = async (req, res) => {
  try {
    const { message, history } = req.body;

    // 1. CORREÇÃO AQUI: prisma.produtos (com 's') em vez de prisma.produto
    const listaProdutos = await prisma.produtos.findMany({
      select: { id_produto: true, nome: true, preco: true }
    });

    const catalogoString = listaProdutos
      .map(p => `- ${p.nome} (ID: ${p.id_produto}, Preço: R$ ${p.preco})`)
      .join('\n');

    // 2. Regra extrema para a IA
    const systemInstruction = `Você é o SukiBot, assistente de vendas da SukiDoces.
    
    REGRA CRÍTICA E ABSOLUTA: 
    NUNCA responda o nome de um produto em negrito (ex: **Bolo**). 
    SEMPRE que mencionar um produto, você DEVE EXATAMENTE usar a sintaxe de link Markdown apontando para o ID dele.
    FORMATO OBRIGATÓRIO: [Nome do Produto](/produtos/ID)
    
    CATÁLOGO DE PRODUTOS DISPONÍVEIS:
    ${catalogoString}`;

    // 3. Usa o flash (que aceita systemInstruction)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction 
    });

    const chat = model.startChat({
      history: history || []
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error("Erro no chat:", error);
    return res.status(500).json({ error: "Erro ao processar mensagem na IA." });
  }
};