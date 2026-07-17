import jwt from "jsonwebtoken";
import { prisma } from "@repo/database";
import { config } from "../config.js";
import { formatUser } from "../utils/helpers.js";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: "7d",
  });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    let user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    user = await ensureAdminForConfiguredEmail(user);
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Promote user to admin when email matches ADMIN_EMAIL (idempotent). */
export async function ensureAdminForConfiguredEmail(user) {
  if (!user?.email) return user;
  const adminEmail = (config.adminEmail || "").toLowerCase().trim();
  if (!adminEmail) return user;
  if (user.email.toLowerCase() !== adminEmail) return user;
  if (user.isAdmin) return user;

  return prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: true },
  });
}

export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    let user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    user = await ensureAdminForConfiguredEmail(user);
    const email = user.email.toLowerCase();
    if (!user.isAdmin && email !== config.adminEmail.toLowerCase()) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function authMeHandler(req, res) {
  res.json({ user: formatUser(req.user) });
}
