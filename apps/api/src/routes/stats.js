import { Router } from "express";
import { getPlatformStats } from "../services/stats.js";

const router = Router();

router.get("/", async (_req, res) => {
  const stats = await getPlatformStats();
  res.json({ stats });
});

export default router;
