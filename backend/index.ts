import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./lib/db";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

import path from "path";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import uploadRoutes from "./routes/upload";
import conversationRoutes from "./routes/conversations";
import { setupSocketHandlers } from "./lib/socket";

// Health Check (At the very top for reliability)
app.get("/health", async (req, res) => {
  console.log("Health check pinged at:", new Date().toISOString());
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));


app.get("/", (req, res) => {
  res.send("Nexo API is running! (v2)");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/upload", uploadRoutes);

async function startServer() {
  console.log("🚀 Initializing Nexo Server...");
  
  try {
    console.log("🔌 Setting up Socket.io handlers...");
    setupSocketHandlers(io);
    
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      console.log(`✅ Server is successfully running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ CRITICAL: Server failed to start:", error);
    process.exit(1);
  }
}

startServer();
