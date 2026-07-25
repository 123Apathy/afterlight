// "When was this taken?" is free text on purpose. Most people only remember the
// year, and "June 1998", "1998" and "the old house, 1998" are all legitimate
// answers, so nothing here rejects anything. This answers one narrow question:
// is there a plausible year in what they typed? If there is not, the photo
// cannot be placed in the story and the memorial film falls back to putting it
// in upload order instead.
//
// It exists because the write path (server/app.js, PATCH photo details) only
// trims and truncates, so "1098" and "Dhdhdh" both reached production on a real
// memorial. Catching it at the point of entry is the only place it stops.
//
// The film bridge (HQ Vault/projects/memorial-video/bridge/make-film.mjs) keeps
// its own copy of this window rather than importing it, so the film's sort rule
// can change without an Everlit deploy. If you widen the window here, widen it
// there too.

export const EARLIEST_PLAUSIBLE_YEAR = 1800;

export function hasReadableYear(text: string): boolean {
  const maxYear = new Date().getFullYear() + 1;
  return (text.match(/\d{4}/g) || []).some((match) => {
    const year = Number(match);
    return year >= EARLIEST_PLAUSIBLE_YEAR && year <= maxYear;
  });
}
