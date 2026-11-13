import { fetchIncidents, ack } from './api.js';
import { formatLocal } from './time.js';

const REFRESH_MS = 2000;

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const newBar = document.querySelector('[data-testid="new-bar"]');

let pending = [];

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function ackedMark() {
  const mark = span('acked', 'acked');
  mark.dataset.testid = 'acked';
  return mark;
}

async function onAck(id, button) {
  button.disabled = true;
  try {
    await ack(id);
    button.replaceWith(ackedMark());
  } catch (error) {
    console.error(error);
    button.disabled = false;
  }
}

function row(incident) {
  const li = document.createElement('li');
  li.dataset.testid = 'incident-row';
  li.dataset.id = incident.id;
  li.className = `row ${incident.severity}`;

  const time = document.createElement('time');
  time.dateTime = incident.openedAt;
  time.title = incident.openedAt;
  time.textContent = formatLocal(incident.openedAt);

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'ack';
  button.textContent = 'Ack';
  button.addEventListener('click', () => onAck(incident.id, button));

  li.append(
    span('id', incident.id),
    span('sev', incident.severity),
    span('what', `${incident.service} · ${incident.region} · ${incident.summary}`),
    time,
    button,
  );
  return li;
}

function showRows(incidents) {
  list.prepend(...incidents.map(row));
  empty.hidden = list.children.length > 0;
}

function showNewBar() {
  newBar.hidden = pending.length === 0;
  newBar.textContent = `${pending.length} new incident${pending.length === 1 ? '' : 's'} · show`;
}

function render(incidents) {
  const known = new Set([...list.children].map((li) => li.dataset.id).concat(pending.map((i) => i.id)));
  const fresh = incidents.filter((incident) => !known.has(incident.id));
  loader.remove();
  if (list.children.length === 0) {
    showRows(fresh);
    return;
  }
  pending = [...fresh, ...pending];
  showNewBar();
}

newBar.addEventListener('click', () => {
  showRows(pending);
  pending = [];
  showNewBar();
});

async function refresh() {
  try {
    render((await fetchIncidents()).incidents);
  } catch (error) {
    console.error(error);
  } finally {
    setTimeout(refresh, REFRESH_MS);
  }
}

refresh();
