# Nexo Chat

Nexo is a real-time, premium 1-to-1 private messaging application built with WebSockets, full media support, and a responsive glassmorphism aesthetic.

## Tech Stack
* **Frontend:** Next.js, React, Tailwind CSS, Socket.io-client
* **Backend:** Node.js, Express, Socket.io, Redis (Pub/Sub for message delivery), Prisma (PostgreSQL)

## Features
- Real-time messaging with WebSockets and Redis pub-sub Queueing
- Authentic chat state (ONLINE/OFFLINE, Sent/Delivered/Seen receipts)
- "User is typing..." indicators
- Rich Media: Send Images, Documents, and Voice Notes (with deterministic waveform player)
- Message replying, editing, and deleting
- Self-destructing messages
- Message scheduling

## Getting Started Locally

### Prerequisites
- Node.js (v18+)
- Postgres (running locally or via Docker)
- Redis (running locally or via Docker)

A `docker-compose.yml` is provided to spin up Postgres and Redis quickly:
```bash
docker-compose up -d
```

### 1. Backend Setup
Navigate into the `backend/` directory:
```bash
cd backend
npm install
```

Set up your `.env` file inside `backend/`:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nexo?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your_jwt_secret_here"
```

Initialize the database and run the server:
```bash
npx prisma db push
npx prisma generate
npm run dev
```

### 2. Frontend Setup
Navigate into the `frontend/` directory from a new terminal:
```bash
cd frontend
npm install
```

Set up your `.env.local` file inside `frontend/`:
```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Start the Next.js development server:
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

---

## Production Deployment

Both frontend and backend are ready for containerization or direct hosting.

1. **Frontend**: Can be deployed seamlessly on Vercel. Be sure to define `NEXT_PUBLIC_API_URL` pointing to your backend production URL.
2. **Backend**: Can be deployed on any Node.js hosting platform (Render, Railway, Fly.io, AWS EC2).
   - Ensure you run `npx prisma db push && npm run build` before starting the server with `npm start`.
   - Your host must support WebSockets and provide a stable Postgres/Redis instance accessible to the backend.
