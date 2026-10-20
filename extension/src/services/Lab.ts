import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
export interface Source { html: string; js: string; css: string }
export class Lab {
  constructor(private extensionPath: string) {}
  folder(): string {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root || root.scheme !== 'file') throw new Error('Open a local folder in VS Code first.');
    return path.join(root.fsPath, 'codesense-lab');
  }
  private async verifyFolder() {
    const dir = this.folder();
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(await fs.realpath(dir)).toLowerCase() !== path.resolve(dir).toLowerCase()) throw new Error('The demo folder must be a real local directory, not a link or junction.');
    const marker = await fs.readFile(path.join(dir, '.codesense-lab.json'), 'utf8');
    if (JSON.parse(marker).project !== 'todo-v1') throw new Error('Start the guided project to create a controlled demo folder.');
  }
  async create() {
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before creating the demo.');
    const dir = this.folder();
    try { await fs.lstat(dir); await this.verifyFolder(); return; }
    catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    // mkdir is deliberately non-recursive: existing learner folders are never overwritten.
    await fs.mkdir(dir);
    const starter = path.join(this.extensionPath, 'runtime', 'test-runner', 'fixtures', 'starter');
    for (const name of ['index.html','app.js','style.css']) await fs.copyFile(path.join(starter, name), path.join(dir, name));
    await fs.writeFile(path.join(dir, '.codesense-lab.json'), JSON.stringify({ project: 'todo-v1' }));
  }
  async source(): Promise<{ source: Source; hash: string }> {
    await this.verifyFolder();
    const read = async (name: string) => {
      const file = path.join(this.folder(), name);
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 60000) throw new Error('Demo files must be regular files smaller than 60 KB.');
      return fs.readFile(file, 'utf8');
    };
    const [html, js, css] = await Promise.all([read('index.html'), read('app.js'), read('style.css')]);
    const source = { html, js, css };
    return { source, hash: createHash('sha256').update(JSON.stringify(source)).digest('hex') };
  }
  async open(name: string) {
    if (!['index.html','app.js','style.css'].includes(name)) throw new Error('Unsupported demo file.');
    await this.verifyFolder();
    await vscode.window.showTextDocument(vscode.Uri.file(path.join(this.folder(), name)), { preview: false });
  }
  async save() {
    const dir = this.folder();
    for (const doc of vscode.workspace.textDocuments) if (path.dirname(doc.uri.fsPath) === dir && doc.isDirty) await doc.save();
  }
}
