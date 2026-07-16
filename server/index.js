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

const KANBAN_TEMPLATE = [
  { column: 'todo', title: 'Choose & confirm venue', description: 'Church, funeral home, or outdoor site — check availability and capacity.' },
  { column: 'todo', title: 'Select officiant / celebrant', description: 'Confirm who will lead the service.' },
  { column: 'todo', title: 'Write the obituary', description: 'Draft and approve wording, then submit to publications.' },
  { column: 'todo', title: 'Choose casket/urn or cremation option', description: '' },
  { column: 'todo', title: 'Set date & time', description: 'Coordinate with venue, officiant, and immediate family.' },
  { column: 'todo', title: 'Notify immediate family', description: 'Phone calls before any public notice goes out.' },
  { column: 'progress', title: 'Order flowers', description: 'Casket spray, family flowers, and any donation-in-lieu arrangement.' },
  { column: 'progress', title: 'Arrange catering for reception', description: '' },
  { column: 'progress', title: 'Book transport / hearse', description: '' },
  { column: 'progress', title: 'Prepare order of service / program', description: 'Hymns, readings, eulogy speakers.' },
  { column: 'progress', title: 'Select music & readings', description: '' },
  { column: 'confirmed', title: 'Book photographer/videographer for tribute', description: 'Coordinate with the Afterlight tribute video team.' },
  { column: 'confirmed', title: 'Confirm guest list & send notices', description: '' },
  { column: 'confirmed', title: 'Arrange venue for reception', description: '' },
];

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project'
  );
}

function randomCode(bytes = 6) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function mapProject(row) {
  return { id: row.id, name: row.name, slug: row.slug, inviteCode: row.invite_code, createdAt: row.created_at };
}

function mapRating(row) {
  return { id: row.id, photoId: row.photo_id, rater: row.rater, score: row.score, createdAt: row.created_at };
}

function mapComment(row) {
  return { id: row.id, photoId: row.photo_id, author: row.author, text: row.body, createdAt: row.created_at };
}

function mapColumn(row) {
  return { id: row.id, title: row.title, order: row.order };
}

function mapCard(row, notes = []) {
  return {
    id: row.id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    order: row.order,
    notes: notes.map(mapNote),
  };
}

function mapNote(row) {
  return { id: row.id, cardId: row.card_id, author: row.author, text: row.body, createdAt: row.created_at };
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

async function seedProjectKanban(projectId) {
  const columnIds = {
    todo: `${projectId}-todo`,
    progress: `${projectId}-progress`,
    confirmed: `${projectId}-confirmed`,
  };
  const { error: columnsError } = await supabase.from('afterlight_kanban_columns').insert([
    { id: columnIds.todo, project_id: projectId, title: 'To Do', order: 0 },
    { id: columnIds.progress, project_id: projectId, title: 'In Progress', order: 1 },
    { id: columnIds.confirmed, project_id: projectId, title: 'Confirmed', order: 2 },
  ]);
  assertOk(columnsError);

  const counters = { todo: 0, progress: 0, confirmed: 0 };
  const cardRows = KANBAN_TEMPLATE.map((item) => ({
    column_id: columnIds[item.column],
    title: item.title,
    description: item.description,
    order: counters[item.column]++,
  }));
  const { error: cardsError } = await supabase.from('afterlight_kanban_cards').insert(cardRows);
  assertOk(cardsError);
}

// --- Projects ---

app.post('/api/projects', async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    let project;
    for (let attempt = 0; attempt < 5 && !project; attempt++) {
      const slug = attempt === 0 ? slugify(name) : `${slugify(name)}-${randomCode(2)}`;
      const { data, error } = await supabase
        .from('afterlight_projects')
        .insert({ name: name.trim(), slug, invite_code: randomCode() })
        .select()
        .single();
      if (!error) {
        project = data;
      } else if (error.code !== '23505') {
        throw Object.assign(new Error(error.message), { status: 500 });
      }
    }
    if (!project) throw Object.assign(new Error('could not allocate a unique project slug'), { status: 500 });

    await seedProjectKanban(project.id);
    res.status(201).json(mapProject(project));
  } catch (err) {
    next(err);
  }
});

app.get('/api/projects/:projectId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('afterlight_projects')
      .select('*')
      .eq('id', req.params.projectId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'project not found' });
    res.json(mapProject(data));
  } catch (err) {
    next(err);
  }
});

app.get('/api/projects/by-invite/:inviteCode', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('afterlight_projects')
      .select('*')
      .eq('invite_code', req.params.inviteCode)
      .single();
    if (error || !data) return res.status(404).json({ error: 'invite not found' });
    res.json(mapProject(data));
  } catch (err) {
    next(err);
  }
});

// --- Photos (project-scoped) ---

app.get('/api/projects/:projectId/photos', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { data: photos, error: photosError } = await supabase
      .from('afterlight_photos')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    assertOk(photosError);

    const photoIds = photos.map((p) => p.id);
    const [{ data: ratings, error: ratingsError }, { data: comments, error: commentsError }] = photoIds.length
      ? await Promise.all([
          supabase.from('afterlight_ratings').select('*').in('photo_id', photoIds),
          supabase.from('afterlight_comments').select('*').in('photo_id', photoIds).order('created_at', { ascending: true }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
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

app.post('/api/projects/:projectId/photos', upload.array('photos', 40), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const created = [];
    for (const file of req.files || []) {
      const ext = path.extname(file.originalname) || '.jpg';
      const storagePath = `${projectId}/${crypto.randomUUID()}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(storagePath, file.buffer, { contentType: file.mimetype });
      assertOk(uploadError);

      const { data: row, error: insertError } = await supabase
        .from('afterlight_photos')
        .insert({ storage_path: storagePath, original_name: file.originalname, project_id: projectId })
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

// --- Kanban (project-scoped) ---

app.get('/api/projects/:projectId/kanban', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { data: columns, error: columnsError } = await supabase
      .from('afterlight_kanban_columns')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    assertOk(columnsError);

    const columnIds = columns.map((c) => c.id);
    const { data: cards, error: cardsError } = columnIds.length
      ? await supabase.from('afterlight_kanban_cards').select('*').in('column_id', columnIds).order('order', { ascending: true })
      : { data: [], error: null };
    assertOk(cardsError);

    const cardIds = cards.map((c) => c.id);
    const { data: notes, error: notesError } = cardIds.length
      ? await supabase.from('afterlight_card_notes').select('*').in('card_id', cardIds).order('created_at', { ascending: true })
      : { data: [], error: null };
    assertOk(notesError);

    res.json({
      columns: columns.map(mapColumn),
      cards: cards.map((card) => mapCard(card, notes.filter((n) => n.card_id === card.id))),
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
    res.status(201).json(mapCard(data));
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
    res.json(mapCard(data));
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

// --- Card notes ---

app.post('/api/kanban/cards/:cardId/notes', async (req, res, next) => {
  try {
    const { author, text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const { data, error } = await supabase
      .from('afterlight_card_notes')
      .insert({
        card_id: req.params.cardId,
        author: (author || 'Anonymous').trim() || 'Anonymous',
        body: text.trim(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23503') return res.status(404).json({ error: 'card not found' });
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    res.status(201).json(mapNote(data));
  } catch (err) {
    next(err);
  }
});

app.delete('/api/kanban/notes/:noteId', async (req, res, next) => {
  try {
    const { error } = await supabase.from('afterlight_card_notes').delete().eq('id', req.params.noteId);
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
