// Executed by VS Code's real Extension Development Host, not Node directly.
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
exports.run = async function () {
  const extension = vscode.extensions.getExtension('codesense-student-team.codesense-ai');
  assert.ok(extension, 'Extension must be discoverable.');
  await extension.activate();
  assert.ok(extension.isActive);
  const commands = await vscode.commands.getCommands(true);
  for (const name of ['codesense.open','codesense.startGuided','codesense.passport']) assert.ok(commands.includes(name), `Registered: ${name}`);
  await vscode.commands.executeCommand('codesense.open');
  await vscode.commands.executeCommand('codesense.startGuided');
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const lab = path.join(root, 'codesense-lab');
  assert.equal(JSON.parse(await fs.readFile(path.join(lab,'.codesense-lab.json'),'utf8')).project, 'todo-v1');
  for (const file of ['index.html','app.js','style.css']) assert.ok((await fs.stat(path.join(lab,file))).size > 0);
  assert.equal(path.basename(vscode.window.activeTextEditor.document.fileName),'index.html');
  // Creating/resuming a demo must preserve learner edits.
  await fs.appendFile(path.join(lab,'app.js'),'\n// preserved learner edit\n');
  await vscode.commands.executeCommand('codesense.startGuided');
  assert.match(await fs.readFile(path.join(lab,'app.js'),'utf8'),/preserved learner edit/);
  await vscode.commands.executeCommand('codesense.passport');
  await fs.writeFile(path.join(root,'host-test-result.json'),JSON.stringify({passed:true,checks:['activation','three commands registered','sidebar opens','starter files created','real editor opened','resume preserves edits','passport opens']},null,2));
  console.log('CodeSense real Extension Development Host checks passed.');
};
