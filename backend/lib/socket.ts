import { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "./db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// Track connected users
// Map of userId -> socket.id
const userSockets = new Map<string, string>();

export function setupSocketHandlers(io: SocketIOServer) {
  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error("Authentication error"));
      (socket as any).userId = decoded.userId;
      next();
    });
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    userSockets.set(userId, socket.id);
    
    console.log(`User connected: ${userId} (${socket.id})`);

    // Update DB status to online and broadcast
    prisma.user.update({
      where: { id: userId },
      data: { status: "ONLINE" }
    })
    .then(() => {
      socket.broadcast.emit("user_status", { userId, status: "ONLINE", lastSeen: null });
    })
    .catch(err => console.error("Error setting online status", err));

    socket.on("send_message", async (data) => {
      const { conversationId, content, receiverId } = data;
      try {
        // Save message to database
        const message = await prisma.message.create({
          data: {
            content,
            conversationId,
            senderId: userId,
            status: "SENT",
            replyToId: data.replyToId || null,
            type: data.type || "TEXT",
            fileUrl: data.fileUrl || null,
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            selfDestructAt: data.selfDestructAt ? new Date(data.selfDestructAt) : null,
          },
          include: { 
            sender: { select: { id: true, name: true, avatarUrl: true } },
            replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true } } } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
          },
        });

        // 1. Send receipt back to sender
        socket.emit("message_sent", message);

        // 2. Deliver to receiver if online
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", message);
          
          // Auto-mark delivered
          await prisma.message.update({
            where: { id: message.id },
            data: { status: "DELIVERED" },
          });
          socket.emit("message_delivered", { messageId: message.id });
        }
      } catch (error) {
        console.error("Socket send_message error:", error);
      }
    });

    socket.on("typing", ({ conversationId, receiverId }) => {
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { conversationId, userId });
      }
    });

    socket.on("mark_seen", async ({ messageId, conversationId, senderId }) => {
       try {
         await prisma.message.update({
           where: { id: messageId },
           data: { status: "SEEN" }
         });
         
         const senderSocketId = userSockets.get(senderId);
         if (senderSocketId) {
            io.to(senderSocketId).emit("message_seen", { messageId, conversationId });
         }
       } catch (error) {
         console.error("Mark seen error", error);
       }
    });

    socket.on("edit_message", async ({ messageId, newContent, conversationId, receiverId }) => {
      try {
        const message = await prisma.message.update({
          where: { id: messageId },
          data: { content: newContent, isEdited: true },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
            replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true } } } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
          }
        });
        
        socket.emit("message_edited", message);
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) io.to(receiverSocketId).emit("message_edited", message);
      } catch (error) {
        console.error("Edit message error", error);
      }
    });

    socket.on("delete_message", async ({ messageId, conversationId, receiverId }) => {
      try {
        const message = await prisma.message.update({
          where: { id: messageId },
          data: { isDeleted: true, content: "This message was deleted" },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
            replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true } } } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
          }
        });
        
        socket.emit("message_deleted", message);
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) io.to(receiverSocketId).emit("message_deleted", message);
      } catch (error) {
        console.error("Delete message error", error);
      }
    });

    socket.on("add_reaction", async ({ messageId, emoji, conversationId, receiverId }) => {
      try {
        const existing = await prisma.reaction.findFirst({
          where: { messageId, userId }
        });
        
        let reaction;
        if (existing) {
          if (existing.emoji === emoji) {
            // Remove reaction if same emoji toggled
            await prisma.reaction.delete({ where: { id: existing.id } });
            socket.emit("reaction_removed", { messageId, reactionId: existing.id });
            const receiverSocketId = userSockets.get(receiverId);
            if (receiverSocketId) io.to(receiverSocketId).emit("reaction_removed", { messageId, reactionId: existing.id });
            return;
          } else {
            // Update to new emoji
            reaction = await prisma.reaction.update({
              where: { id: existing.id },
              data: { emoji },
              include: { user: { select: { id: true, name: true } } }
            });
          }
        } else {
          // Create new reaction
          reaction = await prisma.reaction.create({
            data: { emoji, messageId, userId },
            include: { user: { select: { id: true, name: true } } }
          });
        }
        
        socket.emit("reaction_added", { messageId, reaction });
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) io.to(receiverSocketId).emit("reaction_added", { messageId, reaction });
      } catch (error) {
        console.error("Add reaction error", error);
      }
    });

    socket.on("disconnect", async () => {
      userSockets.delete(userId);
      console.log(`User disconnected: ${userId}`);
      
      // Update db status to offline
      await prisma.user.update({
        where: { id: userId },
        data: { status: "OFFLINE", lastSeen: new Date() }
      });

      socket.broadcast.emit("user_status", { userId, status: "OFFLINE", lastSeen: new Date() });
    });
  });

  // Background job to process scheduled and self-destructing messages
  setInterval(async () => {
    try {
      const now = new Date();

      // 1. Send scheduled messages that are due
      const dueMessages = await prisma.message.findMany({
        where: { 
          scheduledAt: { lte: now } 
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
          replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true } } } },
          reactions: { include: { user: { select: { id: true, name: true } } } },
          conversation: { select: { participants: { select: { id: true } } } }
        }
      });

      for (const msg of dueMessages) {
        // Mark as sent by clearing scheduledAt
        await prisma.message.update({
          where: { id: msg.id },
          data: { scheduledAt: null, status: "SENT" }
        });

        const updatedMsg = { ...msg, scheduledAt: null };

        // Distribute to all participants
        for (const p of msg.conversation.participants) {
          const sId = userSockets.get(p.id);
          if (sId) {
            io.to(sId).emit("receive_message", updatedMsg);
          }
        }
      }

      // 2. Self-destruct messages that are due
      const destructMessages = await prisma.message.findMany({
        where: { 
          selfDestructAt: { lte: now },
          isDeleted: false
        },
        include: { conversation: { select: { participants: { select: { id: true } } } } }
      });

      for (const msg of destructMessages) {
        const deletedMsg = await prisma.message.update({
          where: { id: msg.id },
          data: { isDeleted: true, content: "This message self-destructed" },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
            replyTo: { select: { id: true, content: true, sender: { select: { id: true, name: true } } } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
          }
        });

        // Distribute deletion
        for (const p of msg.conversation.participants) {
          const sId = userSockets.get(p.id);
          if (sId) {
            io.to(sId).emit("message_deleted", deletedMsg);
          }
        }
      }

    } catch (e) {
      console.error("Cron job error:", e);
    }
  }, 10000); // Check every 10 seconds
}

// Force TS server to re-evaluate after prisma generate
