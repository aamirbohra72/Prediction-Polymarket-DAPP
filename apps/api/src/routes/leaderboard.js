import { Router } from "express";
import { getLeaderboardCached } from "../services/leaderboardCache.js";

const router = Router();

router.get("/", async (_req, res) => {
  const data = await getLeaderboardCached();
  res.json({
    leaderboard: data.leaderboard,
    meta: {
      cached: data.fromCache,
      cachedAt: data.cachedAt,
    },
  });
});

export default router;
