const fs = require('node:fs');
const path = require('node:path');
const { execute } = require('./process.cjs');
async function main() {
  const [directory, milestoneId = 'add-task', ...flags] = process.argv.slice(2);
  if (!directory || !flags.includes('--trusted-demo')) throw new Error('Usage: node test-runner/src/run-tests.cjs <reviewed-demo-directory> <milestone-id> --trusted-demo [--recovery]. This is NOT a secure sandbox.');
  const dir = path.resolve(directory);
  const read = (name, optional = false) => {
    const file = path.join(dir, name);
    if (optional && !fs.existsSync(file)) return '';
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 60000) throw new Error('Only regular demo files up to 60 KB are supported.');
    return fs.readFileSync(file, 'utf8');
  };
  const result = await execute({ html: read('index.html'), js: read('app.js'), css: read('style.css', true) }, milestoneId, flags.includes('--recovery'));
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 2; });
