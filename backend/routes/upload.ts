import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

router.post("/", authenticateToken, upload.single("file"), (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Return the public URL for the uploaded file
  const fileUrl = `/uploads/${req.file.filename}`;
  
  res.json({ 
    url: fileUrl, 
    filename: req.file.originalname, 
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

export default router;
