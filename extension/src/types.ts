export type MilestoneId = 'html-structure' | 'add-task';
export interface Check { id: string; name: string; passed: boolean; message: string }
export interface TestResult { milestoneId: MilestoneId; kind: 'implementation' | 'recovery'; validity: 'verified'; results: Check[]; totalPassed: number; totalFailed: number; passed: boolean; sourceHash?: string; at?: string }
export interface Assessment { passed: boolean; source: string; feedback: string; correct: string[]; missing: string[]; at: string }
export interface Entry {
  testAttempts: number; recoveryAttempts: number; latestTests?: TestResult; latestRecovery?: TestResult;
  history: TestResult[]; hintsRequested: number; highestHintLevel: number; hints: string[];
  explanation?: Assessment; explanationAttempts: number; revealed: boolean; revealedAt?: string;
  currentHash?: string; recoveryStatus: 'not-required' | 'pending' | 'passed';
}
export interface Passport { schemaVersion: 1; milestones: Record<MilestoneId, Entry> }
export interface Milestone {
  id: MilestoneId; title: string; goal: string; concepts: string[]; acceptanceCriteria: string[];
  expectedBehaviors: string[]; testIds: string[]; hints: string[]; question: string; rubric: string[];
  assessment: { prompt: string; options: string[]; answer: number }[];
  referenceSolution: string; recovery: { id: string; goal: string; testIds: string[] };
}
export interface Project { schemaVersion: number; id: string; title: string; description: string; contract: string; milestones: Milestone[]; planned: string[] }
