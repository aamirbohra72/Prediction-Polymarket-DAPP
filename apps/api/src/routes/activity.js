import { Router } from "express";
import { getGlobalActivity } from "../services/activityFeed.js";
import { optionalAuth } from "../middleware/optionalAuth.js";

const router = Router();

router.get("/", optionalAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 40, 80);
  const type = String(req.query.type || "all");
  if ((type === "mine" || type === "following") && !req.user) {
    return res.status(401).json({ error: "Log in to view this feed" });
  }
  const activity = await getGlobalActivity({
    limit,
    type,
    userId: req.user?.id || null,
  });
  res.json({ activity, meta: { type, limit } });
});

export default router;
