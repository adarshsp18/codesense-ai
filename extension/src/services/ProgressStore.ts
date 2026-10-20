import { Assessment, Entry, MilestoneId, Passport, TestResult } from '../types';
export interface Storage { get<T>(key: string): T | undefined; update(key: string, value: unknown): Thenable<void> | Promise<void> }
const key = 'codesense.passport.v1';
const fresh = (): Entry => ({ testAttempts: 0, recoveryAttempts: 0, history: [], hintsRequested: 0, highestHintLevel: 0, hints: [], explanationAttempts: 0, revealed: false, recoveryStatus: 'not-required' });
export function classification(entry: Entry): string {
  const implementation = entry.latestTests?.passed && entry.latestTests.sourceHash === entry.currentHash;
  const recovery = entry.latestRecovery?.passed && entry.latestRecovery.sourceHash === entry.currentHash;
  if (entry.revealed) return implementation && recovery && entry.explanation?.passed ? 'Recovered Understanding' : 'Assisted';
  if (implementation && entry.explanation?.passed) return 'Understanding Verified';
  if (implementation) return 'Implementation Verified';
  if (entry.testAttempts || entry.hintsRequested || entry.explanationAttempts) return 'In Progress';
  return 'Not Started';
}
export class ProgressStore {
  private data: Passport;
  constructor(private storage: Storage) {
    const saved = storage.get<Passport>(key);
    this.data = saved?.schemaVersion === 1 ? JSON.parse(JSON.stringify(saved)) : { schemaVersion: 1, milestones: { 'html-structure': fresh(), 'add-task': fresh() } };
  }
  snapshot(): Passport { return JSON.parse(JSON.stringify(this.data)); }
  entry(id: MilestoneId): Entry { return this.snapshot().milestones[id]; }
  private async change(id: MilestoneId, fn: (entry: Entry) => void) { fn(this.data.milestones[id]); await this.storage.update(key, this.snapshot()); }
  async syncHash(hash: string) {
    for (const entry of Object.values(this.data.milestones)) {
      entry.currentHash = hash;
      if (entry.revealed) entry.recoveryStatus = entry.latestRecovery?.passed && entry.latestRecovery.sourceHash === hash ? 'passed' : 'pending';
    }
    await this.storage.update(key, this.snapshot());
  }
  async recordTests(id: MilestoneId, result: TestResult) {
    await this.change(id, e => {
      if (result.kind === 'recovery') {
        e.recoveryAttempts++; e.latestRecovery = result;
        e.recoveryStatus = result.passed ? 'passed' : 'pending';
        // Recovery suites include all original requirements, so the same snapshot is verified.
        e.latestTests = result;
      } else { e.testAttempts++; e.latestTests = result; }
      e.currentHash = result.sourceHash; e.history.push(result); e.history = e.history.slice(-50);
    });
  }
  async hint(id: MilestoneId, level: number, text: string) { await this.change(id, e => { e.hintsRequested++; e.highestHintLevel = Math.max(level, e.highestHintLevel); e.hints.push(text); e.hints = e.hints.slice(-10); }); }
  async assess(id: MilestoneId, result: Assessment) { await this.change(id, e => { e.explanationAttempts++; e.explanation = result; }); }
  async reveal(id: MilestoneId) { await this.change(id, e => { if (!e.revealed) { e.revealed = true; e.revealedAt = new Date().toISOString(); e.recoveryStatus = 'pending'; e.explanation = undefined; e.latestRecovery = undefined; } }); }
}
