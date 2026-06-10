import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('Token not provided', 401);
    }

    // Verificação de segurança da chave secreta
    if (!process.env.JWT_SECRET) {
      console.error('ERRO: JWT_SECRET não configurado nas variáveis de ambiente.');
      throw new AppError('Internal Server Configuration Error', 500);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') return next(new AppError('Token expired', 401));
      if (err.name === 'JsonWebTokenError') return next(new AppError('Invalid token', 401));
      return next(err);
    }

    // Atribui o objeto decodificado para req.usuario (padrão do seu sistema)
    req.usuario = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.usuario = decoded;
    }
  } catch (error) {
    // Falha silenciosa: continua como deslogado
  }
  next();
};

export const adminOnly = (req, res, next) => {
  // 🪄 AJUSTE FINO: Aceita 'role' OU 'tipo_usuario' para garantir compatibilidade 
  // entre o banco de dados (que pode usar nomes em português) e o Token JWT.
  const isAdmin = req.usuario && 
                  (req.usuario.role === 'admin' || req.usuario.tipo_usuario === 'admin');

  if (!isAdmin) {
    return res.status(403).json({ 
      mensagem: 'Acesso negado: você não possui permissões de administrador.' 
    });
  }
  next();
};