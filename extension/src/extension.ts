import * as vscode from 'vscode';
import { MentorPanel } from './panels/MentorPanel';
export function activate(context: vscode.ExtensionContext) {
  const mentor = new MentorPanel(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codesense.mentor', mentor, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('codesense.open', () => mentor.navigate('home')),
    vscode.commands.registerCommand('codesense.startGuided', async () => { await mentor.navigate('milestone'); await mentor.start(); }),
    vscode.commands.registerCommand('codesense.passport', () => mentor.navigate('passport'))
  );
}
export function deactivate() {}
