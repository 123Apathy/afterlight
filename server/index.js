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
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #161312; color: rgba(255,255,255,0.85); padding: 48px 28px; }
  .page { max-width: 900px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 20px; margin-bottom: 8px; }
  header svg { flex-shrink: 0; }
  h1 { font-size: 34px; font-weight: 600; color: #fff; }
  .sub { color: rgba(228,183,120,0.85); font-size: 14px; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 5px; }
  h2 { font-size: 21px; color: #E4B778; margin: 44px 0 18px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  .photo-card { background: rgba(255,255,255,0.04); border-radius: 12px; overflow: hidden; break-inside: avoid; }
  .photo-wrap { position: relative; }
  .photo-wrap img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
  .badge { position: absolute; top: 10px; left: 10px; height: 28px; padding: 0 10px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #1A1613; background: #E4B778; font-family: 'Manrope', sans-serif; font-size: 13px; }
  .photo-meta { padding: 10px 14px; font-size: 13px; color: rgba(255,255,255,0.6); font-family: 'Manrope', sans-serif; }
  .photo-missing { aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.4); font-family: 'Manrope', sans-serif; font-size: 13px; background: rgba(255,255,255,0.03); }
  .print-tip { margin-top: 10px; font-size: 13px; color: rgba(255,255,255,0.45); font-family: 'Manrope', sans-serif; }
  .comments { list-style: none; padding: 0 14px 12px; font-size: 13px; font-family: 'Manrope', sans-serif; color: rgba(255,255,255,0.75); }
  .comments li { margin-top: 4px; }
  .comments strong { color: #E4B778; font-weight: 600; }
  .arr-column { margin-bottom: 22px; }
  .arr-column h3 { font-size: 16px; color: #fff; margin-bottom: 8px; font-family: 'Manrope', sans-serif; }
  .arr-column .count { color: rgba(255,255,255,0.4); font-weight: 400; margin-left: 6px; }
  .arr-column ul { list-style: none; }
  .arr-column li { padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 14px; font-family: 'Manrope', sans-serif; }
  .card-desc { color: rgba(255,255,255,0.45); }
  .empty { color: rgba(255,255,255,0.35); }
  .story { margin-bottom: 30px; break-inside: avoid; }
  .story h3 { font-size: 17px; color: #E4B778; margin-bottom: 10px; font-family: 'Manrope', sans-serif; }
  .qa { margin-bottom: 13px; }
  .qa .q { font-size: 12px; letter-spacing: 0.3px; color: rgba(255,255,255,0.5); font-family: 'Manrope', sans-serif; }
  .qa .a { font-size: 15px; color: rgba(255,255,255,0.88); margin-top: 3px; line-height: 1.55; }
  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid rgba(228,183,120,0.25); text-align: center; }
  footer .slogan { font-style: italic; font-size: 17px; color: rgba(255,255,255,0.75); }
  footer .brand { margin-top: 6px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: rgba(228,183,120,0.7); font-family: 'Manrope', sans-serif; }
  @media print {
    body { background: #fff; color: #1a1613; }
    .photo-card { background: #f5f1ea; }
    .photo-meta, .comments { color: #555; }
    .comments strong { color: #8a6d3f; }
    h1 { color: #1a1613; } h2 { color: #8a6d3f; }
    .arr-column h3 { color: #1a1613; }
    .arr-column li { border-color: #ddd; }
    .story h3 { color: #8a6d3f; } .qa .q { color: #777; } .qa .a { color: #222; }
    footer .slogan { color: #444; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <svg width="64" height="64" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="hc"><rect x="0" y="64" width="120" height="56" /></clipPath></defs>
      <circle cx="60" cy="50" r="30" fill="none" stroke="#E4B778" stroke-width="2" opacity="0.5" />
      <circle cx="60" cy="50" r="30" fill="#E4B778" clip-path="url(#hc)" />
      <line x1="10" y1="64" x2="110" y2="64" stroke="#E4B778" stroke-width="2" opacity="0.9" />
    </svg>
    <div>
      <h1>${esc(projectRow.name)}</h1>
      <div class="sub">Favourite photos &amp; shared memories</div>
    </div>
  </header>
  <p class="print-tip">Tip: press Ctrl+P (or Share &rarr; Print on your phone) and save as PDF for a permanent copy.</p>

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
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Afterlight local server (Supabase-backed) listening on http://localhost:${PORT}`);
});
