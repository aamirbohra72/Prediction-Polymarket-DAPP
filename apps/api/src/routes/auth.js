import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma, Prisma } from "@repo/database";
import { config } from "../config.js";
import { signToken } from "../middleware/auth.js";
import { formatUser } from "../utils/helpers.js";
import { sendWelcomeEmail } from "@repo/platform/email";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "Email and password (min 6 chars) required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isAdmin = normalizedEmail === config.adminEmail.toLowerCase();

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          balance: new Prisma.Decimal(config.initialBalance),
          isAdmin,
          displayName: displayName ? String(displayName).trim().slice(0, 32) : null,
        },
      });

      await tx.transaction.create({
        data: {
          userId: created.id,
          type: "DEPOSIT_INITIAL",
          amount: new Prisma.Decimal(config.initialBalance),
          balanceAfter: new Prisma.Decimal(config.initialBalance),
          note: "Welcome bonus",
        },
      });

      return created;
    });

    sendWelcomeEmail(user).catch((err) =>
      console.warn("[email] welcome:", err.message)
    );

    const token = signToken(user);
    res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
