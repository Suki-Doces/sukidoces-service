import { prisma } from '../lib/prisma.js';

export async function criarPedido(req, res) {
  try {
    // Vamos pegar o ID do usuário através do token (que o middleware de autenticação decodifica)
    // Se o seu middleware salva em req.user ou req.usuario, ajuste aqui!
    const id_usuario = req.usuario.id; 
    
    // O Front-end vai nos enviar uma lista (array) de itens no Body
    const { itens } = req.body; 

    if (!itens || itens.length === 0) {
      return res.status(400).json({ mensagem: "O carrinho está vazio." });
    }

    // 1. Calcula o valor total do pedido somando (quantidade * preço) de cada item
    let valor_total = 0;
    for (let item of itens) {
      valor_total += (item.quantidade * item.preco_unitario);
    }

    // 2. Cria o Pedido e os Itens de uma única vez no banco de dados
    const novoPedido = await prisma.pedidos.create({
      data: {
        id_usuario: id_usuario,
        valor_total: valor_total,
        status: "Pendente",
        // A mágica do Prisma: ele cria os itens já amarrados ao ID desse novo pedido!
        itens_pedido: {
          create: itens.map(item => ({
            id_produto: item.id_produto,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario
          }))
        }
      },
      // Isso faz a resposta do Back-End devolver o pedido com os itens dentro, para o Front-End ver
      include: {
        itens_pedido: true
      }
    });

    return res.status(201).json({
      mensagem: "Pedido finalizado com sucesso!",
      pedido: novoPedido
    });

  } catch (erro) {
    console.error("Erro ao criar pedido:", erro);
    return res.status(500).json({ mensagem: "Erro interno ao processar o pedido." });
  }
}