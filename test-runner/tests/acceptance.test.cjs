const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runChecks } = require('../src/checks.cjs');
const { execute } = require('../src/process.cjs');
const root = path.join(__dirname, '../fixtures');
const source = { html: fs.readFileSync(path.join(root,'correct/index.html'),'utf8'), js: fs.readFileSync(path.join(root,'correct/app.js'),'utf8'), css: '' };
const recovered = () => ({
  ...source,
  html: source.html.replace('type="text"', 'type="text" aria-describedby="help"').replace('<button', '<p id="help">Write one task you would like to finish.</p><button'),
  js: source.js + "\ninput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addTask(); } });"
});
for (const id of ['html-structure','add-task']) {
  test(`known-correct reference passes ${id}`, () => assert.ok(runChecks(source,id).passed));
  test(`starter fails ${id}`, () => {
    const starter={ html:fs.readFileSync(path.join(root,'starter/index.html'),'utf8'),js:fs.readFileSync(path.join(root,'starter/app.js'),'utf8') };
    assert.equal(runChecks(starter,id).passed,false);
  });
  test(`recovery reference passes ${id}`, () => assert.ok(runChecks(recovered(),id,true).passed));
  test(`unmodified reference fails recovery ${id}`, () => assert.equal(runChecks(source,id,true).passed,false));
}
for (const defect of require('../fixtures/seeded-defects/defects.json')) {
  test(`seeded-defect validation: ${defect.id} detected by ${defect.detects}`, () => {
    const broken={...source}; const key=defect.file==='index.html'?'html':'js';
    assert.ok(broken[key].includes(defect.from), 'Seed must modify the current reference.');
    broken[key]=broken[key].replace(defect.from,defect.to);
    const result=runChecks(broken,defect.milestone);
    assert.equal(result.passed,false);
    assert.equal(result.results.find(r=>r.id===defect.detects).passed,false);
  });
}
test('semantic queries allow different IDs and an ordered list', () => {
  const alternate={...source,html:source.html.replaceAll('new-task','whatever-i-choose').replace('<ul ','<ol ').replace('</ul>','</ol>'),js:source.js.replace("querySelector('ul')","querySelector('ol')")};
  assert.ok(runChecks(alternate,'add-task').passed);
});
test('inline scripts are rejected by the explicit contract', () => assert.equal(runChecks({...source,html:source.html.replace('src="app.js"','')},'add-task').passed,false));
test('hidden description fails recovery', () => {
  const s=recovered();s.html=s.html.replace('id="help"','id="help" hidden');
  assert.equal(runChecks(s,'html-structure',true).results.find(r=>r.id==='description').passed,false);
});
test('missing describedby target fails recovery', () => {
  const s=recovered();s.html=s.html.replace('aria-describedby="help"','aria-describedby="missing"');
  assert.equal(runChecks(s,'html-structure',true).passed,false);
});
test('keyboard-only defects are caught while click behavior still passes', () => {
  const cases = [
    ['enter-clears', "if (event.key === 'Enter') { const old = input.value; addTask(); input.value = old; }"],
    ['enter-rejects-blank', "if (event.key === 'Enter') { if (!input.value.trim()) input.value = 'blank'; addTask(); }"],
    ['enter-preserves', "if (event.key === 'Enter') { list.replaceChildren(); addTask(); }"],
    ['enter-adds', "if (event.key === 'Enter') { addTask(); input.value = 'extra'; addTask(); }"]
  ];
  for (const [id,handler] of cases) {
    const s={...source,js:source.js+`\ninput.addEventListener('keydown', event => { ${handler} });`};
    assert.ok(runChecks(s,'add-task').passed);
    assert.equal(runChecks(s,'add-task',true).results.find(r=>r.id===id).passed,false,id);
  }
});
test('separate process returns genuine structured results', async () => {
  const result=await execute(source,'add-task');
  assert.equal(result.validity,'verified'); assert.equal(result.totalPassed,10); assert.equal(result.totalFailed,0);
});
test('test process does not inherit API secrets', async () => {
  process.env.CODESENSE_TEST_SECRET='must-not-be-inherited';
  try {
    const result=await execute({...source,js:source.js+"\nif (typeof process !== 'undefined' || typeof require !== 'undefined') throw new Error('Node globals exposed');"},'add-task');
    assert.ok(result.passed);
  } finally { delete process.env.CODESENSE_TEST_SECRET; }
});
test('runaway event handler is killed by the parent timeout', { timeout: 12000 }, async () => {
  await assert.rejects(execute({...source,js:"document.querySelector('button').addEventListener('click', () => { while(true) {} });"},'add-task'),/exceeded 8 seconds/);
});
test('runtime errors fail verification', () => assert.equal(runChecks({...source,js:source.js+"\nthrow new Error('bad');"},'add-task').passed,false));
