import { Router } from "express";
import { prisma } from "../lib/db";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// Get current user (Me)
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users (for contacts panel)
router.get("/all", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        NOT: { id: req.userId },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search users
router.get("/search", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Search query required" });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
        NOT: {
          id: req.userId, // Don't return self
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
      },
      take: 20,
    });

    res.json(users);
  } catch (error) {
    console.error("Search Users Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
