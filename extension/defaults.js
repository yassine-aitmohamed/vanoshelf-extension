const VS_KEY = 'vanoshelf';

const VS_PALETTE = ['#a8670f', '#16736f', '#3a58a8', '#7b4a9c', '#a8434f', '#5b7a16', '#8a6a2e', '#2f6f8f'];

function vsDefaults() {
  return {
    cats: [
      { id: 'res', name: 'Research', color: '#16736f' },
      { id: 'thesis', name: 'Thesis', color: '#3a58a8' },
      { id: 'teach', name: 'Teaching', color: '#a8670f' },
      { id: 'talks', name: 'Talks', color: '#7b4a9c' },
      { id: 'admin', name: 'Admin', color: '#a8434f' }
    ],
    assign: {},
    hidden: [],
    seen: [],
    titles: {},
    discreet: false,
    dark: true,
    showHidden: false,
    view: 'list',
    collapsed: false,
    groupsClosed: {}
  };
}

const VS_DARK_MAP = {
  '#a8670f': '#e0a24a',
  '#16736f': '#4cc2bb',
  '#3a58a8': '#8ea7ec',
  '#7b4a9c': '#c39be0',
  '#a8434f': '#e8848f',
  '#5b7a16': '#a6c95c',
  '#8a6a2e': '#c9b48a',
  '#2f6f8f': '#6fb6d6'
};

function vsColor(color, dark) {
  if (!dark) return color;
  return VS_DARK_MAP[String(color).toLowerCase()] || color;
}

function vsNorm(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const VS_KNOWN = {};

function vsLoad(stored) {
  const s = Object.assign(vsDefaults(), stored || {});
  if (!Array.isArray(s.cats)) s.cats = vsDefaults().cats;
  if (!Array.isArray(s.hidden)) s.hidden = [];
  if (!Array.isArray(s.seen)) s.seen = [];
  if (!s.assign || typeof s.assign !== 'object') s.assign = {};
  if (!s.titles || typeof s.titles !== 'object') s.titles = {};
  if (!s.groupsClosed || typeof s.groupsClosed !== 'object') s.groupsClosed = {};
  return s;
}
