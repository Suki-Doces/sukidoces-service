import express from 'express';
import { prisma } from '../lib/prisma.js'; 

const router = express.Router();

router.post('/', async (req, res) => {
  // Agora recebemos também o metodo_pagamento
  const { usuarioId, produtos, metodo_pagamento } = req.body;
  
  // Validação atualizada exigindo o método de pagamento
  if (!usuarioId || !produtos || produtos.length === 0 || !metodo_pagamento) {
    return res.status(400).json({ mensagem: 'Dados obrigatórios ausentes (verifique o carrinho ou a forma de pagamento).' });
  }

  try {
    // 1. Buscar preços dos produtos no banco (Segurança!)
    const idsProdutos = produtos.map(item => item.id_produto);
    
    const produtosDoBanco = await prisma.produtos.findMany({
      where: {
        id_produto: { in: idsProdutos }
      }
    });

    if (produtosDoBanco.length !== produtos.length) {
       return res.status(400).json({ mensagem: 'Um ou mais doces não foram encontrados no banco.' });
    }

    // 2. Calcular valor total e montar os itens pro Prisma
    let valor_total = 0;
    const itensParaSalvar = [];

    for (const itemRequest of produtos) {
      const produtoReal = produtosDoBanco.find(p => p.id_produto === itemRequest.id_produto);
      const precoNumber = Number(produtoReal.preco); 
      
      valor_total += precoNumber * itemRequest.quantidade;

      itensParaSalvar.push({
        id_produto: itemRequest.id_produto,
        quantidade: itemRequest.quantidade,
        preco_unitario: precoNumber
      });
    }

    // 3. Criar pedido + itens + método de pagamento
    const novoPedido = await prisma.pedidos.create({
      data: {
        id_usuario: usuarioId, 
        valor_total: valor_total,
        status: "pendente",
        metodo_pagamento: metodo_pagamento, // AQUI ESTÁ A CORREÇÃO QUE FALTAVA!
        itens_pedido: {
          create: itensParaSalvar
        }
      },
      include: {
        itens_pedido: true 
      }
    });

    // ... dentro da sua rota POST de pedidos, logo após o await prisma.pedidos.create ...

    // Disparar notificação para o Admin (supondo que o ID do admin seja 1 ou um ID fixo)
    await prisma.notificacoes.create({
    data: {
    id_usuario: 1, // ID do seu administrador no banco
    titulo: "Novo Pedido Recebido!",
    mensagem: `O cliente ${usuarioId} acabou de fazer um pedido de R$ ${valor_total}.`,
    tipo: "venda",
    lido: false
    }
    });

    // 4. Retornar sucesso
    return res.status(201).json({ 
        mensagem: 'Pedido realizado com sucesso!',
        pedido: novoPedido
    });

  } catch (error) {
    console.error("Erro no checkout:", error);
    return res.status(500).json({ mensagem: 'Erro interno ao processar pedido' });
  }
});

export default router;