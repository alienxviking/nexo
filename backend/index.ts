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

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/upload", uploadRoutes);

async function startServer() {
  setupSocketHandlers(io);

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer().catch(console.error);
