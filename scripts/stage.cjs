const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'extension/runtime');
fs.mkdirSync(runtime, { recursive: true });
fs.copyFileSync(path.join(root, 'shared/guided-projects.json'), path.join(runtime, 'guided-projects.json'));
for (const dir of ['src', 'fixtures']) fs.cpSync(path.join(root, 'test-runner', dir), path.join(runtime, 'test-runner', dir), { recursive: true });
console.log('Staged offline curriculum, references and test runner.');
