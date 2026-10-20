# Implementation status — 20 October 2026

Status distinguishes executable evidence from features needing a live UI or provider check. This is V1 for shortlisting, not the full product.

## Mode A advisory code review update (20 October 2026)

The active custom milestone now offers **Review My Code** for one selected snippet or the current saved file. It reuses the trusted-workspace, path, size, secret-screening and per-send consent checks. The new local-only `POST /mentor/review` route validates the request and a structured Pydantic response. Feedback separates what appears satisfied, potential issues, observations with described evidence, unknowns and two or three next actions. The visible advisory notice and response status always keep implementation **unverified**. No code is executed or custom test result is created. Review attempts and the latest completed summary persist; source snapshots do not.

Custom milestones now record Not Started, In Progress, Review Requested and Self-Reported Complete, separately from conceptual rubric outcomes and the unchanged automated-verification-unavailable notice. Self-report requires acknowledging the provisional acceptance criteria. The latest review issue can focus a later hint or deterministic concept question; refocusing can also use earlier rubric gaps or no-code hints. The fixed assessment rubric and Level 1/2 no-code validation remain intact. Existing project IDs plus immutable roadmap milestone indexes associate evidence across project switches and reloads. Guided storage, curriculum, test runner and solution recovery were not changed.

Current verification: `npm.cmd test` compiled TypeScript/staged assets and passed **68/68 Node tests**; `python -m pytest backend/tests -q` passed **211/211 Python tests** with one installed Starlette/httpx deprecation warning. `python scripts/smoke_backend.py` passed five real-server checks (health, guided project, offline hint, missing-key roadmap and startup). Review tests use a mocked provider; the native VS Code consent dialog, 300–400px rendering, theme appearance and live Gemini review need manual verification. The VSIX was not rebuilt.

## Final project-management update (20 October 2026)

The existing multi-project store now has a Home **My Projects** list, active-project marker, saved learning level for new projects, and explicit open/resume/back navigation. The store keeps stable project IDs, duplicate titles and separate learning histories. Recoverable legacy roadmaps are imported without deleting the original; malformed evidence is retained in the original record and reported. Passport summaries alone do not reconstruct missing roadmaps.

The roadmap endpoint now rejects clearly unrelated or ambiguous ideas before provider generation with a fixed, sanitized prompt to describe a web interface. Accepted roadmaps retain the existing API schema and authentication safety check. This local relevance gate is conservative and cannot understand every possible project description.

Verification: TypeScript compilation and the complete **64-test Node suite** passed; the complete **195-test Python suite** passed with one installed Starlette/httpx deprecation warning. Local TestClient smoke checks returned health 200, guided project 200 and unrelated idea 422. Native VS Code UI behavior, actual workspace Memento data and live Gemini generation were not exercised in this update. The VSIX was not rebuilt.

## Mode A vertical slice (19 October 2026)

Implemented incrementally on the existing extension and FastAPI backend for the 20 October deadline. Navigation/persistence tests passed before mentoring and explain-back were added. No custom verification templates were integrated: every custom milestone explicitly states that automated verification is unavailable. Guided source, curriculum, test suites, seeded defects, recovery implementation and guided Passport storage schema were preserved.

- Custom roadmap validation, Start/Continue, arbitrary milestone selection, previous/next, reload/resume and separate histories for up to 20 projects. Existing files are never overwritten.
- Legacy saved-roadmap migration; transactional Memento writes; failed writes do not mutate in-memory progress. Corrupt custom saves are retained without breaking guided mode.
- Approved selected code or one current file, a 4,000-character cap, confirmation with the exact text, workspace/realpath restrictions, excluded private/dependency files and conservative secret checks. Source snapshots are not persisted.
- Existing hint endpoint extended with an explicit custom request shape, using the same no-code validator, bounded retry and safe fallback. Existing guided schemas remain supported.
- Stable concept-specific question and explicit three-part rubric, generated deterministically from the first concept and goal. New `/learning/question` does not call the AI provider.
- Existing evaluation endpoint extended for custom explanations, preserving complete rubric and exact-evidence checks. Explanation text, feedback, unsuccessful attempts and retries persist separately from implementation status.
- Custom Passport records hints and self-reported outside help as assistance, and labels conceptual outcomes as AI rubric results. It never sets implementation verification or a custom recovery status.

## Fully implemented and tested with automated evidence

- TypeScript compilation and staged extension assets.
- Two authored guided milestones with reusable JSON curriculum, contracts, rubrics and hints.
- Real jsdom acceptance suites; known-correct reference; ten primary seeded defects plus recovery defects.
- Separate worker, bounded source/output, environment allowlist, V8 heap limit and real runaway-handler timeout.
- Offline hints, guided concept assessment, separate implementation/understanding states and local Passport persistence logic.
- Solution reveal, fresh explain-back requirement, description and Enter recovery checks, Assisted and Recovered Understanding states.
- Source fingerprint invalidation, bounded histories, counters and reload reconstruction.
- Webview message validation, HTML escaping, button messages, busy state, command registration consistency and CSP assertions.
- Full offline controller flow including real child tests, source edits, failure/pass, hints, assessment, reveal, recovery and reload from persisted JSON-backed storage.
- FastAPI endpoints, Pydantic input validation, no-key behavior, hint rejection/retry/fallback, schema-validated roadmaps, evidence-based rubric assessment and error sanitization (AI provider mocked).
- Real Uvicorn startup and HTTP health/curriculum/offline-hint/missing-key smoke checks.
- Installable VSIX, extracted to a temporary directory outside the repository; its shipped runner passed the correct reference using only packaged dependencies (2.97 MB archive).

## Implemented but not fully verified

- Before this update, one minimal structured Gemini request to `gemini-3.8-flash` succeeded using the configured account; `gemini-2.5-flash` returned a specific new-user restriction. Free-tier eligibility was not established. The new full custom workflow and OpenAI path have not been exercised live in VS Code. Current AI behavior tests use mocks, not real provider calls.
- Visual appearance, keyboard/screen-reader behavior, F5 onboarding and full interaction in a real VS Code GUI require the manual checklist. Automated webview/controller checks are not a visual review.
- Actual VS Code Memento storage across GUI reloads requires manual confirmation; storage reconstruction is tested with the same interface and disk-backed test storage.
- Native host launch was attempted twice. The diagnostic run was blocked by VS Code's `vscode-updating` mutex and exited with “Code is currently being updated. Please wait for the update to complete before launching.” No `host-test-result.json` was produced. Activation in a real host is therefore **not claimed as passed**. Finish the existing VS Code update, then follow MANUAL_VERIFICATION; no updater or existing user VS Code process was terminated.

## Partial / deliberately limited

- Custom milestones have advisory reviews and self-reported completion, but no custom tests, verified implementation certificate, editable roadmaps or custom recovery verification. Concept questions cover the first listed concept and goal, optionally focused by a review issue, rather than a full adaptive curriculum. Navigation and generic hints remain available offline; new question preparation requires the local backend, and AI review/evaluation require provider access.
- Explanation verification is a two-question deterministic rubric offline; live AI is rubric-constrained but not a validated learning assessment.
- Hint leakage checks are heuristic and cannot reject every paraphrased disclosure.
- Process constraints reduce accidents but do not securely sandbox adversarial code. Only reviewed controlled demos are supported.
- Tests model DOM and accessible state, not complete browser rendering or all accessibility requirements.

## Planned for finals (V1.5)

Editable/personalized roadmaps, broader context selection and concept rubrics, reviewed reusable custom test templates, more guided projects, completed/delete/filter milestones, improved analytics, and a real 3–5 classmate pilot. No pilot results exist yet.

## Planned for full V2

Trustworthy arbitrary-project test generation, framework-specific learning, architecture-aware mentoring, adaptive knowledge graphs, instructor dashboards and strong cloud sandbox execution.

## Verification log

- Environment: Windows, Node 24.18.0, npm 11.16.0, portable CPython 3.12.15, VS Code 1.139.0.
- Current incremental compile: `node node_modules/typescript/bin/tsc -p extension` passed. Full Node run: `node --test --test-concurrency=1 test-runner/tests/*.test.cjs extension/tests/*.test.cjs` - **54 passed** (48 previous and 6 UI refinement cases), including offline guided controller, real jsdom seeded defects/recovery, genuine worker timeout, custom controller, storage, consent boundaries and webview rendering. Suites ran serially to avoid the previously observed worker contention; existing verified suites were not edited.
- `python -m pytest backend/tests -q`: **134 passed** (107 previous and 27 new custom cases). One installed Starlette/httpx deprecation warning; no failing tests. New cases cover active-milestone context, consent, secret/length rejection, Levels 1?2 enforcement, retry/fallback, explicit questions/rubrics, evidence validation, quota/network/malformed assessment failures and local-only access.
- `python scripts/smoke_backend.py`: all five real-server checks passed; server stopped afterward.
- npm dependency audit after updating the packaging tool: zero reported vulnerabilities.
- Earlier V1 package verification: `npm.cmd run package` and `node scripts/verify-package.cjs` passed. The VSIX was not regenerated for the Mode A update; use F5/source development host. The first archive omitted dependencies; the packaging script was fixed, rebuilt and its self-contained runner verified successfully.
- Native VS Code host checks: blocked by the installed editor's active update, as described above. CLI exit code was not treated as verification evidence.

No generated metrics, fake test passes, fabricated pilot observations, or claims of general mastery are included.


## Editor-native UI refinement (19 October 2026)

Home, custom roadmap/workspace, guided workspace and Passport use the existing webview and actions with theme-driven colors, a compact identity/navigation bar, consistent spacing, subtle separators and native disclosures. Home puts project generation first; resume and guided options follow. Guided failures are shown before collapsed passing checks. A new current code pass opens explain-back; the learner can collapse it afterward. Custom criteria remain provisional and implementation remains unverified. Passport shows evidence, recorded assistance and the next action without scores or charts.

Presentation-only state keeps disclosures, context controls, focused controls and text selection through host updates. Existing action payloads, backend routes, persistence, CSP, source sharing consent and verified test logic are unchanged. No dependencies were added. Hash comparison confirmed all 41 pre-existing protected source/curriculum/test files were unchanged (backend/app, extension/src, shared curriculum, runner and existing extension tests).

Validation: TypeScript compilation passed; the complete Node suite passed 54/54 serially; Python passed 134/134 with the existing Starlette/httpx deprecation warning. The six added DOM tests cover home action order and labels, diagnostics, busy-round-trip focus/context, selection and disclosure isolation, explain-back progression, and Passport evidence/assistance semantics.

No browser or native VS Code surface was connected for visual review. Real 300-400px sidebar rendering, light/dark/high-contrast themes, 200% zoom, keyboard/screen-reader operation and live consent dialogs remain manual checks. DOM tests do not establish pixel layout, contrast or native focus behavior. The existing packaged VSIX was not regenerated; inspect this source version through F5.
