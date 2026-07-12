import { Router } from "express";
import { getGlobalActivity } from "../services/activityFeed.js";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 40, 80);
  const activity = await getGlobalActivity(limit);
  res.json({ activity });
});

export default router;
