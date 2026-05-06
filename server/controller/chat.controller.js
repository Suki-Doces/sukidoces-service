const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializa o SDK do Google
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.processarChat = async (req, res) => {
  try {
    const { message, history } = req.body;

    // 1. Busca os produtos ativos no banco de dados para a IA saber o que vender
    const produtos = await prisma.produto.findMany({
      select: { id_produto: true, nome: true, preco: true }
    });

    // 2. Monta uma lista em texto plano para a IA ler o catálogo atual
    const catalogoString = produtos
      .map(p => `- ${p.nome} (ID: ${p.id_produto}, Preço: R$ ${p.preco})`)
      .join('\n');

    // 3. A Regra de Ouro: Instrução do Sistema
    const systemInstruction = `Você é o SukiBot, a assistente virtual amigável e especialista em vendas da confeitaria SukiDoces.
    
    REGRA OBRIGATÓRIA PARA LINKS: 
    Sempre que você recomendar um produto ou o usuário perguntar sobre ele, você DEVE enviar o nome do produto como um link clicável usando o formato Markdown: [Nome do Produto](/produtos/ID).
    Exemplo: "Eu recomendo muito o nosso [Bolo de Pote Gurme](/produtos/5)!"
    
    Aqui está o catálogo atualizado de produtos disponíveis na loja:
    ${catalogoString}
    
    Seja persuasiva, use emojis com moderação e nunca invente produtos que não estão no catálogo acima.`;

    // 4. Configura o modelo com a Instrução de Sistema
    // Recomendado usar o gemini-1.5-flash, pois ele é rápido e suporta systemInstruction perfeitamente
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction 
    });

    // 5. Inicia o chat com o histórico enviado pelo Angular
    const chat = model.startChat({
      history: history || []
    });

    // 6. Envia a mensagem do usuário e aguarda a resposta
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // 7. Retorna a resposta para o Angular
    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error("Erro no chat:", error);
    return res.status(500).json({ error: "Erro ao processar mensagem na IA." });
  }
};