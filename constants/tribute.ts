// The tribute intake — questions that gather stories for a memorial video.
// Adapted from the Hilary ScoreApp intake, generalised so the same flow serves
// any memorial. {name} is replaced with the memorial's name at render time.
//
// tributeQuestions and fillName live in ./tribute-questions.js (plain CommonJS)
// so server/app.js can require them too — it has no TypeScript loader. They are
// re-exported here, so every app-side import of '../constants/tribute' is
// unchanged.
export { fillName, tributeQuestions } from './tribute-questions';

export const tributeCopy = {
  overline: 'In loving memory of {name}',
  introTitle: 'Share your memories',
  introBody:
    'Thank you for helping us honour {name}. Share as many memories as you’d like, skip anything you can’t recall, and take your time. Enjoy remembering them.',
  introCta: 'Begin',
  introSub: 'It only takes a few quiet minutes.',
  // 25 questions is a long way to walk in one sitting, and the Close link gave
  // no hint that leaving is safe. Answers already persist to localStorage per
  // memorial; this just says so, so nobody pushes through out of fear of
  // losing what they wrote.
  progressSaveNote: 'Your answers are kept on this device. You can close and come back.',
  thanksTitle: 'Thank you',
  thanksBody:
    'Your memories are a gift. Every story you’ve shared helps bring {name}’s tribute to life, and we hope this was a moment to smile, to remember, and to feel them close again.',
  thanksSignoff: 'Have a wonderful day.',
};

