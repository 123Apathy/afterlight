const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { getState, mutate } = require('./db');

const PORT = process.env.PORT || 4400;
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (req, file, cb) => {
      const id = crypto.randomUUID();
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${id}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function serializePhoto(photo, state) {
  const ratings = state.ratings.filter((r) => r.photoId === photo.id);
  const comments = state.comments
    .filter((c) => c.photoId === photo.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const avgRating = ratings.length
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : null;
  return { ...photo, ratings, comments, avgRating, ratingCount: ratings.length };
}

// --- Photos ---

app.get('/api/photos', (req, res) => {
  const state = getState();
  res.json(state.photos.map((p) => serializePhoto(p, state)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
});

app.post('/api/photos', upload.array('photos', 40), (req, res) => {
  const created = [];
  mutate((state) => {
    for (const file of req.files || []) {
      const photo = {
        id: id('photo'),
        url: `/uploads/${file.filename}`,
        originalName: file.originalname,
        createdAt: new Date().toISOString(),
      };
      state.photos.push(photo);
      created.push(photo);
    }
  });
  const state = getState();
  res.status(201).json(created.map((p) => serializePhoto(p, state)));
});

app.delete('/api/photos/:photoId', (req, res) => {
  mutate((state) => {
    state.photos = state.photos.filter((p) => p.id !== req.params.photoId);
    state.ratings = state.ratings.filter((r) => r.photoId !== req.params.photoId);
    state.comments = state.comments.filter((c) => c.photoId !== req.params.photoId);
  });
  res.status(204).end();
});

// --- Ratings (one per rater per photo, upsert) ---

app.post('/api/photos/:photoId/rate', (req, res) => {
  const { rater, score } = req.body || {};
  if (!rater || typeof rater !== 'string' || !rater.trim()) {
    return res.status(400).json({ error: 'rater is required' });
  }
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 5) {
    return res.status(400).json({ error: 'score must be 1-5' });
  }

  let result;
  mutate((state) => {
    const photo = state.photos.find((p) => p.id === req.params.photoId);
    if (!photo) return;
    const existing = state.ratings.find(
      (r) => r.photoId === req.params.photoId && r.rater.toLowerCase() === rater.trim().toLowerCase()
    );
    if (existing) {
      existing.score = numericScore;
      existing.updatedAt = new Date().toISOString();
      result = existing;
    } else {
      const rating = {
        id: id('rating'),
        photoId: req.params.photoId,
        rater: rater.trim(),
        score: numericScore,
        createdAt: new Date().toISOString(),
      };
      state.ratings.push(rating);
      result = rating;
    }
  });

  if (!result) return res.status(404).json({ error: 'photo not found' });
  res.status(201).json(result);
});

// --- Comments ---

app.post('/api/photos/:photoId/comments', (req, res) => {
  const { author, text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  let result;
  mutate((state) => {
    const photo = state.photos.find((p) => p.id === req.params.photoId);
    if (!photo) return;
    const comment = {
      id: id('comment'),
      photoId: req.params.photoId,
      author: (author || 'Anonymous').trim() || 'Anonymous',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    state.comments.push(comment);
    result = comment;
  });

  if (!result) return res.status(404).json({ error: 'photo not found' });
  res.status(201).json(result);
});

app.delete('/api/comments/:commentId', (req, res) => {
  mutate((state) => {
    state.comments = state.comments.filter((c) => c.id !== req.params.commentId);
  });
  res.status(204).end();
});

// --- Kanban ---

app.get('/api/kanban', (req, res) => {
  const state = getState();
  res.json({
    columns: [...state.kanbanColumns].sort((a, b) => a.order - b.order),
    cards: [...state.kanbanCards].sort((a, b) => a.order - b.order),
  });
});

app.post('/api/kanban/cards', (req, res) => {
  const { columnId, title, description } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  let result;
  mutate((state) => {
    if (!state.kanbanColumns.some((c) => c.id === columnId)) return;
    const siblingCount = state.kanbanCards.filter((c) => c.columnId === columnId).length;
    const card = {
      id: id('card'),
      columnId,
      title: title.trim(),
      description: (description || '').trim(),
      order: siblingCount,
    };
    state.kanbanCards.push(card);
    result = card;
  });

  if (!result) return res.status(400).json({ error: 'invalid columnId' });
  res.status(201).json(result);
});

app.patch('/api/kanban/cards/:cardId', (req, res) => {
  const { columnId, order, title, description } = req.body || {};
  let result;
  mutate((state) => {
    const card = state.kanbanCards.find((c) => c.id === req.params.cardId);
    if (!card) return;
    if (columnId !== undefined) card.columnId = columnId;
    if (order !== undefined) card.order = order;
    if (title !== undefined) card.title = title;
    if (description !== undefined) card.description = description;
    result = card;
  });
  if (!result) return res.status(404).json({ error: 'card not found' });
  res.json(result);
});

app.delete('/api/kanban/cards/:cardId', (req, res) => {
  mutate((state) => {
    state.kanbanCards = state.kanbanCards.filter((c) => c.id !== req.params.cardId);
  });
  res.status(204).end();
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Afterlight local server listening on http://localhost:${PORT}`);
});
