import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ProgressStore, classification } from '../services/ProgressStore';
import { BackendClient } from '../services/BackendClient';
import { Lab } from '../services/Lab';
import { validateMessage, Message } from '../services/messages';
import { MilestoneId, Project, TestResult } from '../types';
import { CustomProjectStore, LearningLevel, parseAssessment, parseReview } from '../services/CustomProjectStore';
import { approvedCode, possibleSecret } from '../services/CodeContext';

export class MentorPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private project!: Project;
  private screen = 'home';
  private selected: MilestoneId = 'html-structure';
  private busy = false;
  private notice = '';
  private hint?: { text: string; source: string; level: number };
  private roadmap?: unknown;
  private backend = new BackendClient();
  private store: ProgressStore;
  private lab: Lab;
  private custom: CustomProjectStore;
  constructor(private context: vscode.ExtensionContext) {
    this.store = new ProgressStore(context.workspaceState);
    this.lab = new Lab(context.extensionPath);
    this.custom = new CustomProjectStore(context.workspaceState);
    this.roadmap = this.custom.active();
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
      try { if (path.dirname(doc.uri.fsPath) === this.lab.folder()) void this.refreshHash().then(() => this.render()); } catch { /* no local folder */ }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => this.render()));
    const watcher = vscode.workspace.createFileSystemWatcher('**/codesense-lab/*');
    const changed = () => void this.refreshHash().then(() => this.render());
    watcher.onDidChange(changed); watcher.onDidDelete(changed); watcher.onDidCreate(changed);
    context.subscriptions.push(watcher);
  }
  async resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    this.project = JSON.parse(await fs.readFile(path.join(this.context.extensionPath, 'runtime/guided-projects.json'), 'utf8'));
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    const nonce = randomBytes(24).toString('hex');
    const resource = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', name));
    webview.html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource}; font-src ${webview.cspSource}; connect-src 'none'; base-uri 'none'; form-action 'none';"><link rel="stylesheet" href="${resource('mentor.css')}"><title>CodeSense AI</title></head><body><div id="app"></div><script nonce="${nonce}" src="${resource('mentor.js')}"></script></body></html>`;
    webview.onDidReceiveMessage(raw => void this.receive(raw), undefined, this.context.subscriptions);
    await this.refreshHash();
    this.render();
  }
  private async refreshHash() {
    try { await this.store.syncHash((await this.lab.source()).hash); }
    catch { await this.store.syncHash('unavailable'); }
  }
  private render() {
    if (!this.view || !this.project) return;
    const progress = this.store.snapshot();
    const classifications = Object.fromEntries(Object.entries(progress.milestones).map(([id, e]) => [id, classification(e)]));
    this.roadmap = this.custom.active();
    void this.view.webview.postMessage({ type: 'state', screen: this.screen, selected: this.selected, project: this.project, progress, classifications, busy: this.busy, notice: this.notice, hint: this.hint, roadmap: this.roadmap, custom: this.custom.snapshot(), aiEnabled: this.backend.enabled });
  }
  async navigate(screen: string) {
    this.screen = screen;
    await vscode.commands.executeCommand('codesense.mentor.focus');
    this.render();
  }
  async start() {
    try { await this.lab.create(); this.screen = 'milestone'; this.selected = 'html-structure'; await this.lab.open('index.html'); await this.refreshHash(); this.render(); }
    catch (error) { void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Could not create demo.'); }
  }
  private async receive(raw: unknown) {
    const message = validateMessage(raw);
    if (!message) { this.notice = 'Invalid request. Check required fields and try again.'; this.render(); return; }
    if (message.type === 'ready') { this.render(); return; }
    if (this.busy) return;
    this.busy = true; this.notice = ''; this.render();
    try { await this.act(message); }
    catch (error) { this.notice = error instanceof Error ? error.message : 'Something went wrong. Please retry.'; }
    finally { this.busy = false; this.render(); }
  }
  private async act(m: Message) {
    if (m.type === 'home' || m.type === 'passport') { this.screen = m.type; await this.refreshHash(); return; }
    if (m.type === 'settings') { await vscode.commands.executeCommand('workbench.action.openSettings', 'codesense'); return; }
    if (m.type === 'savedRoadmap') { this.screen = 'roadmap'; return; }
    if (m.type === 'customOpen') { await this.custom.open(m.projectId!); this.screen = 'roadmap'; return; }
    if (m.type === 'customSelect') { await this.custom.select(m.index!); this.screen = 'customMilestone'; return; }
    if (m.type === 'customResume') { await this.custom.resume(m.projectId); this.screen = 'customMilestone'; return; }
    if (['customHint', 'customQuestion', 'customExplain', 'customAssisted', 'customReview', 'customComplete'].includes(m.type)) { await this.customAction(m); return; }
    if (m.type === 'beginCustom') {
      if (!this.roadmap) throw new Error('Generate a roadmap first.');
      const doc = await vscode.workspace.openTextDocument({ language: 'html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>My learning project</title></head>\n<body>\n  <!-- Begin with the first roadmap milestone. -->\n</body>\n</html>\n' });
      await vscode.window.showTextDocument(doc, { preview: false }); return;
    }
    if (m.type === 'start') { await this.lab.create(); this.screen = 'milestone'; this.selected = 'html-structure'; await this.lab.open('index.html'); await this.refreshHash(); return; }
    if (m.type === 'file') { await this.lab.open(m.file!); return; }
    if (m.type === 'roadmap') {
      if (possibleSecret(m.idea!)) throw new Error('Possible secret detected. Remove sensitive content from your project idea.');
      const roadmap = await this.backend.request('/roadmap/generate', { idea: m.idea, level: m.difficulty });
      await this.custom.add(roadmap, m.difficulty as LearningLevel);
      this.screen = 'roadmap'; return;
    }
    const milestone = this.project.milestones.find(x => x.id === m.id)!;
    const id = milestone.id;
    if (m.type === 'select') { this.selected = id; this.screen = 'milestone'; this.hint = undefined; return; }
    if (m.type === 'tests') {
      if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before running demo tests.');
      if (m.recovery && !this.store.entry(id).revealed) throw new Error('Recovery checks become available after a solution reveal.');
      await this.lab.save();
      const snapshot = await this.lab.source();
      const approved = await vscode.window.showWarningMessage('Run your reviewed CodeSense demo files? This executes codesense-lab/app.js in a separate process with time and memory limits, but it is NOT a secure sandbox. Only proceed for code you wrote or reviewed. Do not use downloaded or untrusted code.', { modal: true }, 'Run reviewed demo');
      if (approved !== 'Run reviewed demo') return;
      const runner = require(path.join(this.context.extensionPath, 'runtime/test-runner/src/process.cjs'));
      const result: TestResult = await runner.execute(snapshot.source, id, m.recovery, vscode.workspace.getConfiguration('codesense').get('nodePath', 'node'));
      result.sourceHash = snapshot.hash; result.at = new Date().toISOString();
      await this.store.recordTests(id, result);
      await this.refreshHash();
      this.notice = result.passed ? 'Verified checks passed. Explain the concept to verify understanding separately.' : 'Some checks need attention. Read the results, request a hint, and try again.';
      return;
    }
    if (m.type === 'hint') {
      const level = m.level!;
      let text = milestone.hints[level - 1], source = 'Offline scripted hint';
      if (this.backend.enabled) {
        let codeContext = '';
        if (m.includeSelection) {
          const editor = vscode.window.activeTextEditor;
          if (!editor || editor.selection.isEmpty) throw new Error('Select a small relevant snippet in a demo file first.');
          if (!vscode.workspace.isTrusted || editor.document.uri.scheme !== 'file') throw new Error('Trust this workspace and select a saved demo file before sharing code.');
          await this.lab.source();
          if (path.dirname(editor.document.uri.fsPath) !== this.lab.folder() || !['index.html','app.js','style.css'].includes(path.basename(editor.document.uri.fsPath))) throw new Error('Select code only from the controlled demo files.');
          if (await fs.realpath(editor.document.uri.fsPath) !== path.join(await fs.realpath(this.lab.folder()), path.basename(editor.document.uri.fsPath))) throw new Error('Select code only from the controlled demo files.');
          codeContext = editor.document.getText(editor.selection);
          if (codeContext.length > 4000) throw new Error('Select at most 4,000 characters.');
          if (possibleSecret(codeContext)) throw new Error('Possible secret detected in the selection. Remove sensitive content before sharing.');
          const ok = await vscode.window.showWarningMessage(`Send the selected ${codeContext.length} characters from ${path.basename(editor.document.fileName)} to the configured backend and AI provider? Review the selected text for secrets first.`, { modal: true, detail: codeContext }, 'Send selection');
          if (ok !== 'Send selection') return;
        }
        try {
          const entry = this.store.entry(id);
          const response = await this.backend.request('/mentor/hint', { milestone_id: id, level, code_context: codeContext, context_consent: !!codeContext, test_results: (entry.latestTests?.results || []).map(r => ({ id: r.id, passed: r.passed })), previous_hints: entry.hints });
          text = response.text; source = response.source;
        } catch { source = 'Offline scripted fallback (AI unavailable)'; }
      }
      await this.store.hint(id, level, text); this.hint = { text, source, level }; return;
    }
    if (m.type === 'assess') {
      const correct: string[] = [], missing: string[] = [];
      milestone.assessment.forEach((q, i) => (m.answers![i] === q.answer ? correct : missing).push(q.prompt));
      await this.store.assess(id, { passed: missing.length === 0, source: 'Offline guided rubric', correct, missing, feedback: missing.length ? 'Review the concepts listed below, then retry. Code correctness is tracked separately.' : 'Both guided concepts are correct. This limited rubric checks these concepts, not general mastery.', at: new Date().toISOString() }); return;
    }
    if (m.type === 'explain') {
      const result = await this.backend.request('/learning/evaluate', { milestone_id: id, explanation: m.text });
      await this.store.assess(id, { ...result, at: new Date().toISOString() }); return;
    }
    if (m.type === 'reveal') {
      const confirm = await vscode.window.showWarningMessage('Reveal this reference solution? This records Assisted status. To recover understanding you must explain the concept again and pass the related mini-task.', { modal: true }, 'Reveal solution');
      if (confirm !== 'Reveal solution') return;
      await this.store.reveal(id);
      const reference = path.join(this.context.extensionPath, 'runtime/test-runner/fixtures/correct');
      // A new untitled document displays the reference; learner files are never overwritten.
      const file = id === 'html-structure' ? 'index.html' : 'app.js';
      const doc = await vscode.workspace.openTextDocument({ language: id === 'html-structure' ? 'html' : 'javascript', content: await fs.readFile(path.join(reference, file), 'utf8') });
      await vscode.window.showTextDocument(doc, { preview: false });
      this.notice = 'Reference opened in an untitled editor. Your work is unchanged. Complete explain-back and the recovery mini-task.';
    }
  }

  private async customAction(m: Message) {
    const project = this.custom.active();
    if (!project || !project.entries[project.current].startedAt) throw new Error('Start a custom milestone first.');
    const milestone = project.milestones[project.current], entry = project.entries[project.current];
    const active = { kind: 'custom', milestone };
    if (m.type === 'customAssisted') { await this.custom.assisted(); return; }
    if (m.type === 'customComplete') { await this.custom.selfReport(m.criteriaReviewed === true); return; }
    if (m.type === 'customReview') {
      if (!this.backend.enabled) throw new Error('AI Code Review requires the configured backend and AI provider.');
      const code = await approvedCode(m.contextMode!);
      if (code === undefined) { this.notice = 'Code sharing cancelled. Nothing was sent.'; return; }
      let result;
      try {
        result = parseReview(await this.backend.request('/mentor/review', { ...active, project_id: project.id,
          milestone_index: project.current, code_context: code, context_consent: true }));
      } catch {
        await this.custom.review(undefined, 'AI Code Review unavailable. Retry when the backend and AI provider are available.');
        this.notice = 'AI Code Review unavailable. No implementation verification was recorded.';
        return;
      }
      await this.custom.review(result);
      return;
    }
    if (m.type === 'customQuestion') {
      if (!entry.question || m.refresh) {
        const focus = entry.reviews?.slice().reverse().find(r => r.result?.potential_issues.length)?.result?.potential_issues[0]
          || entry.explanations.slice().reverse().find(a => a.assessment?.missing.length)?.assessment?.missing[0]
          || entry.hints.slice().reverse().find(h => h.level < 3)?.text;
        if (focus && possibleSecret(focus)) throw new Error('Possible secret in learning feedback. Prepare a question without that context.');
        await this.custom.question(await this.backend.request('/learning/question', { ...active, ...(focus ? { review_focus: focus.slice(0, 300) } : {}) }));
      }
      return;
    }
    if (m.type === 'customHint') {
      const level = m.level!;
      const fallback = [
        'Which concept in this milestone explains the behavior you want to observe?',
        'How does the behavior you observe differ from the milestone goal, and what might explain that difference?',
        'Describe a small example and predict its outcome. Compare that prediction with what you observe before changing your approach.',
      ][level - 1];
      let hint = { text: fallback, source: 'Offline scripted hint' };
      if (this.backend.enabled) {
        const code = await approvedCode(m.contextMode!);
        if (code === undefined) { this.notice = 'Code sharing cancelled. Nothing was sent.'; return; }
        try {
          const focus = entry.reviews?.slice().reverse().find(r => r.result?.potential_issues.length)?.result?.potential_issues[0];
          const result = await this.backend.request('/mentor/hint', { ...active, level, code_context: code, context_consent: !!code, previous_hints: entry.hints.map(h => h.text), ...(focus ? { review_focus: focus.slice(0, 300) } : {}) });
          if (typeof result?.text !== 'string' || result.text.length < 10 || result.text.length > 1500
              || typeof result.source !== 'string' || result.source.length > 100 || result.level !== level) throw new Error('Invalid hint response.');
          hint = { text: result.text, source: result.source };
        } catch { hint.source = 'Offline scripted fallback (AI unavailable)'; }
      }
      await this.custom.hint(level, hint); return;
    }
    if (m.type === 'customExplain') {
      if (!entry.question) throw new Error('Prepare and read the concept question and rubric first.');
      if (possibleSecret(m.text!)) throw new Error('Possible secret detected. Remove sensitive content before sending your explanation.');
      let assessment;
      try { assessment = parseAssessment(await this.backend.request('/learning/evaluate', { ...active, explanation: m.text })); }
      catch {
        await this.custom.explanation(m.text!, undefined, 'Assessment unavailable. Retry when the backend and AI provider are available.');
        this.notice = 'Assessment unavailable. Your explanation was saved locally; retry when the backend and AI provider are available. No conceptual pass was recorded.';
        return;
      }
      await this.custom.explanation(m.text!, assessment);
    }
  }
}
