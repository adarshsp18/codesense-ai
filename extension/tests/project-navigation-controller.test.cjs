const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');

test('controller switches same-title projects and rejected ideas preserve the active roadmap', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codesense-project-nav-'));
  const roadmap = {
    title: 'Same title',
    milestones: Array.from({ length: 3 }, (_, index) => ({
      title: `Step ${index + 1}`, goal: 'Build a readable page',
      concepts: ['HTML'], expected_behaviors: ['A heading is visible'],
      steps: ['Plan the page'], acceptance_criteria: ['Heading has text'],
    })),
  };
  const stored = {};
  const storage = { get: key => stored[key], update: async (key, value) => { stored[key] = structuredClone(value); } };
  const uri = file => ({ scheme: 'file', fsPath: file, toString: () => file });
  const disposable = { dispose() {} };
  const vscode = {
    Uri: { file: uri, joinPath: (base, ...parts) => uri(path.join(base.fsPath, ...parts)) },
    workspace: {
      isTrusted: true, workspaceFolders: [{ uri: uri(root) }], textDocuments: [],
      getConfiguration: () => ({ get: (key, fallback) => key === 'aiEnabled' ? true : fallback }),
      onDidSaveTextDocument: () => disposable, onDidChangeConfiguration: () => disposable,
      createFileSystemWatcher: () => ({ onDidChange() {}, onDidDelete() {}, onDidCreate() {}, dispose() {} }),
    },
    window: {}, commands: { executeCommand: async () => {} },
  };
  const oldLoad = Module._load, oldFetch = global.fetch;
  let state, receiver, requests = 0;
  Module._load = function (name, ...args) { return name === 'vscode' ? vscode : oldLoad.call(this, name, ...args); };
  global.fetch = async (_url, options) => {
    requests++;
    const idea = JSON.parse(options.body).idea;
    if (idea === 'I want to die.') return {
      ok: false, json: async () => ({
        error: { message: "CodeSense AI helps you build web interfaces. Please describe a website or web application you'd like to create." },
      }),
    };
    return { ok: true, json: async () => structuredClone(roadmap) };
  };
  try {
    const { MentorPanel } = require('../dist/panels/MentorPanel.js');
    const extensionPath = path.resolve(__dirname, '..');
    const panel = new MentorPanel({ workspaceState: storage, extensionPath, extensionUri: uri(extensionPath), subscriptions: [] });
    await panel.resolveWebviewView({ webview: {
      asWebviewUri: value => value.toString(), cspSource: 'test',
      onDidReceiveMessage: fn => { receiver = fn; }, postMessage: value => { state = value; },
    } });
    const act = async message => {
      receiver(message);
      const deadline = Date.now() + 5000;
      while (state.busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(state.busy, false);
    };
    await act({ type: 'roadmap', idea: 'A book club website', difficulty: 'beginner' });
    const firstId = state.roadmap.id;
    await act({ type: 'roadmap', idea: 'An online bookstore', difficulty: 'advanced' });
    const secondId = state.roadmap.id;
    assert.notEqual(firstId, secondId);
    assert.equal(state.custom.projects.length, 2);
    await act({ type: 'home' });
    assert.equal(state.screen, 'home');
    await act({ type: 'customOpen', projectId: firstId });
    assert.equal(state.screen, 'roadmap');
    assert.equal(state.roadmap.id, firstId);
    await act({ type: 'customResume', projectId: secondId });
    assert.equal(state.screen, 'customMilestone');
    assert.equal(state.roadmap.id, secondId);
    const before = structuredClone(stored);
    await act({ type: 'roadmap', idea: 'I want to die.', difficulty: 'beginner' });
    assert.equal(requests, 3);
    assert.equal(state.roadmap.id, secondId);
    assert.equal(state.screen, 'customMilestone');
    assert.deepEqual(stored, before);
    assert.equal(state.notice,
      "CodeSense AI helps you build web interfaces. Please describe a website or web application you'd like to create.");
  } finally {
    Module._load = oldLoad;
    global.fetch = oldFetch;
    const resolved = path.resolve(root);
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('codesense-project-nav-')) throw new Error('Unexpected temporary test path');
    await fs.rm(root, { recursive: true, force: true });
  }
});
