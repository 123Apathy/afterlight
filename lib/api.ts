export const API_BASE = 'http://localhost:4400';

export type Comment = {
  id: string;
  photoId: string;
  author: string;
  text: string;
  createdAt: string;
};

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
  originalName: string;
  createdAt: string;
  ratings: Rating[];
  comments: Comment[];
  avgRating: number | null;
  ratingCount: number;
};

export type KanbanColumn = {
  id: string;
  title: string;
  order: number;
};

export type KanbanCard = {
  id: string;
  columnId: string;
  title: string;
  description: string;
  order: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${options?.method || 'GET'} ${path} failed (${res.status}): ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function photoUrl(photo: Photo) {
  // photo.url is already a full Supabase signed URL, not a relative path.
  return photo.url;
}

export const api = {
  getPhotos: () => request<Photo[]>('/api/photos'),

  uploadPhotos: async (files: { uri: string; name: string; type: string }[]) => {
    const form = new FormData();
    for (const file of files) {
      // Fetching the picker's uri to a real Blob works uniformly on both web
      // (blob:/data: uris) and native (file:// uris) -- the RN-only
      // {uri,name,type} object shape that native prefers doesn't survive
      // react-native-web's fetch/FormData polyfill.
      const blob = await (await fetch(file.uri)).blob();
      form.append('photos', blob, file.name);
    }
    return request<Photo[]>('/api/photos', { method: 'POST', body: form });
  },

  deletePhoto: (photoId: string) => request<void>(`/api/photos/${photoId}`, { method: 'DELETE' }),

  ratePhoto: (photoId: string, rater: string, score: number) =>
    request<Rating>(`/api/photos/${photoId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rater, score }),
    }),

  addComment: (photoId: string, author: string, text: string) =>
    request<Comment>(`/api/photos/${photoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, text }),
    }),

  getKanban: () => request<{ columns: KanbanColumn[]; cards: KanbanCard[] }>('/api/kanban'),

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
};
