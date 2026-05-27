#  Suki Doces — API REST

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)

Bem-vindo ao repositório do Back-End da **Suki Doces**! Esta API RESTful foi desenvolvida para gerenciar todo o fluxo do nosso e-commerce familiar, proporcionando uma experiência robusta desde a exibição do catálogo até o processamento de pagamentos e painel administrativo.

O sistema está publicado e operando na nuvem através da **Render**, com banco de dados hospedado na **Aiven.io**.

---

##  Funcionalidades Principais

Além do fluxo tradicional de e-commerce, a API foi construída com recursos avançados:

* **Autenticação e Segurança:** Login unificado para clientes e administradores utilizando JWT e senhas criptografadas nativamente com Bcrypt.
* **Assistente Virtual com IA:** Integração direta com o modelo **Google Gemini** (SukiBot) para um chat interativo, que recomenda produtos mapeados com o catálogo.
* **Upload em Nuvem:** Gerenciamento de mídia e imagens de produtos integrados com a API do **Cloudinary**.
* **Checkout Inteligente:** Processamento de pedidos com validação de estoque em tempo real, regras de devolução/cancelamento e aplicação de cupons dinâmicos.
* **Painel Administrativo:** Dashboard completo com métricas de vendas, controle de usuários e um sistema interno de notificações de novos pedidos ou cancelamentos.
* **Carrinho de Compras:** Lógica de negócio embutida para cálculo de subtotais e regras de frete grátis.

---

##  Tecnologias Utilizadas

* **Linguagem & Framework:** Node.js (v18+) e Express.js.
* **Banco de Dados:** MySQL (Hospedado na Aiven.io).
* **ORM:** Prisma ORM, garantindo tipagem segura e facilitando as migrações estruturais.
* **Serviços Externos:** Google Generative AI SDK (Gemini) e Cloudinary SDK.

---

##  Configuração do Ambiente

Para rodar o projeto localmente, você precisará configurar suas variáveis de ambiente. Crie um arquivo `.env` na raiz do projeto seguindo o modelo abaixo:

```env
# Conexão com o Banco de Dados MySQL
DATABASE_URL="mysql://usuario:senha@host:porta/database"

# Chave secreta para assinatura dos tokens JWT
JWT_SECRET="sua_chave_super_secreta"

# Credenciais do Cloudinary (Upload de Imagens)
CLOUDINARY_CLOUD_NAME="seu_cloud_name"
CLOUDINARY_API_KEY="sua_api_key"
CLOUDINARY_API_SECRET="seu_api_secret"

# Credenciais do Google Gemini (Assistente IA)
GEMINI_API_KEY="sua_chave_da_api_gemini"

```

---

##  Como Executar

* **Clone o repositório**
  ```
  git clone [https://github.com/Suki-Doces/sukidoces-service.git](https://github.com/Suki-Doces/sukidoces-service.git)
  ```
* **Instale as dependências**
  ```
  npm install
  ```
* **Configure o Banco de Dados**
  ```
  npx prisma generate
  npx prisma db push
  ```
* **Inicie o servidor**
  ```
  npm run dev
  npm start
  ```
