import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

// Setup multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// POST /api/events - Create an event
app.post('/api/events', async (req, res) => {
  try {
    const event = await prisma.event.create({ data: {} });
    console.log(`Created Event: ${event.id}`);
    res.status(201).json({
      id: event.id,
      createdAt: event.createdAt,
    });
  } catch (error: any) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
});

// GET /api/events/:eventId - Fetch event details (with participants list)
app.get('/api/events/:eventId', async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: true,
      },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json(event);
  } catch (error: any) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event', details: error.message });
  }
});

// POST /api/events/:eventId/join - Join an event as a participant
app.post('/api/events/:eventId/join', async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const count = await prisma.participant.count({
      where: { eventId },
    });

    const participant = await prisma.participant.create({
      data: {
        eventId,
        name: `Guest ${count + 1}`,
      },
    });

    console.log(`Participant ${participant.name} (${participant.id}) joined event ${eventId}`);
    res.status(201).json(participant);
  } catch (error: any) {
    console.error('Error joining event:', error);
    res.status(500).json({ error: 'Failed to join event', details: error.message });
  }
});

// GET /api/events/:eventId/photos - Retrieve all photos for an event
app.get('/api/events/:eventId/photos', async (req, res) => {
  const { eventId } = req.params;
  try {
    const photos = await prisma.photo.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(photos);
  } catch (error: any) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos', details: error.message });
  }
});

// POST /api/events/:eventId/photos - Upload and register photo
app.post('/api/events/:eventId/photos', upload.single('photo'), async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No photo file provided' });
      return;
    }

    const photo = await prisma.photo.create({
      data: {
        eventId,
        imagePath: req.file.filename,
      },
    });

    console.log(`Registered Photo: ${photo.id} inside event ${eventId}. Saved: ${photo.imagePath}`);
    
    // Broadcast to event room
    io.to(eventId).emit('new-photo', photo);

    res.status(201).json(photo);
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo', details: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-event', ({ eventId }) => {
    if (eventId) {
      socket.join(eventId);
      console.log(`Socket ${socket.id} joined event room: ${eventId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
