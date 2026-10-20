const { runChecks } = require('./checks.cjs');
let bytes = 0;
let body = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { bytes += Buffer.byteLength(chunk); if (bytes > 250000) process.exit(2); body += chunk; });
process.stdin.on('end', () => {
  try { const payload = JSON.parse(body); process.stdout.write(JSON.stringify(runChecks(payload.source, payload.milestoneId, payload.recovery))); }
  catch { process.stderr.write('Test worker failed.'); process.exitCode = 1; }
});
