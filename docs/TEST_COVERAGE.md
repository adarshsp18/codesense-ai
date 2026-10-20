# Verified suites and seeded-defect validation

The term is **seeded-defect validation**. Known-correct and deliberately broken implementations validate the test suite against the written contract. They do not prove the suite perfect. The suite was reviewed against `shared/guided-projects.json`; no external accreditation or independent review is claimed.

| Requirement | Check ID | Deliberately broken case |
|---|---|---|
| Native, enabled, labelled text input | input / accessible-label | Removed associated label; starter has no input |
| Native, enabled Add Task button | button | Replaced button with div |
| Native labelled list | list | Replaced ul with div |
| Native roles, initially empty list | semantics | Starter lacks structure; reference verifies correct roles |
| Click inserts visible item | adds-item | Missing handler; detached node; hidden item |
| Task text matches trimmed input | task-text | Wrong item text |
| Successful addition clears input | clears-input | Removed clearing statement |
| Empty and whitespace rejected | rejects-blank | Removed validation |
| Multiple tasks preserved in order | preserves-items | replaceChildren removes earlier tasks |
| Help text linked and visible | description | Missing target, hidden text, unmodified reference |
| Enter adds exactly one trimmed task | enter-adds | Duplicate addition, missing keyboard handler |
| Enter clears input | enter-clears | Keyboard handler restores old input |
| Enter rejects blanks | enter-rejects-blank | Keyboard handler converts blank into a task |
| Enter preserves earlier tasks and click still works | enter-preserves | Keyboard handler wipes earlier list items |

Milestone 1 runs 5 checks. Milestone 2 runs those 5 plus 5 interaction checks. Recovery adds 1 description check or 4 Enter checks, giving 6 and 14 respectively. Each check gets fresh DOM state. Source-level defects are in `fixtures/seeded-defects/defects.json`; recovery defects are generated explicitly in `acceptance.test.cjs` with assertions that they target the intended behavior. Correct recovery fixtures are assembled from the reference in the test.

Queries use Testing Library's accessible-role/name and label APIs. The contract explicitly fixes accessible names, native tag types, one text input/button/list, empty initial state and the app.js entry point. It does not fix IDs or variable names. An alternate-ID/ordered-list implementation passes. We deliberately reject custom ARIA role overrides in favor of native semantics for this beginner contract.

Other tests check inline-script contract rejection, runtime errors, code/understanding independence, post-reveal requirements, source invalidation, persistence reconstruction, bounded history, hostile webview messages, escaping model HTML, actual button messages, commands/CSP, and the full offline controller flow with a real child runner. A hanging click handler demonstrates the parent timeout. The worker environment is built from an allowlist; tests also verify that Node globals are not directly supplied to the jsdom context. This is not an escape-resistance claim.

Python tests cover code leakage at levels 1–2, safe fallbacks, bounded retries, valid retry responses, invalid requests, missing keys, no provider invocation in offline mode, custom-roadmap verification labels, complete rubric indexes, exact evidence support, sanitized errors, and browser-origin rejection. Provider responses are mocked; there is no claim of live API success.

The HTTP smoke script launches real Uvicorn and checks health, curriculum, a scripted hint and missing-key roadmap failure. Package verification extracts the VSIX outside the repository and executes its shipped runner to expose missing dependencies.

## Deliberate coverage limits

No layout engine, visual regression, full accessibility audit, async network flows, ES modules, framework behavior, malicious-code resistance, or general learning measurement. Enter checks dispatch keydown; they do not reproduce every browser default form submission behavior. Use explicit keydown handling for the V1 recovery contract. More browser-based testing and stronger isolation are future improvements.
