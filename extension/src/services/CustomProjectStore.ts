import { createHash, randomUUID } from 'node:crypto';
import { Assessment } from '../types';
import { Storage } from './ProgressStore';

export interface CustomMilestone {
  title: string; goal: string; concepts: string[]; expected_behaviors: string[];
  steps: string[]; acceptance_criteria: string[];
}
export interface CustomRoadmap { title: string; milestones: CustomMilestone[] }
export interface ConceptQuestion { question: string; rubric: string[] }
export interface CustomReview {
  review_summary: string; satisfied: string[]; potential_issues: string[];
  observations: { observation: string; evidence: string }[];
  cannot_verify: string[]; next_actions: string[]; verification_status: 'unverified';
}
export interface ReviewRecord { at: string; result?: CustomReview; error?: string }
export interface CustomEntry {
  startedAt?: string; hintsRequested: number; highestHintLevel: number; assisted: boolean;
  hints: { text: string; source: string; level: number; at: string }[];
  question?: ConceptQuestion;
  explanationAttempts: number;
  explanations: { text: string; at: string; assessment?: Assessment; error?: string }[];
  reviewAttempts?: number; reviews?: ReviewRecord[]; selfReportedCompleteAt?: string;
}
export interface CustomProject extends CustomRoadmap {
  id: string; createdAt: string; current: number; entries: CustomEntry[];
  level?: LearningLevel;
}
export type LearningLevel = 'beginner' | 'intermediate' | 'advanced';
export interface CustomState { schemaVersion: 1; activeProjectId?: string; projects: CustomProject[]; error?: string; migrationWarning?: string }
export const CUSTOM_KEY = 'codesense.customProjects.v1';
const LEGACY_KEY = 'codesense.roadmap';
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const fresh = (): CustomEntry => ({ hintsRequested: 0, highestHintLevel: 0, assisted: false, hints: [], explanationAttempts: 0, explanations: [] });
const isLevel = (value: unknown): value is LearningLevel => ['beginner', 'intermediate', 'advanced'].includes(String(value));
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
function validateEntry(e: CustomEntry) {
  if (!e || !Number.isInteger(e.hintsRequested) || e.hintsRequested < 0 || !Number.isInteger(e.highestHintLevel)
      || e.highestHintLevel < 0 || e.highestHintLevel > 3 || typeof e.assisted !== 'boolean'
      || !Number.isInteger(e.explanationAttempts) || e.explanationAttempts < 0
      || !Array.isArray(e.hints) || e.hints.length > 10 || !Array.isArray(e.explanations) || e.explanations.length > 20) throw new Error('Invalid learning record');
  if (e.question) parseQuestion(e.question);
  for (const h of e.hints) { text(h.text, 1500); text(h.source, 100); }
  for (const a of e.explanations) { text(a.text, 3000); if (a.assessment) parseAssessment(a.assessment); }
  if (e.reviewAttempts !== undefined && (!Number.isInteger(e.reviewAttempts) || e.reviewAttempts < 0)) throw new Error('Invalid review count');
  if (e.reviews !== undefined) {
    if (!Array.isArray(e.reviews) || e.reviews.length > 10 || (e.reviewAttempts ?? 0) < e.reviews.length) throw new Error('Invalid review history');
    for (const review of e.reviews) {
      if (Number.isNaN(Date.parse(review.at)) || (review.result === undefined) === (review.error === undefined)) throw new Error('Invalid review record');
      if (review.result) parseReview(review.result);
      if (review.error) text(review.error, 300);
    }
  }
  if (e.selfReportedCompleteAt !== undefined && Number.isNaN(Date.parse(e.selfReportedCompleteAt))) throw new Error('Invalid self-report');
}
function legacyId(roadmap: CustomRoadmap): string {
  const hash = createHash('sha256').update(JSON.stringify(roadmap)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid custom roadmap or AI response. Retry generation.');
  return value.trim();
}
function strings(value: unknown, maxItems = 8, maxLength = 800): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) throw new Error('Invalid custom roadmap or AI response.');
  return value.map(item => text(item, maxLength));
}
export function parseRoadmap(value: any): CustomRoadmap {
  if (!value || !Array.isArray(value.milestones) || value.milestones.length < 3 || value.milestones.length > 5) throw new Error('Expected a roadmap with 3 to 5 milestones.');
  return { title: text(value.title, 150), milestones: value.milestones.map((m: any) => ({
    title: text(m?.title, 150), goal: text(m?.goal, 800), concepts: strings(m?.concepts),
    expected_behaviors: strings(m?.expected_behaviors), steps: strings(m?.steps), acceptance_criteria: strings(m?.acceptance_criteria),
  })) };
}
export function parseQuestion(value: any): ConceptQuestion {
  return { question: text(value?.question, 2000), rubric: strings(value?.rubric, 5, 2000) };
}
export function parseReview(value: any): CustomReview {
  if (value?.verification_status !== 'unverified' || !Array.isArray(value.observations) || value.observations.length > 5) throw new Error('Invalid advisory review response.');
  const bounded = (items: unknown, min = 0) => {
    if (!Array.isArray(items) || items.length < min || items.length > 5) throw new Error('Invalid advisory review response.');
    return items.map(item => text(item, 400));
  };
  const next_actions = bounded(value.next_actions, 2);
  if (next_actions.length > 3) throw new Error('Invalid advisory review response.');
  return { review_summary: text(value.review_summary, 500), satisfied: bounded(value.satisfied), potential_issues: bounded(value.potential_issues),
    observations: value.observations.map((item: any) => ({ observation: text(item?.observation, 400), evidence: text(item?.evidence, 400) })),
    cannot_verify: bounded(value.cannot_verify, 1), next_actions, verification_status: 'unverified' };
}
export function customStatus(entry: CustomEntry): 'Not Started' | 'In Progress' | 'Review Requested' | 'Self-Reported Complete' {
  if (entry.selfReportedCompleteAt) return 'Self-Reported Complete';
  if ((entry.reviewAttempts ?? 0) > 0) return 'Review Requested';
  return entry.startedAt ? 'In Progress' : 'Not Started';
}
export function parseAssessment(value: any): Assessment {
  if (!value || typeof value.passed !== 'boolean' || !Array.isArray(value.correct) || !Array.isArray(value.missing)
      || value.correct.length + value.missing.length !== 3 || value.passed !== (value.missing.length === 0)) throw new Error('Invalid AI assessment. Please retry.');
  return { passed: value.passed, source: text(value.source, 100), feedback: text(value.feedback, 1500),
    correct: value.correct.map((v: unknown) => text(v, 2000)), missing: value.missing.map((v: unknown) => text(v, 2000)), at: now() };
}
export class CustomProjectStore {
  private data: CustomState = { schemaVersion: 1, projects: [] };
  constructor(private storage: Storage) {
    const saved = storage.get<CustomState>(CUSTOM_KEY);
    if (saved) {
      try {
      if (saved.schemaVersion !== 1 || !Array.isArray(saved.projects) || saved.projects.length > 20) throw new Error('Invalid saved custom projects');
      // Never replace a damaged save with empty data silently.
      const ids = new Set<string>();
      for (const p of saved.projects) {
        parseRoadmap(p);
        if (!validId(p.id) || ids.has(p.id)) throw new Error('Invalid project ID');
        ids.add(p.id);
        if (p.level !== undefined && !isLevel(p.level)) throw new Error('Invalid learning level');
        if (!Array.isArray(p.entries) || p.entries.length !== p.milestones.length || !Number.isInteger(p.current)
            || p.current < 0 || p.current >= p.milestones.length) throw new Error('Custom project save is invalid. Keep workspace storage for recovery.');
        for (const e of p.entries) validateEntry(e);
      }
      this.data = copy(saved);
      if (saved.projects.length && !saved.projects.some(p => p.id === saved.activeProjectId)) this.data.activeProjectId = saved.projects[0].id;
      } catch {
        // A damaged custom save must not disable the established guided workflow.
        // Keep the original Memento untouched instead of overwriting learning history.
        this.data.error = 'Custom project storage could not be read. Existing data was preserved; guided learning is still available.';
      }
    }
    const legacy = storage.get<unknown>(LEGACY_KEY);
    if (legacy && !this.data.error) {
      try {
        const roadmap = parseRoadmap(legacy);
        const original = legacy as Partial<CustomProject>;
        const id = legacyId(roadmap);
        const matching = this.data.projects.find(p => p.id === id
          || JSON.stringify(parseRoadmap(p)) === JSON.stringify(roadmap));
        const alreadySaved = !!matching;
        if (matching && Array.isArray(original.entries)
            && original.entries.some(entry => entry && (entry.startedAt || entry.hintsRequested || entry.explanationAttempts))
            && JSON.stringify(original.entries) !== JSON.stringify(matching.entries)) {
          this.data.migrationWarning = 'A matching roadmap is already saved, but legacy learning evidence differs. Both original records were preserved for review.';
        }
        if (!alreadySaved) {
          if (this.data.projects.length >= 20) throw new Error('Custom project limit reached');
          const p = this.project(roadmap, isLevel(original.level) ? original.level : undefined);
          p.id = id;
          if (this.data.projects.some(existing => existing.id === p.id)) throw new Error('Duplicate project ID');
          if (original.createdAt && !Number.isNaN(Date.parse(original.createdAt))) p.createdAt = original.createdAt;
          let incompleteEvidence = original.level !== undefined && !isLevel(original.level);
          if (original.current !== undefined) {
            if (Number.isInteger(original.current) && original.current >= 0 && original.current < p.milestones.length) p.current = original.current;
            else incompleteEvidence = true;
          }
          if (original.entries !== undefined) {
            if (!Array.isArray(original.entries)) incompleteEvidence = true;
            else {
              if (original.entries.length > p.milestones.length) incompleteEvidence = true;
              original.entries.slice(0, p.milestones.length).forEach((entry, index) => {
                try { validateEntry(entry); p.entries[index] = copy(entry); }
                catch { incompleteEvidence = true; }
              });
            }
          }
          this.data.projects.push(p);
          this.data.activeProjectId ||= p.id;
          if (incompleteEvidence) this.data.migrationWarning = 'A legacy roadmap was imported, but some learning evidence could not be read. The original workspace record was preserved.';
        }
      } catch {
        // The original Memento remains untouched for manual recovery.
        this.data.migrationWarning = 'A legacy roadmap could not be imported. Its original workspace record was preserved.';
      }
    }
  }
  private project(roadmap: CustomRoadmap, level?: LearningLevel): CustomProject {
    return { ...roadmap, id: randomUUID(), createdAt: now(), current: 0, entries: roadmap.milestones.map(fresh), ...(level ? { level } : {}) };
  }
  snapshot(): CustomState { return copy(this.data); }
  active(): CustomProject | undefined { return this.snapshot().projects.find(p => p.id === this.data.activeProjectId); }
  private async change(fn: (data: CustomState) => void) {
    if (this.data.error) throw new Error(this.data.error);
    const next = this.snapshot(); fn(next); await this.storage.update(CUSTOM_KEY, next); this.data = next;
  }
  async add(value: unknown, level: LearningLevel = 'beginner') {
    if (!isLevel(level)) throw new Error('Invalid learning level.');
    const p = this.project(parseRoadmap(value), level);
    await this.change(data => {
      if (data.projects.length >= 20) throw new Error('This workspace already has 20 custom projects. Use another workspace to keep all existing records.');
      data.projects.push(p); data.activeProjectId = p.id;
    });
  }
  async open(projectId: string) {
    await this.change(data => {
      const p = data.projects.find(project => project.id === projectId);
      if (!p) throw new Error('Custom project not found.');
      data.activeProjectId = p.id;
    });
  }
  async select(index: number, projectId = this.data.activeProjectId) {
    await this.change(data => {
      const p = data.projects.find(p => p.id === projectId);
      if (!p || !Number.isInteger(index) || index < 0 || index >= p.milestones.length) throw new Error('Custom milestone not found.');
      data.activeProjectId = p.id; p.current = index; p.entries[index].startedAt ||= now();
    });
  }
  async resume(projectId = this.data.activeProjectId) {
    const p = this.data.projects.find(p => p.id === projectId);
    if (!p) throw new Error('Generate a roadmap first.');
    await this.select(p.current, p.id);
  }
  private async entry(fn: (entry: CustomEntry) => void) {
    await this.change(data => {
      const p = data.projects.find(p => p.id === data.activeProjectId);
      if (!p) throw new Error('Start a custom milestone first.');
      fn(p.entries[p.current]);
    });
  }
  async hint(level: number, value: { text: string; source: string }) {
    const hint = { text: text(value.text, 1500), source: text(value.source, 100), level, at: now() };
    await this.entry(e => { e.hintsRequested++; e.highestHintLevel = Math.max(e.highestHintLevel, level); e.assisted = true; e.hints.push(hint); e.hints = e.hints.slice(-10); });
  }
  async question(value: unknown) { const question = parseQuestion(value); await this.entry(e => { e.question = question; }); }
  async explanation(explanation: string, assessment?: Assessment, error?: string) {
    await this.entry(e => {
      e.explanationAttempts++; e.explanations.push({ text: explanation, at: now(), assessment, error });
      e.explanations = e.explanations.slice(-20);
    });
  }
  async assisted() { await this.entry(e => { e.assisted = true; }); }
  async review(value: unknown, error?: string) {
    const result = error ? undefined : parseReview(value);
    const safeError = error ? text(error, 300) : undefined;
    await this.entry(e => {
      if (!e.startedAt) throw new Error('Start the milestone before requesting a review.');
      e.reviewAttempts = (e.reviewAttempts ?? 0) + 1;
      e.reviews = [...(e.reviews ?? []), { at: now(), ...(result ? { result } : { error: safeError }) }].slice(-10);
    });
  }
  async selfReport(criteriaReviewed: boolean) {
    if (criteriaReviewed !== true) throw new Error('Review the proposed acceptance criteria before self-reporting completion.');
    await this.entry(e => { if (!e.startedAt) throw new Error('Start the milestone before self-reporting completion.'); e.selfReportedCompleteAt ||= now(); });
  }
}
