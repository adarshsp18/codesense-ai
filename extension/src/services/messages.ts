import { MilestoneId } from '../types';
export type Message = { type: string; id?: MilestoneId; level?: number; answers?: number[]; text?: string; idea?: string; difficulty?: string; includeSelection?: boolean; recovery?: boolean; file?: string; index?: number; projectId?: string; contextMode?: 'none' | 'selection' | 'file'; criteriaReviewed?: boolean; refresh?: boolean };
const ids = ['html-structure', 'add-task'];
export function validateMessage(raw: unknown): Message | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  const m = raw as Record<string, unknown>;
  if (typeof m.type !== 'string') return;
  const noArgs = ['ready', 'home', 'passport', 'start', 'settings', 'savedRoadmap', 'beginCustom', 'customAssisted'];
  if (noArgs.includes(m.type)) return { type: m.type };
  if (m.type === 'customQuestion' && (m.refresh === undefined || typeof m.refresh === 'boolean')) return { type: m.type, ...(m.refresh ? { refresh: true } : {}) };
  if (m.type === 'customSelect' && Number.isInteger(m.index) && Number(m.index) >= 0 && Number(m.index) < 5) return { type: m.type, index: Number(m.index) };
  if (m.type === 'customResume' && (m.projectId === undefined || (typeof m.projectId === 'string' && /^[a-f0-9-]{36}$/.test(m.projectId)))) return { type: m.type, projectId: m.projectId as string | undefined };
  if (m.type === 'customOpen' && typeof m.projectId === 'string' && /^[a-f0-9-]{36}$/.test(m.projectId)) return { type: m.type, projectId: m.projectId };
  if (m.type === 'customHint' && Number.isInteger(m.level) && Number(m.level) >= 1 && Number(m.level) <= 3 && ['none','selection','file'].includes(String(m.contextMode))) return { type: m.type, level: Number(m.level), contextMode: m.contextMode as Message['contextMode'] };
  if (m.type === 'customReview' && ['selection','file'].includes(String(m.contextMode))) return { type: m.type, contextMode: m.contextMode as Message['contextMode'] };
  if (m.type === 'customComplete' && m.criteriaReviewed === true) return { type: m.type, criteriaReviewed: true };
  if (m.type === 'customExplain' && typeof m.text === 'string' && m.text.trim().length >= 20 && m.text.length <= 3000) return { type: m.type, text: m.text.trim() };
  if (m.type === 'file' && ['index.html', 'app.js', 'style.css'].includes(String(m.file))) return { type: 'file', file: String(m.file) };
  if (m.type === 'roadmap' && typeof m.idea === 'string' && m.idea.trim().length >= 8 && m.idea.length <= 2000 && ['beginner','intermediate','advanced'].includes(String(m.difficulty))) return { type: m.type, idea: m.idea.trim(), difficulty: String(m.difficulty) };
  if (!ids.includes(String(m.id))) return;
  const id = m.id as MilestoneId;
  if (['select','reveal'].includes(m.type)) return { type: m.type, id };
  if (m.type === 'tests' && (m.recovery === undefined || typeof m.recovery === 'boolean')) return { type: m.type, id, recovery: m.recovery === true };
  if (m.type === 'hint' && Number.isInteger(m.level) && Number(m.level) >= 1 && Number(m.level) <= 3 && (m.includeSelection === undefined || typeof m.includeSelection === 'boolean')) return { type: m.type, id, level: Number(m.level), includeSelection: m.includeSelection === true };
  if (m.type === 'assess' && Array.isArray(m.answers) && m.answers.length === 2 && m.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 2)) return { type: m.type, id, answers: m.answers };
  if (m.type === 'explain' && typeof m.text === 'string' && m.text.trim().length >= 20 && m.text.length <= 3000) return { type: m.type, id, text: m.text.trim() };
}
