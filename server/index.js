const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { supabase, PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } = require('./supabaseClient');

const PORT = process.env.PORT || 4400;
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function mapRating(row) {
  return { id: row.id, photoId: row.photo_id, rater: row.rater, score: row.score, createdAt: row.created_at };
}

function mapComment(row) {
  return { id: row.id, photoId: row.photo_id, author: row.author, text: row.body, createdAt: row.created_at };
}

async function signPhotoUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

function assertOk(error) {
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

// --- Photos ---

app.get('/api/photos', async (req, res, next) => {
  try {
    const [{ data: photos, error: photosError }, { data: ratings, error: ratingsError }, { data: comments, error: commentsError }] =
      await Promise.all([
        supabase.from('afterlight_photos').select('*').order('created_at', { ascending: true }),
        supabase.from('afterlight_ratings').select('*'),
        supabase.from('afterlight_comments').select('*').order('created_at', { ascending: true }),
      ]);
    assertOk(photosError);
    assertOk(ratingsError);
    assertOk(commentsError);

    const result = await Promise.all(
      photos.map(async (photo) => {
        const photoRatings = ratings.filter((r) => r.photo_id === photo.id);
        const photoComments = comments.filter((c) => c.photo_id === photo.id);
        const avgRating = photoRatings.length
          ? photoRatings.reduce((sum, r) => sum + r.score, 0) / photoRatings.length
          : null;
        return {
          id: photo.id,
          url: await signPhotoUrl(photo.storage_path),
          originalName: photo.original_name,
          createdAt: photo.created_at,
          ratings: photoRatings.map(mapRating),
          comments: photoComments.map(mapComment),
          avgRating,
          ratingCount: photoRatings.length,
        };
      })
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/photos', upload.array('photos', 40), async (req, res, next) => {
  try {
    const created = [];
    for (const file of req.files || []) {
      const ext = path.extname(file.originalname) || '.jpg';
      const storagePath = `${crypto.randomUUID()}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(storagePath, file.buffer, { contentType: file.mimetype });
      assertOk(uploadError);

      const { data: row, error: insertError } = await supabase
        .from('afterlight_photos')
        .insert({ storage_path: storagePath, original_name: file.originalname })
        .select()
        .single();
      assertOk(insertError);

      created.push({
        id: row.id,
        url: await signPhotoUrl(row.storage_path),
        originalName: row.original_name,
        createdAt: row.created_at,
        ratings: [],
        comments: [],
        avgRating: null,
        ratingCount: 0,
      });
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/photos/:photoId', async (req, res, next) => {
  try {
    const { data: photo } = await supabase
      .from('afterlight_photos')
      .select('storage_path')
      .eq('id', req.params.photoId)
      .single();
    if (photo) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
    }
    const { error } = await supabase.from('afterlight_photos').delete().eq('id', req.params.photoId);
    assertOk(error);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Ratings (one per rater per photo, upsert) ---

app.post('/api/photos/:photoId/rate', async (req, res, next) => {
  try {
    const { rater, score } = req.body || {};
    if (!rater || typeof rater !== 'string' || !rater.trim()) {
      return res.status(400).json({ error: 'rater is required' });
    }
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 5) {
      return res.status(400).json({ error: 'score must be 1-5' });
    }

    const { data, error } = await supabase
      .from('afterlight_ratings')
      .upsert(
        { photo_id: req.params.photoId, rater: rater.trim(), score: numericScore, updated_at: new Date().toISOString() },
        { onConflict: 'photo_id,rater' }
      )
      .select()
      .single();

    if (error) {
      if (error.code === '23503') return res.status(404).json({ error: 'photo not found' });
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    res.status(201).json(mapRating(data));
  } catch (err) {
    next(err);
  }
});

// --- Comments ---

app.post('/api/photos/:photoId/comments', async (req, res, next) => {
  try {
    const { author, text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const { data, error } = await supabase
      .from('afterlight_comments')
      .insert({
        photo_id: req.params.photoId,
        author: (author || 'Anonymous').trim() || 'Anonymous',
        body: text.trim(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23503') return res.status(404).json({ error: 'photo not found' });
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    res.status(201).json(mapComment(data));
  } catch (err) {
    next(err);
  }
});

app.delete('/api/comments/:commentId', async (req, res, next) => {
  try {
    const { error } = await supabase.from('afterlight_comments').delete().eq('id', req.params.commentId);
    assertOk(error);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Kanban ---

app.get('/api/kanban', async (req, res, next) => {
  try {
    const [{ data: columns, error: columnsError }, { data: cards, error: cardsError }] = await Promise.all([
      supabase.from('afterlight_kanban_columns').select('*').order('order', { ascending: true }),
      supabase.from('afterlight_kanban_cards').select('*').order('order', { ascending: true }),
    ]);
    assertOk(columnsError);
    assertOk(cardsError);
    res.json({
      columns: columns.map((c) => ({ id: c.id, title: c.title, order: c.order })),
      cards: cards.map((c) => ({
        id: c.id,
        columnId: c.column_id,
        title: c.title,
        description: c.description,
        order: c.order,
      })),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/kanban/cards', async (req, res, next) => {
  try {
    const { columnId, title, description } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const { count } = await supabase
      .from('afterlight_kanban_cards')
      .select('*', { count: 'exact', head: true })
      .eq('column_id', columnId);

    const { data, error } = await supabase
      .from('afterlight_kanban_cards')
      .insert({
        column_id: columnId,
        title: title.trim(),
        description: (description || '').trim(),
        order: count || 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23503') return res.status(400).json({ error: 'invalid columnId' });
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    res.status(201).json({
      id: data.id,
      columnId: data.column_id,
      title: data.title,
      description: data.description,
      order: data.order,
    });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/kanban/cards/:cardId', async (req, res, next) => {
  try {
    const { columnId, order, title, description } = req.body || {};
    const patch = {};
    if (columnId !== undefined) patch.column_id = columnId;
    if (order !== undefined) patch.order = order;
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;

    const { data, error } = await supabase
      .from('afterlight_kanban_cards')
      .update(patch)
      .eq('id', req.params.cardId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'card not found' });
    res.json({
      id: data.id,
      columnId: data.column_id,
      title: data.title,
      description: data.description,
      order: data.order,
    });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/kanban/cards/:cardId', async (req, res, next) => {
  try {
    const { error } = await supabase.from('afterlight_kanban_cards').delete().eq('id', req.params.cardId);
    assertOk(error);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Afterlight local server (Supabase-backed) listening on http://localhost:${PORT}`);
});
