// The tribute intake — questions that gather stories for a memorial video.
// Adapted from the Hilary ScoreApp intake, generalised so the same flow serves
// any memorial. {name} is replaced with the memorial's name at render time.

export const tributeCopy = {
  overline: 'In loving memory of {name}',
  introTitle: 'Share your memories',
  introBody:
    'Thank you for helping us honour {name}. The questions that follow are here to capture the stories, memories, and little moments that made them who they were. Please take your time, answer as many as you can, and don’t worry if you can’t remember something — simply press Skip on any you’d like to pass. Most importantly, enjoy remembering them.',
  introCta: 'Begin',
  introSub: 'It only takes a few quiet minutes.',
  thanksTitle: 'Thank you',
  thanksBody:
    'Your memories are a gift. Every story you’ve shared helps bring {name}’s tribute to life — and we hope this was a moment to smile, to remember, and to feel them close again.',
  thanksSignoff: 'Have a wonderful day.',
};

export const tributeQuestions: string[] = [
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
export function fillName(text: string, name?: string): string {
  return text.split('{name}').join(name?.trim() || 'them');
}
