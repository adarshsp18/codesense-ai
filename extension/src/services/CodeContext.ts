import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function possibleSecret(text: string): boolean {
  return /AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:authorization|api[_-]?key|secret|password|access[_-]?token|auth[_-]?token|token)\s*["']?\s*[:=]|\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i.test(text);
}
function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
function allowed(file: string): boolean {
  const parts = file.split(/[\\/]/);
  return ['.html','.htm','.css','.js','.jsx','.ts','.tsx','.vue','.svelte'].includes(path.extname(file).toLowerCase())
    && !parts.some(p => p.startsWith('.') || /^(?:node_modules|vendor|secrets?|credentials?)$/i.test(p))
    && !/(?:secret|credential|\.env)/i.test(path.basename(file));
}

// Reads only one explicit editor snapshot; never scans the workspace or persists code.
// undefined means consent was cancelled. An empty string means no code was requested.
export async function approvedCode(mode: 'none' | 'selection' | 'file'): Promise<string | undefined> {
  if (mode === 'none') return '';
  if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before sharing code.');
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') throw new Error('Open a saved web source file in this workspace first.');
  const file = editor.document.uri.fsPath;
  if (!allowed(file)) throw new Error('Share only a web source file. Hidden files, .env files, credentials and dependency folders are excluded.');
  const canonical = await fs.realpath(file);
  if (!allowed(canonical)) throw new Error('The selected file resolves to an excluded path.');
  let inWorkspace = false;
  for (const folder of vscode.workspace.workspaceFolders || []) {
    if (folder.uri.scheme === 'file' && inside(folder.uri.fsPath, file) && inside(await fs.realpath(folder.uri.fsPath), canonical)) inWorkspace = true;
  }
  if (!inWorkspace) throw new Error('Choose relevant code inside the current workspace. External files and links outside it are excluded.');
  if (mode === 'selection' && editor.selection.isEmpty) throw new Error('Select a small relevant snippet first.');
  const code = mode === 'selection' ? editor.document.getText(editor.selection) : editor.document.getText();
  if (!code.trim() || code.length > 4000) throw new Error('Share 1 to 4,000 characters. Select a relevant snippet if the file is larger.');
  if (possibleSecret(code)) throw new Error('Possible secret detected. Remove sensitive content before sharing.');
  const action = mode === 'selection' ? 'Send selection' : 'Send current file';
  const approval = await vscode.window.showWarningMessage(
    `Send these ${code.length} characters from ${path.basename(file)} with the active milestone to the configured AI provider? Confirm this code is relevant and contains no private data.`,
    { modal: true, detail: code }, action,
  );
  return approval === action ? code : undefined;
}
