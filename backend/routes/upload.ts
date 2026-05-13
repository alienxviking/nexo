import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import crypto from "crypto";
import path from "path";

const router = Router();

// Supabase Storage client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "chat-uploads";

// Use multer memory storage (no disk write — upload straight to Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

router.post("/", authenticateToken, upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Generate a unique filename
    const ext = path.extname(req.file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    const filePath = `uploads/${uniqueName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Supabase Storage upload error:", error);
      return res.status(500).json({ error: "Failed to upload file" });
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    res.json({
      url: publicUrlData.publicUrl,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
