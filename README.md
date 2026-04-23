# Suki Doces — API REST

Bem-vindo ao repositório do Back-End da **Suki Doces**, uma loja online familiar. Esta API RESTful foi desenvolvida para gerenciar todo o fluxo do e-commerce, desde o catálogo de produtos até o processamento de pedidos e o painel administrativo.

O sistema está publicado e operando em nuvem na Render, conectado a um banco de dados hospedado na Aiven.io.

---

### Tecnologias Utilizadas

* **Node.js & Express.js:** Base da aplicação e roteamento.
* **Prisma ORM:** Mapeamento objeto-relacional e tipagem segura.
* **MySQL (Aiven):** Banco de dados relacional em nuvem.
* **JWT (JSON Web Token):** Autenticação e autorização seguras.
* **Bcrypt:** Criptografia de senhas no banco de dados.
* **Render:** Hospedagem do Web Service com CI/CD integrado.

---

### Funcionalidades

**Usuários & Segurança**
* Autenticação e autorização baseada em tokens JWT.
* Criptografia de senhas nativa com Bcrypt.
* Controle de acesso por níveis de permissão (Cliente vs. Admin).

**Catálogo & Loja**
* CRUD completo de Produtos (com suporte a upload de imagens).
* Gestão de Categorias e controle de estoque em tempo real.
* Carrinho de Compras inteligente (adicionar, atualizar e remover itens).
* Processamento de Pedidos e Checkout.

**Administração**
* Painel Administrativo para controle de vendas e usuários.
* Sistema interno de Notificações para alertas de novos pedidos.
* Tratamento de erros centralizado com registro de logs.

---

### Pré-requisitos

Antes de começar, você precisará ter as seguintes ferramentas instaladas na sua máquina:
* **Node.js:** Versão 18 ou superior.
* **Git:** Para clonar o repositório.
* **MySQL:** Uma instância rodando localmente ou em nuvem.

---

### Deploy em Produção
A API está publicada e pode ser acessada através da URL base abaixo:
URL Pública: https://suki-doces-api.onrender.com

---

### Como rodar o projeto localmente

**1. Clone o repositório**
```bash
git clone [https://github.com/Suki-Doces/sukidoces-service.git](https://github.com/Suki-Doces/sukidoces-service.git)
cd sukidoces-service
