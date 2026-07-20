const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { supabase, PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } = require('./supabaseClient');

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

function requireAdmin(req, res, next) {
  const provided = req.get('x-admin-secret') || req.query.secret;
  if (!process.env.ADMIN_SECRET || provided !== process.env.ADMIN_SECRET) {
    return res.status(404).json({ error: 'not found' });
  }
  next();
}

async function signPhotoUrl(storagePath, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error) return null;
  return data.signedUrl;
}

function assertOk(error) {
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

// Fire a notification when a family engages (a tribute is submitted). Sends to
// Telegram (if NOTIFY_TELEGRAM_BOT_TOKEN + NOTIFY_TELEGRAM_CHAT_ID are set) and/or
// a generic webhook (NOTIFY_WEBHOOK_URL). Never throws — a failed notify must not
// break the family's submission.
async function notify(text) {
  const jobs = [];
  const tgToken = process.env.NOTIFY_TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.NOTIFY_TELEGRAM_CHAT_ID;
  if (tgToken && tgChat) {
    jobs.push(
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(5000),
      })
    );
  }
  const hook = process.env.NOTIFY_WEBHOOK_URL;
  if (hook) {
    jobs.push(
      fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `text` and `content` between them cover Slack / Discord / most receivers.
        body: JSON.stringify({ text, content: text }),
        signal: AbortSignal.timeout(5000),
      })
    );
  }
  if (!jobs.length) return;
  try {
    await Promise.allSettled(jobs);
  } catch {
    /* swallow */
  }
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

const ORIENTABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/heic', 'image/heif']);

// Phone cameras always capture landscape and store an EXIF orientation tag telling
// viewers how to rotate for display. Bake that rotation into the pixels here so
// every photo displays upright everywhere, regardless of whether a given viewer
// respects EXIF orientation.
async function normalizeOrientation(buffer, mimetype) {
  if (!ORIENTABLE_MIME_TYPES.has(mimetype)) return buffer;
  try {
    return await sharp(buffer).rotate().toBuffer();
  } catch {
    return buffer;
  }
}

app.post('/api/projects/:projectId/photos', upload.array('photos', 40), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const created = [];
    for (const file of req.files || []) {
      const ext = path.extname(file.originalname) || '.jpg';
      const storagePath = `${projectId}/${crypto.randomUUID()}${ext}`;
      const uploadBuffer = await normalizeOrientation(file.buffer, file.mimetype);
      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(storagePath, uploadBuffer, { contentType: file.mimetype });
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

// --- Favorites (heart/unheart, one per rater per photo) ---
// Reuses the ratings table as a boolean signal: a row means "hearted by
// rater", score is always 1. No tier system anymore.

app.post('/api/photos/:photoId/favorite', async (req, res, next) => {
  try {
    const { rater } = req.body || {};
    if (!rater || typeof rater !== 'string' || !rater.trim()) {
      return res.status(400).json({ error: 'rater is required' });
    }

    const { data, error } = await supabase
      .from('afterlight_ratings')
      .upsert(
        { photo_id: req.params.photoId, rater: rater.trim(), score: 1, updated_at: new Date().toISOString() },
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

app.delete('/api/photos/:photoId/favorite', async (req, res, next) => {
  try {
    const rater = String(req.query.rater || '').trim();
    if (!rater) return res.status(400).json({ error: 'rater is required' });

    const { error } = await supabase
      .from('afterlight_ratings')
      .delete()
      .eq('photo_id', req.params.photoId)
      .eq('rater', rater);
    assertOk(error);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Tribute intake ---
app.post('/api/projects/:projectId/tribute', async (req, res, next) => {
  try {
    const { respondent, answers } = req.body || {};
    if (!respondent || typeof respondent !== 'string' || !respondent.trim()) {
      return res.status(400).json({ error: 'respondent is required' });
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers is required' });
    }

    const { error } = await supabase.from('afterlight_tribute_responses').insert({
      project_id: req.params.projectId,
      respondent: respondent.trim(),
      answers,
    });
    if (error) {
      if (error.code === '23503') return res.status(404).json({ error: 'project not found' });
      throw Object.assign(new Error(error.message), { status: 500 });
    }

    // Notify the operator that a family member just contributed.
    const { data: proj } = await supabase
      .from('afterlight_projects')
      .select('name, invite_code')
      .eq('id', req.params.projectId)
      .maybeSingle();
    if (proj) {
      const origin = `https://${req.get('host')}`;
      const answered = answers.filter((a) => a && String(a.answer || '').trim()).length;
      await notify(
        `📝 Afterlight — ${respondent.trim()} shared memories for "${proj.name}" (${answered} answers).\nResults: ${origin}/api/report/${proj.invite_code}`
      );
    }

    res.status(201).json({ ok: true });
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

// --- Results report (self-contained HTML, print-to-PDF friendly) ---

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Keyed by invite code (the capability families already hold), not raw
// project id, so report URLs can be shared without exposing internal ids.
const REPORT_IMAGE_TTL_SECONDS = 60 * 60 * 24 * 30; // saved/printed reports keep working for a month

app.get('/api/report/:inviteCode', async (req, res, next) => {
  try {
    const { data: projectRow, error: projectError } = await supabase
      .from('afterlight_projects')
      .select('*')
      .eq('invite_code', req.params.inviteCode)
      .single();
    if (projectError || !projectRow) return res.status(404).send('Report not found');
    const projectId = projectRow.id;

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

    const enriched = await Promise.all(
      photos.map(async (photo) => {
        const photoRatings = (ratings || []).filter((r) => r.photo_id === photo.id);
        return {
          url: await signPhotoUrl(photo.storage_path, REPORT_IMAGE_TTL_SECONDS),
          name: photo.original_name,
          favoritedBy: photoRatings.map((r) => r.rater),
          comments: (comments || []).filter((c) => c.photo_id === photo.id),
        };
      })
    );
    enriched.sort((a, b) => b.favoritedBy.length - a.favoritedBy.length);

    const { data: columns, error: columnsError } = await supabase
      .from('afterlight_kanban_columns')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    assertOk(columnsError);
    const columnIds = (columns || []).map((c) => c.id);
    const { data: cards, error: cardsError } = columnIds.length
      ? await supabase.from('afterlight_kanban_cards').select('*').in('column_id', columnIds).order('order', { ascending: true })
      : { data: [], error: null };
    assertOk(cardsError);

    const { data: tributes, error: tributesError } = await supabase
      .from('afterlight_tribute_responses')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    assertOk(tributesError);

    const photoCards = enriched
      .map((p) => {
        const favCount = p.favoritedBy.length;
        const badge = favCount > 0 ? `<span class="badge">&hearts; ${favCount}</span>` : '';
        const meta =
          favCount > 0
            ? `Favourited by ${p.favoritedBy.map(esc).join(', ')}`
            : 'Not favourited yet';
        const commentHtml = p.comments.length
          ? `<ul class="comments">${p.comments
              .map((c) => `<li><strong>${esc(c.author)}</strong> ${esc(c.body)}</li>`)
              .join('')}</ul>`
          : '';
        const imageHtml = p.url
          ? `<img src="${esc(p.url)}" alt="${esc(p.name)}" loading="lazy" />`
          : '<div class="photo-missing">Photo unavailable</div>';
        return `<div class="photo-card">
          <div class="photo-wrap">${imageHtml}${badge}</div>
          <div class="photo-meta">${esc(meta)}</div>
          ${commentHtml}
        </div>`;
      })
      .join('');

    const arrangements = (columns || [])
      .map((column) => {
        const columnCards = (cards || []).filter((c) => c.column_id === column.id);
        const items = columnCards
          .map((c) => `<li>${esc(c.title)}${c.description ? `<span class="card-desc"> — ${esc(c.description)}</span>` : ''}</li>`)
          .join('');
        return `<div class="arr-column"><h3>${esc(column.title)} <span class="count">${columnCards.length}</span></h3><ul>${items || '<li class="empty">Nothing here.</li>'}</ul></div>`;
      })
      .join('');

    const videoUrl =
      projectRow.video_published && projectRow.video_storage_path
        ? await signPhotoUrl(projectRow.video_storage_path, REPORT_IMAGE_TTL_SECONDS)
        : null;

    const tributeHtml = (tributes || [])
      .map((t) => {
        const answers = Array.isArray(t.answers) ? t.answers : [];
        const qa = answers
          .filter((a) => a && String(a.answer || '').trim())
          .map((a) => `<div class="qa"><div class="q">${esc(a.question)}</div><div class="a">${esc(a.answer)}</div></div>`)
          .join('');
        return qa ? `<div class="story"><h3>${esc(t.respondent)}</h3>${qa}</div>` : '';
      })
      .join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(projectRow.name)} — Afterlight results</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Poppins:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', system-ui, sans-serif; background: #191413; color: rgba(255,255,255,0.85); padding: 48px 28px; }
  .page { max-width: 900px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 18px; margin-bottom: 8px; }
  header svg { flex-shrink: 0; }
  h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 38px; font-weight: 600; letter-spacing: -0.6px; color: #fff; }
  .sub { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: rgba(196,154,108,0.9); margin-top: 6px; }
  h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 25px; font-weight: 500; letter-spacing: -0.3px; color: #C49A6C; margin: 48px 0 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  .photo-card { background: rgba(255,255,255,0.045); border: 1px solid rgba(196,154,108,0.12); border-radius: 14px; overflow: hidden; break-inside: avoid; }
  .photo-wrap { position: relative; }
  .photo-wrap img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
  .badge { position: absolute; top: 10px; left: 10px; height: 28px; padding: 0 11px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 500; color: #1A1613; background: #C49A6C; font-size: 13px; }
  .photo-meta { padding: 11px 14px; font-size: 13px; color: rgba(255,255,255,0.6); }
  .photo-missing { aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.4); font-size: 13px; background: rgba(255,255,255,0.03); }
  .print-tip { margin-top: 10px; font-size: 13px; color: rgba(255,255,255,0.45); }
  .video-wrap { background: rgba(255,255,255,0.045); border: 1px solid rgba(196,154,108,0.12); border-radius: 14px; padding: 14px; }
  .video-wrap video { width: 100%; border-radius: 8px; display: block; background: #000; }
  .video-download { display: inline-block; margin-top: 12px; font-size: 13px; color: #C49A6C; }
  .comments { list-style: none; padding: 0 14px 12px; font-size: 13px; color: rgba(255,255,255,0.75); }
  .comments li { margin-top: 4px; }
  .comments strong { color: #C49A6C; font-weight: 500; }
  .arr-column { margin-bottom: 22px; }
  .arr-column h3 { font-size: 15px; font-weight: 500; color: #fff; margin-bottom: 8px; }
  .arr-column .count { color: rgba(255,255,255,0.4); font-weight: 400; margin-left: 6px; }
  .arr-column ul { list-style: none; }
  .arr-column li { padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 14px; }
  .card-desc { color: rgba(255,255,255,0.45); }
  .empty { color: rgba(255,255,255,0.35); }
  .story { margin-bottom: 32px; break-inside: avoid; }
  .story h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 21px; font-weight: 500; color: #C49A6C; margin-bottom: 12px; }
  .qa { margin-bottom: 14px; }
  .qa .q { font-size: 12px; letter-spacing: 0.3px; color: rgba(255,255,255,0.5); }
  .qa .a { font-size: 15px; color: rgba(255,255,255,0.88); margin-top: 3px; line-height: 1.6; }
  footer { margin-top: 58px; padding-top: 22px; border-top: 1px solid rgba(196,154,108,0.25); text-align: center; }
  footer .slogan { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 20px; color: rgba(255,255,255,0.78); }
  footer .brand { margin-top: 8px; font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(196,154,108,0.75); }
  @media print {
    .video-wrap { display: none; }
    body { background: #fff; color: #1a1613; }
    .photo-card { background: #f7f2ea; border-color: #e5d9c4; }
    .photo-meta, .comments { color: #555; }
    .comments strong { color: #9a744a; }
    h1 { color: #1a1613; } h2 { color: #9a744a; }
    .arr-column h3 { color: #1a1613; }
    .arr-column li { border-color: #ddd; }
    .story h3 { color: #9a744a; } .qa .q { color: #777; } .qa .a { color: #222; }
    footer .slogan { color: #333; } footer .brand { color: #9a744a; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <svg width="60" height="60" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <line x1="52" y1="170" x2="188" y2="170" stroke="#C49A6C" stroke-width="4" stroke-linecap="round" opacity="0.9" />
      <path d="M66,170 A54,54 0 0 1 174,170" fill="none" stroke="#C49A6C" stroke-width="8" stroke-linecap="round" />
      <line x1="120" y1="108" x2="120" y2="66" stroke="#C49A6C" stroke-width="6" stroke-linecap="round" />
      <line x1="99" y1="108" x2="102" y2="74" stroke="#C49A6C" stroke-width="5" stroke-linecap="round" opacity="0.85" />
      <line x1="141" y1="108" x2="138" y2="74" stroke="#C49A6C" stroke-width="5" stroke-linecap="round" opacity="0.85" />
      <line x1="78" y1="108" x2="84" y2="82" stroke="#C49A6C" stroke-width="4" stroke-linecap="round" opacity="0.7" />
      <line x1="162" y1="108" x2="156" y2="82" stroke="#C49A6C" stroke-width="4" stroke-linecap="round" opacity="0.7" />
      <circle cx="120" cy="170" r="5" fill="#A6794A" />
    </svg>
    <div>
      <h1>${esc(projectRow.name)}</h1>
      <div class="sub">Favourite photos &amp; shared memories</div>
    </div>
  </header>
  <p class="print-tip">Tip: press Ctrl+P (or Share &rarr; Print on your phone) and save as PDF for a permanent copy.</p>

  ${videoUrl ? `<h2>Tribute video</h2>
  <div class="video-wrap">
    <video controls preload="metadata" src="${esc(videoUrl)}"></video>
    <a class="video-download" href="${esc(videoUrl)}" download>Download video</a>
  </div>` : ''}

  <h2>Photos, most favourited first</h2>
  <div class="grid">${photoCards || '<p class="empty">No photos uploaded yet.</p>'}</div>

  ${tributeHtml ? `<h2>Memories &amp; stories shared</h2><div class="stories">${tributeHtml}</div>` : ''}

  <h2>Arrangements</h2>
  ${arrangements || '<p class="empty">No arrangements board.</p>'}

  <footer>
    <div class="slogan">A memory you can hold.</div>
    <div class="brand">Afterlight · Memorial Films</div>
  </footer>
</div>
</body>
</html>`);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Serve the exported web build (npx expo export --platform web) when present,
// so one deployed server = app + API on a single public origin and the client
// can resolve the API via window.location.origin.
// __dirname points into esbuild's flattened Netlify Function bundle once
// deployed, not the source repo layout, so the naive "../dist" guess only
// works for local dev. Netlify's `included_files` places dist/ at the
// function's cwd instead — try both and use whichever actually has the build.
function resolveDistDir() {
  const candidates = [path.join(__dirname, '..', 'dist'), path.join(process.cwd(), 'dist')];
  return candidates.find((c) => fs.existsSync(path.join(c, 'index.html'))) || candidates[0];
}
const distDir = resolveDistDir();
app.use(express.static(distDir));

// Invite links: inject project-specific preview meta so a shared /join/<code>
// link previews as "You're invited — <name>" instead of the generic app title.
// The SPA still boots and joins the project as normal.
app.get('/join/:code', async (req, res, next) => {
  try {
    let html;
    try {
      html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    } catch {
      return next(); // no web build present (dev) — let it fall through
    }
    const { data: project } = await supabase
      .from('afterlight_projects')
      .select('name')
      .eq('invite_code', req.params.code)
      .maybeSingle();
    if (project && project.name) {
      const name = esc(project.name);
      const host = req.get('host');
      // Optional ?from=<name> personalizes the preview with whoever shared the
      // link (e.g. a family member forwarding it on WhatsApp). Capped and
      // escaped since it's untrusted user input reflected straight into HTML.
      const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim().slice(0, 60) : '';
      const from = esc(fromRaw);
      const title = from ? `${from} invited you — remembering ${name}` : `In loving memory of ${name}`;
      const desc = from
        ? `${from} would love your photos and memories of ${name} here. It's a keepsake for the whole family to treasure — no app or account needed.`
        : `Please add your photos and memories of ${name} here. It's a keepsake for the whole family to treasure — no app or account needed.`;
      const meta = `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Afterlight · Memorial Films" />
    <meta property="og:image" content="https://${esc(host)}/favicon.ico" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />`;
      html = html.replace(/<title>[^<]*<\/title>/i, '').replace(/<head>/i, `<head>${meta}`);
    }
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

// --- Admin: tribute video (uploaded straight from the browser to Supabase
// Storage via a signed upload URL, so the multi-hundred-MB file never has to
// pass through the Netlify Function's small request/response body limit) ---

app.post('/api/admin/projects/:projectId/video/upload-url', requireAdmin, async (req, res, next) => {
  try {
    const { filename } = req.body || {};
    const ext = (filename && path.extname(filename)) || '.mp4';
    const storagePath = `videos/${req.params.projectId}/${Date.now()}${ext}`;
    const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUploadUrl(storagePath);
    assertOk(error);
    res.json({ signedUrl: data.signedUrl, token: data.token, path: storagePath });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/projects/:projectId/video', requireAdmin, async (req, res, next) => {
  try {
    const { storagePath } = req.body || {};
    if (!storagePath || typeof storagePath !== 'string') {
      return res.status(400).json({ error: 'storagePath is required' });
    }
    const { error } = await supabase
      .from('afterlight_projects')
      .update({ video_storage_path: storagePath, video_published: false, video_uploaded_at: new Date().toISOString() })
      .eq('id', req.params.projectId);
    assertOk(error);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/projects/:projectId/video/publish', requireAdmin, async (req, res, next) => {
  try {
    const { published } = req.body || {};
    const { error } = await supabase
      .from('afterlight_projects')
      .update({ video_published: !!published })
      .eq('id', req.params.projectId);
    assertOk(error);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/projects/:projectId/video', requireAdmin, async (req, res, next) => {
  try {
    const { data: projectRow } = await supabase
      .from('afterlight_projects')
      .select('video_storage_path')
      .eq('id', req.params.projectId)
      .single();
    if (projectRow?.video_storage_path) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([projectRow.video_storage_path]);
    }
    const { error } = await supabase
      .from('afterlight_projects')
      .update({ video_storage_path: null, video_published: false, video_uploaded_at: null })
      .eq('id', req.params.projectId);
    assertOk(error);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Private owner dashboard — every memorial + its activity, at a secret path.
// Guarded by ADMIN_SECRET (route 404s if the env var is unset or mismatched).
app.get('/admin/:secret', async (req, res, next) => {
  try {
    if (!process.env.ADMIN_SECRET || req.params.secret !== process.env.ADMIN_SECRET) {
      return res.status(404).send('Not found');
    }
    const [{ data: projects, error: projectsError }, { data: photos }, { data: tributes }, { data: ratings }, { data: comments }] =
      await Promise.all([
        supabase
          .from('afterlight_projects')
          .select('id, name, invite_code, created_at, video_storage_path, video_published'),
        supabase.from('afterlight_photos').select('id, project_id, created_at'),
        supabase.from('afterlight_tribute_responses').select('project_id, created_at'),
        supabase.from('afterlight_ratings').select('photo_id, created_at'),
        supabase.from('afterlight_comments').select('photo_id, created_at'),
      ]);
    assertOk(projectsError);

    const photoProject = new Map((photos || []).map((p) => [p.id, p.project_id]));
    const acc = new Map();
    const bump = (pid, field, when) => {
      if (!pid) return;
      const e = acc.get(pid) || { photos: 0, favs: 0, comments: 0, tributes: 0, last: null };
      e[field] += 1;
      if (when && (!e.last || when > e.last)) e.last = when;
      acc.set(pid, e);
    };
    (photos || []).forEach((p) => bump(p.project_id, 'photos', p.created_at));
    (tributes || []).forEach((t) => bump(t.project_id, 'tributes', t.created_at));
    (ratings || []).forEach((r) => bump(photoProject.get(r.photo_id), 'favs', r.created_at));
    (comments || []).forEach((c) => bump(photoProject.get(c.photo_id), 'comments', c.created_at));

    const ago = (iso) => {
      if (!iso) return '—';
      const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 3600) return `${Math.round(s / 60)}m ago`;
      if (s < 86400) return `${Math.round(s / 3600)}h ago`;
      return `${Math.round(s / 86400)}d ago`;
    };

    const rows = (projects || [])
      .map((p) => ({ ...p, ...(acc.get(p.id) || { photos: 0, favs: 0, comments: 0, tributes: 0, last: p.created_at }) }))
      .sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')));

    const origin = `https://${req.get('host')}`;
    const body = rows
      .map((r) => {
        const shareLink = `${origin}/join/${esc(r.invite_code)}`;
        const videoStatus = r.video_published ? 'Published' : r.video_storage_path ? 'Uploaded' : 'None';
        return `<tr>
        <td class="name">${esc(r.name)}</td>
        <td>${r.photos}</td>
        <td class="${r.favs ? 'hot' : ''}">${r.favs}</td>
        <td>${r.comments}</td>
        <td class="${r.tributes ? 'hot' : ''}">${r.tributes}</td>
        <td class="ago">${ago(r.last)}</td>
        <td class="link"><code class="share-code" data-base="${shareLink}">${shareLink}</code><button class="copy" data-link="${shareLink}" data-base="${shareLink}" type="button">Copy</button></td>
        <td><a href="${origin}/api/report/${esc(r.invite_code)}" target="_blank">results ↗</a></td>
        <td><button class="kanban-toggle" data-project-id="${esc(r.id)}" type="button">Arrangements ▾</button></td>
        <td class="video-cell">
          <span class="video-status" id="video-status-${esc(r.id)}">${videoStatus}</span>
          <label class="video-upload-label">
            Upload
            <input class="video-upload" type="file" accept="video/*" data-project-id="${esc(r.id)}" hidden />
          </label>
          <button
            class="video-publish-toggle"
            type="button"
            data-project-id="${esc(r.id)}"
            data-published="${r.video_published ? 'true' : 'false'}"
            ${r.video_storage_path ? '' : 'disabled'}
          >${r.video_published ? 'Unpublish' : 'Publish'}</button>
        </td>
      </tr>
      <tr class="kanban-row" id="kanban-row-${esc(r.id)}" style="display:none">
        <td colspan="10"><div class="kanban-board" id="kanban-${esc(r.id)}">Loading…</div></td>
      </tr>`;
      })
      .join('');

    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>Afterlight — dashboard</title><meta name="viewport" content="width=device-width, initial-scale=1" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&family=Poppins:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Poppins',system-ui,sans-serif; background:#191413; color:rgba(255,255,255,0.85); padding:40px 24px; }
  .page { max-width:820px; margin:0 auto; }
  h1 { font-family:'Playfair Display',serif; font-size:30px; color:#fff; }
  .sub { color:rgba(196,154,108,0.9); font-size:12px; letter-spacing:2.5px; text-transform:uppercase; margin:6px 0 26px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { text-align:left; font-weight:500; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:rgba(255,255,255,0.45); padding:0 10px 10px; }
  td { padding:12px 10px; border-top:1px solid rgba(255,255,255,0.08); }
  td.name { font-weight:500; color:#fff; }
  td.ago { color:rgba(255,255,255,0.5); }
  td.hot { color:#C49A6C; font-weight:500; }
  td.link { white-space:nowrap; }
  td.link code { font-size:12px; color:rgba(255,255,255,0.6); background:rgba(255,255,255,0.06); padding:3px 7px; border-radius:6px; }
  td.link .copy { margin-left:8px; font-size:12px; color:#C49A6C; background:none; border:1px solid rgba(196,154,108,0.4); border-radius:6px; padding:3px 9px; cursor:pointer; }
  td.link .copy:hover { background:rgba(196,154,108,0.12); }
  a { color:#C49A6C; text-decoration:none; }
  .empty { color:rgba(255,255,255,0.4); margin-top:20px; }
  .kanban-toggle { font-size:12px; color:#C49A6C; background:none; border:1px solid rgba(196,154,108,0.4); border-radius:6px; padding:5px 10px; cursor:pointer; white-space:nowrap; }
  .kanban-toggle:hover { background:rgba(196,154,108,0.12); }
  .kanban-row td { padding:16px 10px 20px; }
  .kanban-board { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .kcol { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; }
  .kcol h4 { font-size:12px; letter-spacing:0.5px; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-bottom:10px; }
  .kcol ul { list-style:none; display:flex; flex-direction:column; gap:8px; }
  .kcol li { font-size:13px; background:rgba(255,255,255,0.04); border-radius:8px; padding:8px 10px; }
  .kcol li.empty { color:rgba(255,255,255,0.35); background:none; padding:0; }
  .kcol .card-desc { display:block; color:rgba(255,255,255,0.45); font-size:12px; margin-top:2px; }
  .video-cell { white-space:nowrap; font-size:12px; }
  .video-status { display:inline-block; min-width:64px; color:rgba(255,255,255,0.6); }
  .video-upload-label { color:#C49A6C; border:1px solid rgba(196,154,108,0.4); border-radius:6px; padding:3px 9px; cursor:pointer; margin:0 6px; }
  .video-upload-label:hover { background:rgba(196,154,108,0.12); }
  .video-publish-toggle { font-size:12px; color:#C49A6C; background:none; border:1px solid rgba(196,154,108,0.4); border-radius:6px; padding:3px 9px; cursor:pointer; }
  .video-publish-toggle:hover:not(:disabled) { background:rgba(196,154,108,0.12); }
  .video-publish-toggle:disabled { opacity:0.35; cursor:not-allowed; }
  .sender-row { display:flex; align-items:center; gap:10px; margin-bottom:22px; }
  .sender-row label { font-size:12px; color:rgba(255,255,255,0.5); }
  .sender-row input { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:6px 10px; font-size:13px; color:#fff; font-family:inherit; width:160px; }
  .sender-row input:focus { outline:1px solid rgba(196,154,108,0.6); }
</style></head><body><div class="page">
  <h1>Memorials</h1>
  <div class="sub">Afterlight · activity dashboard</div>
  <div class="sender-row">
    <label for="sender-name">Your name (added to share links so family sees who sent them)</label>
    <input id="sender-name" type="text" placeholder="e.g. Keegan" maxlength="60" />
  </div>
  ${
    rows.length
      ? `<table><thead><tr><th>Memorial</th><th>Photos</th><th>Favourites</th><th>Comments</th><th>Stories</th><th>Last activity</th><th>Share link</th><th></th><th>Arrangements</th><th>Tribute video</th></tr></thead><tbody>${body}</tbody></table>`
      : '<p class="empty">No memorials yet.</p>'
  }
</div>
<script>
  const ADMIN_SECRET = ${JSON.stringify(req.params.secret)};

  const senderInput = document.getElementById('sender-name');
  function applySenderName() {
    const name = senderInput.value.trim();
    const suffix = name ? '?from=' + encodeURIComponent(name) : '';
    document.querySelectorAll('.share-code').forEach((el) => { el.textContent = el.dataset.base + suffix; });
    document.querySelectorAll('.copy').forEach((el) => { el.dataset.link = el.dataset.base + suffix; });
  }
  senderInput.value = localStorage.getItem('afterlight_sender_name') || '';
  applySenderName();
  senderInput.addEventListener('input', () => {
    localStorage.setItem('afterlight_sender_name', senderInput.value.trim());
    applySenderName();
  });

  document.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.link).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = original; }, 1500);
      });
    });
  });

  function escHtml(text) {
    return String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function renderKanban(data) {
    if (!data.columns.length) return '<p class="empty">No arrangements board for this memorial.</p>';
    return '<div class="kanban-board">' + data.columns.map((col) => {
      const cards = data.cards.filter((c) => c.columnId === col.id);
      const items = cards.map((c) =>
        '<li>' + escHtml(c.title) + (c.description ? '<span class="card-desc">' + escHtml(c.description) + '</span>' : '') + '</li>'
      ).join('') || '<li class="empty">Nothing here.</li>';
      return '<div class="kcol"><h4>' + escHtml(col.title) + '</h4><ul>' + items + '</ul></div>';
    }).join('') + '</div>';
  }

  document.querySelectorAll('.kanban-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const projectId = btn.dataset.projectId;
      const row = document.getElementById('kanban-row-' + projectId);
      const panel = document.getElementById('kanban-' + projectId);
      const isOpen = row.style.display !== 'none';
      if (isOpen) {
        row.style.display = 'none';
        btn.textContent = 'Arrangements ▾';
        return;
      }
      row.style.display = '';
      btn.textContent = 'Arrangements ▴';
      if (!panel.dataset.loaded) {
        try {
          const res = await fetch('/api/projects/' + projectId + '/kanban');
          const data = await res.json();
          panel.innerHTML = renderKanban(data);
          panel.dataset.loaded = '1';
        } catch {
          panel.innerHTML = '<p class="empty">Could not load arrangements.</p>';
        }
      }
    });
  });

  document.querySelectorAll('.video-upload').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const projectId = input.dataset.projectId;
      const statusEl = document.getElementById('video-status-' + projectId);
      const original = statusEl.textContent;
      statusEl.textContent = 'Uploading…';
      try {
        const initRes = await fetch('/api/admin/projects/' + projectId + '/video/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_SECRET },
          body: JSON.stringify({ filename: file.name }),
        });
        if (!initRes.ok) throw new Error('could not start upload');
        const { signedUrl, path: storagePath } = await initRes.json();

        const putRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putRes.ok) throw new Error('upload to storage failed');

        const saveRes = await fetch('/api/admin/projects/' + projectId + '/video', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_SECRET },
          body: JSON.stringify({ storagePath }),
        });
        if (!saveRes.ok) throw new Error('could not save video');

        location.reload();
      } catch (err) {
        statusEl.textContent = original;
        alert('Video upload failed: ' + err.message);
      }
    });
  });

  document.querySelectorAll('.video-publish-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const projectId = btn.dataset.projectId;
      const publish = btn.dataset.published !== 'true';
      btn.disabled = true;
      try {
        const res = await fetch('/api/admin/projects/' + projectId + '/video/publish', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_SECRET },
          body: JSON.stringify({ published: publish }),
        });
        if (!res.ok) throw new Error('could not update');
        location.reload();
      } catch (err) {
        btn.disabled = false;
        alert('Could not update publish state: ' + err.message);
      }
    });
  });
</script>
</body></html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = { app, distDir };
