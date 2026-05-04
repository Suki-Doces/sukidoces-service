import express from 'express';
import { logger } from './middleware/loggerMiddleware.js'
import prisma from './lib/prisma.js'; // Importamos o Prisma, não mais o pool
import cors from 'cors';

// Importando as Rotas (nome unificado):
import rotaChat from './routes/chat.routes.js';
import rotaConfig from './routes/admin-perfil.routes.js'
import rotaCliente from './routes/clientes.routes.js';
import rotaCategoria from './routes/category.routes.js';
import rotaUsuario from './routes/user.routes.js';
import rotaProdutos from './routes/produtos.routes.js';
import rotaPedidos from './routes/orders.routes.js';
import rotaNotificacoes from './routes/notification.routes.js';
import rotaAdmin from './routes/admin.routes.js';
import rotaCarrinho from './routes/cart.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/authMiddleware.js';

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Middleware para aceitar JSON
app.use(express.json());
app.use(logger); // ← adicione essa linha

app.get('/', (req, res) => {
  res.send('Bem-vindo à API da Suki Doces! Sistema operando 100% na nuvem.');
});

// Middleware para liberar o acesso público à pasta de imagens
app.use('/imagens', express.static('uploads'));


// Conectando as rotas da Suki Doces
// --- ROTAS PÚBLICAS (Loja) ---
// A loja precisa ver os produtos e gerenciar o carrinho
app.use('/suki-doces/usuario', rotaUsuario); // <-- Sem essa linha, não loga/cadastra!
app.use('/suki-doces/produtos', rotaProdutos); 
app.use('/suki-doces/carrinho', rotaCarrinho);
app.use('/suki-doces/chat', rotaChat);

// --- ROTAS PRIVADAS (Painel Admin) ---
// Idealmente, você deve passar o seu authMiddleware aqui para proteger tudo!
app.use('/suki-doces/admin', rotaAdmin); 
app.use('/suki-doces/admin/categorias', rotaCategoria);
app.use('/suki-doces/admin/clientes', rotaCliente); // <-- Mudamos aqui!
app.use('/suki-doces/admin/pedidos', rotaPedidos);
app.use('/suki-doces/admin/notificacoes', rotaNotificacoes);
app.use('/suki-doces/admin/configuracoes', rotaConfig);
app.use(errorHandler);

// Transformamos o teste em uma função de inicialização
async function startServer() {
    try {
        // 1. O jeito Prisma de testar a conexão com o banco
        await prisma.$connect();
        console.log("Conexão com o banco de dados bem-sucedida!");

        // 2. Se o banco conectou, aí sim iniciamos o servidor Express
        app.listen(PORT, () => {
            console.log(`Servidor da loja rodando na porta ${PORT}`);
        });

    } catch (error) {
        // Se o banco falhar, o servidor nem tenta iniciar
        console.error(" Erro fatal: Servidor não iniciou porque o banco de dados falhou.", error);
        process.exit(1); 
    }
}

// Chama a função para dar a partida em tudo
startServer();