const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const { getByRole, getByLabelText, isInaccessible } = require('@testing-library/dom');
const vm = require('node:vm');

function visible(node) {
  assert.ok(!isInaccessible(node), 'Element must be visible to accessibility queries.');
  for (let el = node; el; el = el.parentElement) {
    const css = node.ownerDocument.defaultView.getComputedStyle(el);
    assert.notEqual(css.opacity, '0', 'Element must not be transparent.');
  }
  return node;
}
function input(doc) {
  const el = visible(getByRole(doc.body, 'textbox', { name: /^task$/i }));
  assert.equal(el.tagName, 'INPUT', 'Use a native text input.');
  assert.equal(el.type, 'text', 'Use type=text.');
  assert.ok(!el.disabled && !el.readOnly, 'Input must be editable.');
  return el;
}
function button(doc) {
  const el = visible(getByRole(doc.body, 'button', { name: /^add task$/i }));
  assert.equal(el.tagName, 'BUTTON', 'Use a native button.');
  assert.ok(!el.disabled, 'Button must be enabled.');
  return el;
}
function list(doc) {
  const el = visible(getByRole(doc.body, 'list', { name: /^tasks$/i }));
  assert.ok(['UL', 'OL'].includes(el.tagName), 'Use a native ul or ol.');
  return el;
}
function items(doc) { return [...list(doc).children].filter(el => el.tagName === 'LI'); }
function add(doc, text, enter = false) {
  input(doc).value = text;
  input(doc).dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
  if (enter) input(doc).dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  else button(doc).click();
}
const structure = [
  ['input', 'Task input exists', d => input(d)],
  ['button', 'Add Task button exists', d => button(d)],
  ['list', 'Task list exists', d => list(d)],
  ['accessible-label', 'Input has an accessible label', d => assert.equal(getByLabelText(d.body, /^task$/i), input(d))],
  ['semantics', 'Native roles and empty list', d => {
    for (const el of [input(d), button(d), list(d)]) assert.ok(!el.hasAttribute('role'), 'Keep native roles; omit redundant role attributes.');
    assert.equal(items(d).length, 0, 'Start with an empty list.');
  }]
];
const behavior = [
  ['adds-item', 'Click creates a visible list item', d => { add(d, 'Read a chapter'); assert.equal(items(d).length, 1); visible(items(d)[0]); }],
  ['task-text', 'Item contains trimmed task text', d => { add(d, '  Practice JavaScript  '); assert.equal(items(d)[0]?.textContent, 'Practice JavaScript'); }],
  ['clears-input', 'Input clears after success', d => { add(d, 'Read'); assert.equal(input(d).value, ''); }],
  ['rejects-blank', 'Empty and whitespace tasks are rejected', d => { add(d, ''); add(d, '   '); add(d, '\t  '); assert.equal(items(d).length, 0); }],
  ['preserves-items', 'Earlier tasks remain in order', d => { add(d, 'First'); add(d, 'Second'); assert.deepEqual(items(d).map(e => e.textContent), ['First', 'Second']); items(d).forEach(visible); }]
];
const recovery = {
  'html-structure': [['description', 'Help text is visible and connected to input', d => {
    const ids = (input(d).getAttribute('aria-describedby') || '').trim().split(/\s+/).filter(Boolean);
    assert.ok(ids.length > 0, 'Connect help text using aria-describedby.');
    const text = ids.map(id => { const el = d.getElementById(id); assert.ok(el, 'Help text target must exist.'); visible(el); return el.textContent; }).join('');
    assert.ok(text.replace(/\s/g, '').length >= 10, 'Write meaningful help text (at least ten non-space characters).');
  }]],
  'add-task': [
    ['enter-adds', 'Enter adds exactly one visible task', d => { add(d, '  Keyboard task  ', true); assert.equal(items(d).length, 1); assert.equal(items(d)[0].textContent, 'Keyboard task'); visible(items(d)[0]); }],
    ['enter-clears', 'Enter clears the input', d => { add(d, 'Read', true); assert.equal(input(d).value, ''); }],
    ['enter-rejects-blank', 'Enter rejects blank input', d => { add(d, '', true); add(d, '   ', true); assert.equal(items(d).length, 0); }],
    ['enter-preserves', 'Enter and click preserve tasks', d => { add(d, 'First', true); add(d, 'Second', true); add(d, 'Third'); assert.deepEqual(items(d).map(e => e.textContent), ['First', 'Second', 'Third']); }]
  ]
};

function runChecks(source, milestoneId, isRecovery = false) {
  if (!['html-structure', 'add-task'].includes(milestoneId)) throw new Error('Unsupported milestone.');
  // Fresh document for every check. No resource loader, no Node globals supplied.
  // vm + jsdom are NOT a security sandbox. Only reviewed demo sources are supported.
  const checks = milestoneId === 'html-structure' ? [...structure] : [...structure, ...behavior];
  if (isRecovery) checks.push(...recovery[milestoneId]);
  const results = checks.map(([id, name, check]) => {
    let dom;
    try {
      dom = new JSDOM(source.html, { runScripts: 'outside-only', url: 'https://codesense.invalid/', virtualConsole: new VirtualConsole() });
      const d = dom.window.document;
      assert.ok(!d.querySelector('iframe, object, embed, base, meta[http-equiv]'), 'Embedded resources and redirects are outside the demo contract.');
      for (const el of d.querySelectorAll('*')) for (const attr of el.attributes) assert.ok(!/^on/i.test(attr.name), 'Put event listeners in app.js, not inline attributes.');
      const scripts = [...d.querySelectorAll('script')];
      assert.ok(scripts.length === 1 && scripts[0].getAttribute('src') === 'app.js' && !scripts[0].textContent.trim() && !scripts[0].hasAttribute('type'), 'Include exactly one plain script with src=app.js.');
      const style = d.createElement('style'); style.textContent = source.css || ''; d.head.appendChild(style);
      let runtimeError = false;
      dom.window.addEventListener('error', e => { runtimeError = true; e.preventDefault(); });
      if (milestoneId === 'add-task') {
        new vm.Script(source.js, { filename: 'app.js' }).runInContext(dom.getInternalVMContext(), { timeout: 500 });
        d.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
      }
      check(d);
      assert.ok(!runtimeError, 'app.js raised an error. Inspect the code and retry.');
      return { id, name, passed: true, message: 'Passed' };
    } catch (error) {
      // Do not include HTML, learner strings, stack traces or local paths in messages.
      return { id, name, passed: false, message: `Check the milestone requirement: ${name}.` };
    } finally { dom?.window.close(); }
  });
  const totalPassed = results.filter(r => r.passed).length;
  return { milestoneId, kind: isRecovery ? 'recovery' : 'implementation', validity: 'verified', results, totalPassed, totalFailed: results.length - totalPassed, passed: totalPassed === results.length };
}
module.exports = { runChecks };
