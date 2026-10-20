const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomProjectStore, CUSTOM_KEY } = require('../dist/services/CustomProjectStore.js');
const { validateMessage } = require('../dist/services/messages.js');

const roadmap = (title, topic = 'books') => ({
  title,
  milestones: Array.from({ length: 3 }, (_, index) => ({
    title: `Step ${index + 1}`,
    goal: `Build the ${topic} interface`,
    concepts: ['HTML semantics'],
    expected_behaviors: ['A labelled view is visible'],
    steps: ['Plan the structure'],
    acceptance_criteria: ['The view has a heading'],
  })),
});
const storage = initial => {
  const data = structuredClone(initial || {});
  return { data, get: key => data[key], update: async (key, value) => { data[key] = structuredClone(value); } };
};

test('same-title projects keep separate roadmaps, learning evidence, levels and active selection after reload', async () => {
  const saved = storage({ 'codesense.passport.v1': { guidedEvidence: 'untouched' } });
  let store = new CustomProjectStore(saved);
  await store.add(roadmap('My project'), 'beginner');
  const firstId = store.active().id;
  await store.select(1);
  await store.hint(2, { text: 'Consider what a heading communicates.', source: 'Offline hint' });
  await store.question({ question: 'Explain semantic headings.', rubric: ['Meaning', 'Goal', 'Prediction'] });
  await store.explanation('A heading communicates the topic and gives the page structure.', {
    passed: true, source: 'AI rubric assessment', feedback: 'Concepts supported.',
    correct: ['Meaning', 'Goal', 'Prediction'], missing: [], at: '2026-10-20',
  });
  await store.add(roadmap('My project'), 'advanced');
  const secondId = store.active().id;
  assert.notEqual(firstId, secondId);
  assert.equal(store.snapshot().projects.length, 2);
  assert.equal(store.active().entries[1].hintsRequested, 0);
  await store.open(firstId);
  assert.equal(store.active().current, 1);
  assert.equal(store.active().entries[1].explanationAttempts, 1);
  store = new CustomProjectStore(saved);
  assert.equal(store.active().id, firstId);
  assert.equal(store.active().level, 'beginner');
  assert.equal(store.snapshot().projects.find(p => p.id === secondId).level, 'advanced');
  await store.resume(secondId);
  assert.equal(store.active().entries[0].startedAt !== undefined, true);
  assert.equal(store.snapshot().projects.find(p => p.id === firstId).entries[1].hintsRequested, 1);
  assert.deepEqual(saved.data['codesense.passport.v1'], { guidedEvidence: 'untouched' });
});

test('recoverable legacy roadmap joins existing projects without losing current milestone or evidence', async () => {
  const earlier = storage();
  const oldStore = new CustomProjectStore(earlier);
  await oldStore.add(roadmap('Legacy project', 'music'), 'intermediate');
  await oldStore.select(2);
  await oldStore.hint(1, { text: 'Think about the page structure.', source: 'Offline hint' });
  const legacy = oldStore.active();
  const saved = storage();
  let store = new CustomProjectStore(saved);
  await store.add(roadmap('Current project', 'books'), 'beginner');
  const currentId = store.active().id;
  saved.data['codesense.roadmap'] = structuredClone(legacy);
  store = new CustomProjectStore(saved);
  const imported = store.snapshot().projects.find(p => p.title === 'Legacy project');
  assert.equal(store.snapshot().projects.length, 2);
  assert.equal(imported.current, 2);
  assert.equal(imported.level, 'intermediate');
  assert.equal(imported.entries[2].hintsRequested, 1);
  assert.equal(store.active().id, currentId);
  const importedId = imported.id;
  assert.equal(new CustomProjectStore(saved).snapshot().projects.find(p => p.title === 'Legacy project').id, importedId);
  await store.open(importedId);
  assert.equal(new CustomProjectStore(saved).snapshot().projects.length, 2);
  assert.deepEqual(saved.data['codesense.roadmap'], legacy);
});

test('partial legacy evidence is preserved and malformed legacy data stays untouched with a warning', async () => {
  const earlier = storage();
  const oldStore = new CustomProjectStore(earlier);
  await oldStore.add(roadmap('Partial legacy'));
  await oldStore.hint(1, { text: 'Focus on the visible behavior.', source: 'Offline hint' });
  const partial = { ...oldStore.active(), entries: oldStore.active().entries.slice(0, 1) };
  const saved = storage({ 'codesense.roadmap': partial });
  const migrated = new CustomProjectStore(saved);
  assert.equal(migrated.active().entries[0].hintsRequested, 1);
  assert.equal(migrated.active().entries[1].hintsRequested, 0);
  assert.deepEqual(saved.data['codesense.roadmap'], partial);

  const malformed = { ...partial, current: 99 };
  const damaged = storage({ 'codesense.roadmap': malformed, [CUSTOM_KEY]: { schemaVersion: 1, projects: [] } });
  const store = new CustomProjectStore(damaged);
  assert.equal(store.snapshot().projects.length, 1);
  assert.equal(store.active().current, 0);
  assert.equal(store.active().entries[0].hintsRequested, 1);
  assert.match(store.snapshot().migrationWarning, /preserved/);
  await store.add(roadmap('Still usable'));
  assert.equal(store.snapshot().projects.length, 2);
  assert.deepEqual(damaged.data['codesense.roadmap'], malformed);
});

test('Passport summaries alone do not create a missing roadmap', () => {
  const saved = storage({ 'codesense.passport.v1': { customSummary: { title: 'Lost roadmap' } } });
  const store = new CustomProjectStore(saved);
  assert.equal(store.active(), undefined);
  assert.equal(store.snapshot().projects.length, 0);
  assert.equal(saved.data[CUSTOM_KEY], undefined);
});

test('an untouched legacy roadmap is not duplicated after its migrated project advances', async () => {
  const legacy = roadmap('Original roadmap');
  const saved = storage({ 'codesense.roadmap': legacy });
  let store = new CustomProjectStore(saved);
  const id = store.active().id;
  await store.select(2);
  store = new CustomProjectStore(saved);
  assert.equal(store.snapshot().projects.length, 1);
  assert.equal(store.active().id, id);
  assert.equal(store.active().current, 2);
  assert.deepEqual(saved.data['codesense.roadmap'], legacy);
});

test('project opening accepts only a project ID and drops untrusted extra fields', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  assert.deepEqual(validateMessage({ type: 'customOpen', projectId: id, code: 'ignored' }), { type: 'customOpen', projectId: id });
  assert.equal(validateMessage({ type: 'customOpen', projectId: '../other-workspace' }), undefined);
});
