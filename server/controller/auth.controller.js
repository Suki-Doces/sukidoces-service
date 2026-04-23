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

// Login exclusivo para Administradores
export async function loginAdmin(req, res, next) {
  try {
    const { email, senha } = req.body;

    // 1. Busca na tabela de ADMINISTRADORES (e não de usuários)
    const admin = await prisma.administradores.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.status(401).json({ mensagem: 'Credenciais de admin inválidas' });
    }

    // 2. Verifica a senha 
    // (Nota: No seu banco está '123456' em texto limpo. Em produção, use bcrypt aqui também!)
    if (senha !== admin.senha) { 
      return res.status(401).json({ mensagem: 'Credenciais de admin inválidas' });
    }

    // 3. Gera o Token com a "role" chumbada como admin
    const token = jwt.sign(
      { 
        id: admin.id_admin, 
        email: admin.email,
        role: 'admin' // ← A mágica acontece aqui!
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      mensagem: 'Login de Administrador bem-sucedido',
      token,
      admin: { id: admin.id_admin, nome: admin.nome, email: admin.email }
    });

  } catch (error) {
    next(error);
  }
}

export async function login(req, res) {
  const { email, senha } = req.body

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'email é obrigatório' })
  }
  if (!senha || typeof senha !== 'string') {
    return res.status(400).json({ message: 'senha é obrigatória' })
  }

  const user = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() }
  })
  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas' })
  }

  const match = await bcrypt.compare(senha, user.senha)
  if (!match) {
    return res.status(401).json({ message: 'Credenciais inválidas' })
  }

  const token = jwt.sign(
    { 
      id: user.id_usuario, 
      email: user.email,
      role: user.role // ← ADICIONE ESSA LINHA AQUI
    },
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
      nivel: user.role, // ← E AQUI TAMBÉM!
    }
  })
}