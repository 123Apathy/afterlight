// Dev: EXPO_PUBLIC_API_BASE in .env points at the local server (Metro serves
// the app on a different port). Deployed: leave it unset and serve the web
// export from the Express server itself, so the API is same-origin.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4400');

// Keep in sync with BUTTON_KEYS in server/app.js.
export type ButtonKey = 'addPhotos' | 'inviteFamily' | 'seeFavourites' | 'shareMemories';

export type Project = {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  createdAt: string;
  enabledButtons: Record<ButtonKey, boolean>;
  // Signed URL of the finished tribute film, present only once published.
  videoUrl?: string | null;
};

export type Reaction = {
  id: string;
  commentId: string;
  rater: string;
  emoji: string;
  createdAt: string;
};

export type Comment = {
  id: string;
  photoId: string;
  author: string;
  text: string;
  createdAt: string;
  reactions: Reaction[];
};

// Curated set the UI offers per comment -- keep in sync with
// COMMENT_REACTION_EMOJI in server/app.js (server is the source of truth /
// validator; this just needs to match so taps never get silently rejected).
export const COMMENT_REACTION_EMOJI = ['❤️', '😂', '😢', '🙏', '😊'];

export type Rating = {
  id: string;
  photoId: string;
  rater: string;
  score: number;
  createdAt: string;
};

export type Photo = {
  id: string;
  url: string;
  // Small display thumbnail (~640px), generated client-side at upload.
  // Null for photos uploaded before thumbnails existed.
  thumbUrl?: string | null;
  originalName: string;
  createdAt: string;
  // Family-added, both optional/free text. photoDate is intentionally a
  // string ("1998", "June 1998", or a full date) since most people only
  // remember the year -- still enough to sort roughly chronologically.
  photoDate?: string | null;
  location?: string | null;
  ratings: Rating[];
  comments: Comment[];
  avgRating: number | null;
  ratingCount: number;
  // Offline demo build only: a bundled require()'d image instead of a URL.
  localSource?: number;
};

export type KanbanColumn = {
  id: string;
  title: string;
  order: number;
};

export type CardNote = {
  id: string;
  cardId: string;
  author: string;
  text: string;
  createdAt: string;
};

export type KanbanCard = {
  id: string;
  columnId: string;
  title: string;
  description: string;
  order: number;
  notes: CardNote[];
};

// Family writes are authorized by the project's invite code (sent as
// X-Invite-Code). Set explicitly when a project is opened; falls back to the
// remembered-projects list in localStorage so a page reload doesn't lose it.
let activeInviteCode = '';
export function setInviteCode(code: string | undefined) {
  activeInviteCode = code || '';
}
function inviteCodeHeader(): Record<string, string> {
  let code = activeInviteCode;
  if (!code && typeof localStorage !== 'undefined') {
    try {
      const id = localStorage.getItem('everlit.activeProjectId');
      const known = JSON.parse(localStorage.getItem('everlit.knownProjects') || '[]');
      const match = Array.isArray(known) && known.find((k: any) => k && k.id === id);
      if (match && match.inviteCode) code = match.inviteCode;
    } catch {
      /* storage blocked / malformed — send nothing, server will 403 */
    }
  }
  return code ? { 'X-Invite-Code': code } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  const headers =
    method === 'GET'
      ? options?.headers
      : { ...inviteCodeHeader(), ...(options?.headers as Record<string, string>) };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${method} ${path} failed (${res.status}): ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function photoUrl(photo: Photo) {
  // photo.url is already a full Supabase signed URL, not a relative path.
  return photo.url;
}

// Display-sized image for grids/backdrops/montages — falls back to full-res
// for photos that predate thumbnails.
export function photoThumbUrl(photo: Photo) {
  return photo.thumbUrl || photo.url;
}

// ~640px JPEG thumbnail via canvas. imageOrientation:'from-image' bakes EXIF
// rotation in (the direct-to-storage upload path no longer passes through the
// server's sharp normalization). Returns null if anything fails — thumbnails
// are an optimization, never a reason to fail an upload.
async function makeThumb(blob: Blob): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  } catch {
    return null;
  }
}

// Favorites reuse the ratings table as a boolean (a row = hearted); there is
// no tier system anymore. ratingCount doubles as the heart count.
export function isFavoritedBy(photo: Photo, rater: string) {
  const name = rater.trim().toLowerCase();
  return photo.ratings.some((r) => r.rater.toLowerCase() === name);
}

export function heartCount(photo: Photo) {
  return photo.ratingCount;
}

// Groups a comment's flat reaction list into [{ emoji, count, mine }] in a
// stable order (COMMENT_REACTION_EMOJI order, only emoji that have at least
// one reaction), so the UI can render pills without re-deriving this itself.
export function reactionSummary(comment: Comment, rater: string) {
  const name = rater.trim().toLowerCase();
  return COMMENT_REACTION_EMOJI.map((emoji) => {
    const withEmoji = comment.reactions.filter((r) => r.emoji === emoji);
    return { emoji, count: withEmoji.length, mine: withEmoji.some((r) => r.rater.toLowerCase() === name) };
  }).filter((r) => r.count > 0);
}

export function inviteUrl(project: Project) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join/${project.inviteCode}`;
}

export const api = {
  createProject: (name: string) =>
    request<Project>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),

  getProject: (projectId: string) => request<Project>(`/api/projects/${projectId}`),

  getProjectByInvite: (inviteCode: string) => request<Project>(`/api/projects/by-invite/${inviteCode}`),

  getPhotos: (projectId: string) => request<Photo[]>(`/api/projects/${projectId}/photos`),

  // Direct-to-Storage upload: mint signed URLs, PUT each file straight to
  // Supabase Storage, then register the paths. The old multipart-to-server
  // route dies on Netlify's ~6MB function body limit; this path has no size
  // ceiling on our side and never buffers files through the function.
  uploadPhotos: async (projectId: string, files: { uri: string; name: string; type: string }[]) => {
    const slots = await request<
      { signedUrl: string; path: string; thumbSignedUrl: string; thumbPath: string; originalName: string }[]
    >(`/api/projects/${projectId}/photos/upload-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: files.map((f) => ({ name: f.name, type: f.type })) }),
    });
    const uploadedThumb: boolean[] = [];
    await Promise.all(
      slots.map(async (slot, i) => {
        // Fetching the picker's uri to a real Blob works uniformly on both web
        // (blob:/data: uris) and native (file:// uris).
        const blob = await (await fetch(files[i].uri)).blob();
        const put = await fetch(slot.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': files[i].type || 'application/octet-stream' },
          body: blob,
        });
        if (!put.ok) throw new Error(`upload to storage failed (${put.status})`);
        const thumb = await makeThumb(blob);
        if (thumb) {
          const putThumb = await fetch(slot.thumbSignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: thumb,
          });
          uploadedThumb[i] = putThumb.ok; // thumb failure never fails the upload
        } else {
          uploadedThumb[i] = false;
        }
      })
    );
    return request<Photo[]>(`/api/projects/${projectId}/photos/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos: slots.map((s, i) => ({
          path: s.path,
          thumbPath: uploadedThumb[i] ? s.thumbPath : null,
          originalName: s.originalName,
        })),
      }),
    });
  },

  deletePhoto: (photoId: string) => request<void>(`/api/photos/${photoId}`, { method: 'DELETE' }),

  // The WhatsApp/link-preview photo -- typically the one displayed at the
  // service, near the casket. Set once by the project creator right after
  // creation; changeable later via the admin dashboard.
  setCoverPhoto: (projectId: string, photoId: string) =>
    request<void>(`/api/projects/${projectId}/cover-photo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId }),
    }),

  submitTribute: (projectId: string, respondent: string, answers: { question: string; answer: string }[]) =>
    request<{ ok: true }>(`/api/projects/${projectId}/tribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respondent, answers }),
    }),

  favoritePhoto: (photoId: string, rater: string) =>
    request<Rating>(`/api/photos/${photoId}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rater }),
    }),

  unfavoritePhoto: (photoId: string, rater: string) =>
    request<void>(`/api/photos/${photoId}/favorite?rater=${encodeURIComponent(rater)}`, { method: 'DELETE' }),

  addComment: (photoId: string, author: string, text: string) =>
    request<Comment>(`/api/photos/${photoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, text }),
    }),

  updatePhotoDetails: (photoId: string, details: { photoDate: string; location: string }) =>
    request<{ id: string; photoDate: string | null; location: string | null }>(
      `/api/photos/${photoId}/details`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      }
    ),

  toggleCommentReaction: (commentId: string, rater: string, emoji: string) =>
    request<Reaction[]>(`/api/comments/${commentId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rater, emoji }),
    }),

  getKanban: (projectId: string) =>
    request<{ columns: KanbanColumn[]; cards: KanbanCard[] }>(`/api/projects/${projectId}/kanban`),

  createCard: (columnId: string, title: string, description: string) =>
    request<KanbanCard>('/api/kanban/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId, title, description }),
    }),

  updateCard: (cardId: string, patch: Partial<Pick<KanbanCard, 'columnId' | 'order' | 'title' | 'description'>>) =>
    request<KanbanCard>(`/api/kanban/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  deleteCard: (cardId: string) => request<void>(`/api/kanban/cards/${cardId}`, { method: 'DELETE' }),

  addCardNote: (cardId: string, author: string, text: string) =>
    request<CardNote>(`/api/kanban/cards/${cardId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, text }),
    }),

  deleteCardNote: (noteId: string) => request<void>(`/api/kanban/notes/${noteId}`, { method: 'DELETE' }),
};
