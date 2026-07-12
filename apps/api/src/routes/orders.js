import { Router } from "express";
import { prisma } from "@repo/database";
import { requireAuth } from "../middleware/auth.js";
import { invalidateUserCache } from "../services/cacheKeys.js";

const router = Router();

router.delete("/:id", requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (order.userId !== req.user.id) {
    return res.status(403).json({ error: "Not your order" });
  }
  if (order.status !== "OPEN") {
    return res.status(400).json({ error: "Only open orders can be cancelled" });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "CANCELLED" },
  });

  await invalidateUserCache(req.user.id);
  res.json({ success: true });
});

export default router;
