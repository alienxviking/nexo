import { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "./db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// Track connected users
// Using Socket.io rooms for reliable delivery across multiple tabs

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
    socket.join(userId);
    
    console.log(`User connected: ${userId} and joined room ${userId}`);

    // Update DB status to online and broadcast
    prisma.user.update({
      where: { id: userId },
      data: { status: "ONLINE" }
    })
    .then(() => {
      socket.broadcast.emit("user_status", { userId, status: "ONLINE", lastSeen: null });
    })
    .catch(err => {
      if (err.code === 'P2025') {
        console.warn(`User ${userId} not found in database. They might need to re-register.`);
      } else {
        console.error("Error setting online status", err);
      }
    });

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

        // 1. Send receipt back to ALL sender's sessions
        io.to(userId).emit("message_sent", { ...message, tempId: data.tempId });

        // 2. Deliver to ALL receiver's sessions
        io.to(receiverId).emit("receive_message", message);
        
        // Auto-mark delivered (if we want to assume delivery if at least one socket exists, 
        // socket.io handles buffering if we use rooms, but for now let's check if anyone is in the room)
        const sockets = await io.in(receiverId).fetchSockets();
        if (sockets.length > 0) {
          await prisma.message.update({
            where: { id: message.id },
            data: { status: "DELIVERED" },
          });
          io.to(userId).emit("message_delivered", { messageId: message.id });
        }
      } catch (error) {
        console.error("Socket send_message error:", error);
      }
    });

    socket.on("typing", ({ conversationId, receiverId }) => {
      io.to(receiverId).emit("typing", { conversationId, userId });
    });

    socket.on("mark_seen", async ({ messageId, conversationId, senderId }) => {
       try {
         await prisma.message.update({
           where: { id: messageId },
           data: { status: "SEEN" }
         });
         
         io.to(senderId).emit("message_seen", { messageId, conversationId });
       } catch (error) {
         console.error("Mark seen error", error);
       }
    });

    socket.on("mark_all_seen", async ({ conversationId, senderId }) => {
      try {
        console.log(`Marking all messages as SEEN for conversation ${conversationId} sent by ${senderId}`);
        await prisma.message.updateMany({
          where: {
            conversationId,
            senderId,
            status: { not: "SEEN" }
          },
          data: { status: "SEEN" }
        });

        console.log(`Notifying sender ${senderId} in room ${senderId}`);
        io.to(senderId).emit("conversation_seen", { conversationId });
      } catch (error) {
        console.error("Mark all seen error", error);
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
        
        io.to(userId).emit("message_edited", message);
        io.to(receiverId).emit("message_edited", message);
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
        
        io.to(userId).emit("message_deleted", message);
        io.to(receiverId).emit("message_deleted", message);
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
            io.to(userId).emit("reaction_removed", { messageId, reactionId: existing.id });
            io.to(receiverId).emit("reaction_removed", { messageId, reactionId: existing.id });
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
        
        io.to(userId).emit("reaction_added", { messageId, reaction });
        io.to(receiverId).emit("reaction_added", { messageId, reaction });
      } catch (error) {
        console.error("Add reaction error", error);
      }
    });

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${userId} (session)`);
      
      const sockets = await io.in(userId).fetchSockets();
      if (sockets.length === 0) {
        // Only mark offline if ALL sessions are gone
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { status: "OFFLINE", lastSeen: new Date() }
          });
          socket.broadcast.emit("user_status", { userId, status: "OFFLINE", lastSeen: new Date() });
        } catch (err: any) {
          if (err.code === 'P2025') {
            console.warn(`User ${userId} disconnected but was not found in database.`);
          } else {
            console.error("Error setting offline status", err);
          }
        }
      }
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

        // Distribute to all participants via rooms
        for (const p of msg.conversation.participants) {
          io.to(p.id).emit("receive_message", updatedMsg);
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

        // Distribute deletion via rooms
        for (const p of msg.conversation.participants) {
          io.to(p.id).emit("message_deleted", deletedMsg);
        }
      }

    } catch (e) {
      console.error("Cron job error:", e);
    }
  }, 10000); // Check every 10 seconds
}

// Force TS server to re-evaluate after prisma generate
