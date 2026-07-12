import jwt from "jsonwebtoken";
import { prisma } from "@repo/database";
import { config } from "../config.js";

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) req.user = user;
  } catch {
    /* ignore */
  }
  next();
}
