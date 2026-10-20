const { spawn } = require('node:child_process');
const path = require('node:path');
function execute(source, milestoneId, recovery = false, nodePath = process.execPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodePath, ['--max-old-space-size=96', path.join(__dirname, 'worker.cjs')], {
      cwd: __dirname, windowsHide: true, shell: false,
      env: { SystemRoot: process.env.SystemRoot || '', WINDIR: process.env.WINDIR || '', ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let output = '', size = 0, settled = false;
    const done = (err, result) => { if (settled) return; settled = true; clearTimeout(timer); err ? reject(err) : resolve(result); };
    const timer = setTimeout(() => { child.kill(); done(new Error('Test run exceeded 8 seconds. Check for loops or long-running handlers.')); }, 8000);
    child.on('error', () => done(new Error('Could not start Node.js test runner. Install Node.js 22.12+ and configure codesense.nodePath if needed.')));
    child.stdin.on('error', () => {});
    child.stderr.resume();
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 100000) { child.kill(); done(new Error('Test runner output limit exceeded.')); } else output += chunk; });
    child.on('close', code => {
      if (code !== 0) return done(new Error('Test worker stopped unexpectedly; check demo code and available memory.'));
      try {
        const result = JSON.parse(output);
        if (result.milestoneId !== milestoneId || result.validity !== 'verified' || !Array.isArray(result.results) || result.results.length < 5 || result.results.some(r => typeof r.passed !== 'boolean')) throw new Error();
        if (result.totalPassed !== result.results.filter(r => r.passed).length || result.totalFailed !== result.results.filter(r => !r.passed).length || result.passed !== (result.totalFailed === 0)) throw new Error();
        done(null, result);
      } catch { done(new Error('Test worker returned an invalid result.')); }
    });
    child.stdin.end(JSON.stringify({ source, milestoneId, recovery }));
  });
}
module.exports = { execute };
