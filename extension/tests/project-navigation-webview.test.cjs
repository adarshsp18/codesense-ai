const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { CustomProjectStore } = require('../dist/services/CustomProjectStore.js');
const { ProgressStore } = require('../dist/services/ProgressStore.js');

const roadmap = title => ({
  title,
  milestones: Array.from({ length: 3 }, (_, index) => ({
    title: `Step ${index + 1}`, goal: 'Build a readable page',
    concepts: ['HTML'], expected_behaviors: ['A heading is visible'],
    steps: ['Plan the page'], acceptance_criteria: ['The heading has text'],
  })),
});

test('Home lists all projects and exposes open, resume, and back navigation', async () => {
  const saved = {};
  const storage = { get: key => saved[key], update: async (key, value) => { saved[key] = structuredClone(value); } };
  const store = new CustomProjectStore(storage);
  await store.add(roadmap('Same title'), 'beginner');
  const firstId = store.active().id;
  await store.add(roadmap('Same title'), 'advanced');
  const secondId = store.active().id;
  const dom = new JSDOM('<div id="app"></div>', { runScripts: 'outside-only' });
  const messages = [];
  dom.window.acquireVsCodeApi = () => ({
    postMessage: message => messages.push(message), getState: () => ({}), setState() {},
  });
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../media/mentor.js'), 'utf8'));
  const state = {
    type: 'state', screen: 'home', roadmap: store.active(), custom: store.snapshot(),
    project: require('../../shared/guided-projects.json'), progress: new ProgressStore(storage).snapshot(),
    classifications: {}, busy: false, aiEnabled: true,
  };
  const render = () => dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: state }));
  const d = dom.window.document;
  render();
  assert.match(d.querySelector('.brand').textContent, /Build it\. Understand it\./);
  assert.equal(d.querySelectorAll('.project-row').length, 2);
  assert.match(d.body.textContent, /My Projects/);
  assert.match(d.body.textContent, /Beginner/);
  assert.match(d.body.textContent, /Advanced/);
  assert.equal(d.querySelectorAll('.project-row[data-active="true"]').length, 1);
  assert.equal(d.querySelector('[data-action=home]').getAttribute('aria-current'), 'page');
  d.querySelector(`[data-action=customOpen][data-project-id="${firstId}"]`).click();
  assert.equal(messages.at(-1).type, 'customOpen');
  assert.equal(messages.at(-1).projectId, firstId);
  d.querySelector(`[data-action=customResume][data-project-id="${secondId}"]`).click();
  assert.equal(messages.at(-1).type, 'customResume');
  assert.equal(messages.at(-1).projectId, secondId);

  state.screen = 'roadmap'; render();
  assert.equal(d.querySelector('[data-action=home]').getAttribute('aria-current'), null);
  assert.match(d.body.textContent, /Resume Current Milestone/);
  [...d.querySelectorAll('[data-action=home]')].find(button => button.textContent === 'Back to Projects').click();
  assert.equal(messages.at(-1).type, 'home');
  state.screen = 'customMilestone'; render();
  [...d.querySelectorAll('[data-action=savedRoadmap]')].find(button => button.textContent === 'Back to Roadmap').click();
  assert.equal(messages.at(-1).type, 'savedRoadmap');
  dom.window.close();
});

test('a short nonproject Home input shows the exact guidance without posting a roadmap request', () => {
  const dom = new JSDOM('<div id="app"></div>', { runScripts: 'outside-only' });
  const messages = [];
  dom.window.acquireVsCodeApi = () => ({
    postMessage: message => messages.push(message), getState: () => ({}), setState() {},
  });
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../media/mentor.js'), 'utf8'));
  const state = {
    type: 'state', screen: 'home', roadmap: undefined, custom: { schemaVersion: 1, projects: [] },
    project: require('../../shared/guided-projects.json'), progress: { milestones: {} },
    classifications: {}, busy: false, aiEnabled: true,
  };
  dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: state }));
  dom.window.document.getElementById('idea').value = 'asdf';
  dom.window.document.querySelector('[data-action=roadmap]').click();
  assert.equal(messages.filter(message => message.type === 'roadmap').length, 0);
  assert.equal(dom.window.document.querySelector('.notice').textContent,
    "CodeSense AI helps you build web interfaces. Please describe a website or web application you'd like to create.");
  dom.window.close();
});
