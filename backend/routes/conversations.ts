import { Router } from "express";
import { prisma } from "../lib/db";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// Get or create conversation between two users
router.post("/get-or-create", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.userId!;

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId is required" });
    }

    const existingConv = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: currentUserId } } },
          { participants: { some: { id: targetUserId } } },
          { participants: { every: { id: { in: [currentUserId, targetUserId] } } } }
        ],
      },
      include: {
        participants: {
          select: { id: true, name: true, avatarUrl: true, status: true, lastSeen: true },
        },
      },
    });

    if (existingConv) {
      return res.json(existingConv);
    }

    // Create new conversation
    const newConv = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUserId }, { id: targetUserId }],
        },
      },
      include: {
        participants: {
          select: { id: true, name: true, avatarUrl: true, status: true, lastSeen: true },
        },
      },
    });

    res.json(newConv);
  } catch (error) {
    console.error("Get/Create Conversation Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get conversations list
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: req.userId },
        },
      },
      include: {
        participants: {
          select: { id: true, name: true, avatarUrl: true, status: true, lastSeen: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get latest message for preview
          select: {
            id: true,
            content: true,
            type: true,
            isDeleted: true,
            senderId: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.json(conversations);
  } catch (error) {
    console.error("List Conversations Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get messages for a conversation
router.get("/:id/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    
    // Verify user is participant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: id,
        participants: { some: { id: req.userId } }
      }
    });

    if (!conversation) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { 
        conversationId: id,
        AND: [
          { OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] }
        ]
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true } } } },
        reactions: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" }
    });

    res.json(messages);
  } catch (error) {
     console.error("List Messages Error:", error);
     res.status(500).json({ error: "Internal server error" });
  }
});

// Search messages within a conversation
router.get("/:id/search", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const query = req.query.q as string;
    
    if (!query) return res.json([]);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: id,
        participants: { some: { id: req.userId } }
      }
    });

    if (!conversation) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { 
        conversationId: id,
        content: { contains: query, mode: "insensitive" },
        AND: [
          { OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] },
          { isDeleted: false }
        ]
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    res.json(messages);
  } catch (error) {
     console.error("Search Messages Error:", error);
     res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
