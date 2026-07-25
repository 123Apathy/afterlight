// The tribute questions and the {name} substitution, in plain CommonJS.
//
// Why this is not just part of tribute.ts: server/app.js is CommonJS with no
// TypeScript loader, and the film-export endpoint has to return the questions
// with {name} already filled in so the local renderer never needs Everlit's
// constants. Re-implementing fillName server-side would have meant two copies
// of the possessive rule below, which is exactly the bug it exists to stop.
// The Expo app keeps importing these from ./tribute, which re-exports them.

/** @type {string[]} */
const tributeQuestions = [
  'How would you describe {name}’s love story?',
  'Where was {name} born?',
  'Where did their family come from?',
  'Where did {name} grow up?',
  'What were they like as a child?',
  'How did {name} meet their partner?',
  'What three words best describe {name}?',
  'What were they exceptionally good at?',
  'What dish or meal were they known for?',
  'What was {name}’s favourite song or artist?',
  'What song always reminds you of them?',
  'What was a classic “{name}” saying?',
  'What made them laugh the hardest?',
  'What little habit or quirk instantly reminds you of {name}?',
  'What smell, place, or object always makes you think of them?',
  'What’s the funniest memory you have of {name}?',
  'What’s one moment with them you’ll never forget?',
  'What was their relationship like with their family?',
  'How did they show people they loved them?',
  'What life lesson did {name} teach you?',
  'What are you most grateful to them for?',
  'What was a moment they were truly proud of?',
  'If you could say one last thing to {name}, what would it be?',
  'What do you hope future generations will always remember about them?',
  'Is there anything else you’d like to share about {name}?',
];

// Fill {name}; falls back to a gentle generic if the memorial has no name yet.
// The fallback must handle the possessive too: a bare swap turned
// "{name}’s love story" into "them’s love story" (caught live 2026-07-24), so
// possessive templates fall back to "their" and plain ones to "them".
/**
 * @param {string} text
 * @param {string} [name]
 * @returns {string}
 */
function fillName(text, name) {
  const n = name?.trim();
  if (n) return text.split('{name}').join(n);
  return text
    .split('{name}’s')
    .join('their')
    .split("{name}'s")
    .join('their')
    .split('{name}')
    .join('them');
}

module.exports = { tributeQuestions, fillName };
