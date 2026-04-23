import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

export async function register(req, res) {
  const { nome, email, senha } = req.body

  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    return res.status(400).json({ message: 'nome é obrigatório e deve ter pelo menos 2 caracteres' })
  }
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'email é obrigatório' })
  }
  if (!senha || typeof senha !== 'string' || senha.length < 6) {
    return res.status(400).json({ message: 'senha é obrigatória e deve ter pelo menos 6 caracteres' })
  }

  const existing = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() }
  })
  if (existing) {
    return res.status(400).json({ message: 'E-mail já cadastrado' })
  }

  const hashedSenha = await bcrypt.hash(senha, 10)

  const user = await prisma.usuario.create({
    data: {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha: hashedSenha
    }
  })

  const token = jwt.sign(
    {
      id: user.id_usuario, 
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  return res.status(201).json({
    message: 'Usuário criado com sucesso',
    token: token, // Angular: "E o token??? AQUI!"
    user: {
      id: user.id_usuario,
      nome: user.nome,
      email: user.email,
      nivel: user.role,
      data_criacao: user.data_criacao
    }
  })
}

// =======================================================================
// LOGIN UNIFICADO: Aceita tanto Clientes quanto Administradores
// =======================================================================
export async function login(req, res) {
  const { email, senha } = req.body

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'email é obrigatório' })
  }
  if (!senha || typeof senha !== 'string') {
    return res.status(400).json({ message: 'senha é obrigatória' })
  }

  // 1. PRIMEIRO: Tenta encontrar o e-mail na tabela de USUÁRIOS
  const user = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() }
  })

  if (user) {
    // Se achou, verifica a senha criptografada
    const match = await bcrypt.compare(senha, user.senha)
    if (!match) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const token = jwt.sign(
      { id: user.id_usuario, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token: token,
      user: {
        id: user.id_usuario,
        nome: user.nome,
        email: user.email,
        nivel: user.role, // Vai enviar 'cliente' ou o role que estiver lá
      }
    })
  }

  // 2. SEGUNDO: Se não achou na tabela de usuários, tenta na tabela de ADMINISTRADORES
  const admin = await prisma.administradores.findUnique({
    where: { email: email.trim().toLowerCase() }
  })

  if (admin) {
    // Se achou, verifica a senha limpa (conforme o seu banco atual)
    if (senha !== admin.senha) { 
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const token = jwt.sign(
      { id: admin.id_admin, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Aqui está o truque para não quebrar o Angular! 
    // Devolvemos "user" e "nivel" para o frontend não notar a diferença das tabelas.
    return res.status(200).json({
      message: 'Login de Administrador bem-sucedido',
      token: token,
      user: {
        id: admin.id_admin,
        nome: admin.nome,
        email: admin.email,
        nivel: 'admin' // Força a palavra 'admin' para o Angular redirecionar
      }
    })
  }

  // 3. TERCEIRO: Se não achou o e-mail em NENHUMA das duas tabelas, recusa.
  return res.status(401).json({ message: 'Credenciais inválidas' })
}