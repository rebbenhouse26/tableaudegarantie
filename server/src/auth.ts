import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const TOKEN_TTL = '7d'

export interface TokenPayload {
  id: number
  email: string
  name: string
}

/** Requête authentifiée : le cabinet courant est attaché à req.cabinet. */
export interface AuthRequest extends Request {
  cabinet?: TokenPayload
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

/** Middleware Express : exige un Bearer token valide. */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' })
  }
  const token = header.slice('Bearer '.length)
  try {
    req.cabinet = jwt.verify(token, JWT_SECRET) as TokenPayload
    next()
  } catch {
    return res.status(401).json({ error: 'Session expirée ou invalide.' })
  }
}
