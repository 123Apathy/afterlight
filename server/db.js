const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

const DEFAULT_COLUMNS = [
  { id: 'col-todo', title: 'To Do', order: 0 },
  { id: 'col-progress', title: 'In Progress', order: 1 },
  { id: 'col-confirmed', title: 'Confirmed', order: 2 },
];

const DEFAULT_CARDS = [
  { title: 'Choose & confirm venue', description: 'Church, funeral home, or outdoor site — check availability and capacity.' },
  { title: 'Select officiant / celebrant', description: 'Confirm who will lead the service.' },
  { title: 'Write the obituary', description: 'Draft and approve wording, then submit to publications.' },
  { title: 'Choose casket/urn or cremation option', description: '' },
  { title: 'Set date & time', description: 'Coordinate with venue, officiant, and immediate family.' },
  { title: 'Notify immediate family', description: 'Phone calls before any public notice goes out.' },
  { title: 'Order flowers', description: 'Casket spray, family flowers, and any donation-in-lieu arrangement.' },
  { title: 'Arrange catering for reception', description: '' },
  { title: 'Book transport / hearse', description: '' },
  { title: 'Prepare order of service / program', description: 'Hymns, readings, eulogy speakers.' },
  { title: 'Select music & readings', description: '' },
  { title: 'Book photographer/videographer for tribute', description: 'Coordinate with the Afterlight tribute video team.' },
  { title: 'Confirm guest list & send notices', description: '' },
  { title: 'Arrange venue for reception', description: '' },
].map((card, i) => ({
  id: `card-seed-${i}`,
  columnId: i < 6 ? 'col-todo' : i < 11 ? 'col-progress' : 'col-confirmed',
  order: i,
  ...card,
}));

function defaultData() {
  return {
    photos: [],
    ratings: [],
    comments: [],
    kanbanColumns: DEFAULT_COLUMNS,
    kanbanCards: DEFAULT_CARDS,
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const data = defaultData();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return data;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

let state = load();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

function getState() {
  return state;
}

function mutate(fn) {
  fn(state);
  save();
}

module.exports = { getState, mutate };
