import * as vscode from 'vscode';
export class BackendClient {
  get enabled() { return vscode.workspace.getConfiguration('codesense').get<boolean>('aiEnabled', false); }
  async request(route: string, body: unknown): Promise<any> {
    if (!this.enabled) throw new Error('Offline demo mode is active. Live AI requires backend configuration and codesense.aiEnabled.');
    const base = new URL(vscode.workspace.getConfiguration('codesense').get<string>('backendUrl', 'http://127.0.0.1:8000'));
    if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password) throw new Error('Use an http:// loopback backend URL.');
    try {
      const response = await fetch(new URL(route, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000), redirect: 'error' });
      const data: any = await response.json();
      if (!response.ok) throw new Error(typeof data.error?.message === 'string' ? data.error.message : 'Backend rejected this request.');
      return data;
    } catch (error) {
      if (error instanceof Error && error.message !== 'fetch failed') throw error;
      throw new Error('Backend unavailable. Start FastAPI at 127.0.0.1:8000. Offline guided learning remains available.');
    }
  }
}
