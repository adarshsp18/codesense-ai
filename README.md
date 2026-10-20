# CodeSense AI

**Don't Just Build It. Understand It.**  
NEXUS Hackathon 2026 · PS2 — AI Coding Mentor That Teaches, Not Just Generates

CodeSense AI is a VS Code learning mentor for students who can obtain generated code but need help understanding and building it themselves. Built for NEXUS 2026 Round 1, Problem Statement 2, it guides learners through milestones, progressive hints and conceptual assessments while recording their learning activity.

Its focus is the learning process: learners write in their own editor, explain their reasoning, and see implementation results separately from conceptual outcomes. Solution assistance is recorded rather than treated as independent completion.

| Implemented mode | What learners can do | Verification boundary |
|---|---|---|
| **Mode A — Build Your Own** | Generate personalized AI roadmaps from a web-project idea and learning level; manage multiple projects; navigate interactive milestones; request consent-based contextual hints and advisory AI Code Review; submit free-text conceptual assessments; self-report completion; track activity in the Learning Passport. | AI review is advisory and completion is self-reported. Arbitrary custom implementations have no automated tests. |
| **Mode B — Guided Learning** | Complete two authored To-Do List milestones with developer-reviewed jsdom tests, progressive offline hints, conceptual assessments, solution reveal and recovery tasks, and a saved Learning Passport. | Tests cover the authored DOM contract. Conceptual assessment is separate and does not prove general mastery. |

The guided cycle works without Python, a backend, an API key or an internet connection after dependencies are installed and the extension is built. Live AI features require a separately configured FastAPI backend and provider access. This prototype does not establish reliable results for every AI request or measured learning improvement.

**Stack:** TypeScript VS Code extension and theme-aware webview; local workspace-state records; Node.js, jsdom and DOM Testing Library for the guided runner; optional loopback FastAPI/Pydantic backend using Google's official `google-genai` SDK. Gemini is the current prototype provider; OpenAI remains configurable. See [architecture and trust boundaries](docs/ARCHITECTURE.md).

## Start here — Windows PowerShell

Prerequisites: Git, VS Code **1.95+**, and Node.js **22.12+** (reported tested version: 24.18.0). The optional backend requires Python **3.11+** because it uses `asyncio.timeout`; Python **3.12** is recommended to match the reported 3.12.15 test environment.

Clone the source, install dependencies, and build:

```powershell
git clone https://github.com/adarshsp18/codesense-ai.git
cd codesense-ai
npm.cmd ci
npm.cmd run build
code .
```

If already cloned, run the install/build commands from the repository root. `npm.cmd` avoids PowerShell's `npm.ps1` execution-policy restriction. No policy change is needed. On other platforms use `npm` instead of `npm.cmd`.

In VS Code, open this **root folder**, select **Run CodeSense AI** in Run and Debug, then press **F5**. A separate **Extension Development Host** opens. In that window, click the CodeSense activity-bar icon or run **CodeSense AI: Open Mentor** from the Command Palette. If prompted, trust this repository only after reviewing it. Click **Start / resume guided project**.

If the sidebar is narrow, drag its edge wider for the demonstration.

### Optional: package a VSIX locally

**The GitHub repository contains source code, not a prebuilt VSIX.** After installing dependencies, the existing package script builds and stages the extension and creates the local archive:

```powershell
npm.cmd run package
# Optional package-content and bundled-runner verification:
node scripts/verify-package.cjs
# Install only after the archive has been generated locally:
code --install-extension .\artifacts\codesense-ai-0.1.0.vsix
```

`artifacts/` and `*.vsix` are ignored by Git. The archive includes the extension's runtime dependencies; Node.js must still be installed to run guided tests. Live AI still requires the separately configured backend below. Local installation does not publish to the Marketplace.

Package extraction/runner checks are not a clean VS Code installation test. A clean VSIX installation has **not** been manually verified.

## Verification evidence

- **Latest reported automated results:** TypeScript compilation, **68/68 Node tests**, **211/211 Python tests**, and **5/5 backend smoke checks** passed. AI provider tests use mocks. These results were not rerun during this documentation audit.
- **Subsequent manual demonstrations in the Extension Development Host:** Mode A roadmap generation and milestone navigation; multiple custom projects and navigation; progressive live Gemini hints; selected-code consent; live advisory AI Code Review; free-text conceptual assessment; self-reported milestone completion; Learning Passport persistence after reload; and Mode B guided test execution, including expected failures.
- **Scope:** The manual demonstrations establish observed behavior in that development host. They supersede the earlier claim that native activation still needed confirmation, but do not establish an automated host-test pass, clean VSIX installation, universal Gemini reliability, arbitrary-project implementation correctness, or learning improvement from a controlled study.

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for historical evidence and [manual verification](docs/MANUAL_VERIFICATION.md) for remaining rehearsal checks.

## Mode B — Guided Learning: offline demonstration

Keep `codesense.aiEnabled` **false** (the default). You can stop the backend and disconnect the network.

1. **Start / resume guided project** creates `codesense-lab/index.html`, `app.js`, and `style.css`. Existing marked demo files are preserved; other folders are not overwritten.
2. Read the project contract. Build one native text input named **Task**, one native button named **Add Task**, and an empty `ul` or `ol` named **Tasks**. IDs are your choice. Label the input using a linked label or `aria-label`. Keep the provided plain `app.js` script tag.
3. Click **Save & run verified tests**. Review the execution confirmation and choose **Run reviewed demo** only for code you wrote or reviewed. The actual saved files run in a separate process.
4. Request hint levels 1, 2, and 3. Levels 1–2 contain no code. In offline mode these are clearly labelled scripted hints.
5. Answer both conceptual questions. A code pass and a conceptual pass are separate outcomes.
6. Select **2. Interaction**. Implement adding trimmed text, clearing input, rejecting blank tasks, and preserving earlier tasks. Run the tests again.
7. Optionally **Reveal solution**. This opens an untitled reference editor and records **Assisted**; it never overwrites your file. Copy it yourself if wanted. Complete the explain-back again and implement the recovery mini-task.
8. Open **Passport**, then run **Developer: Reload Window**. Return to Passport to see persisted attempts, hint counts, results, and assisted/recovered classification.

Use [the two-minute demo script](docs/DEMO_SCRIPT.md) for the presentation and [manual verification checklist](docs/MANUAL_VERIFICATION.md) for final rehearsal.

## Optional FastAPI backend and live AI

On a machine with Python installed:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
# First setup only: preserve an existing .env and its keys.
if (!(Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
code backend\.env
```

The command selects Python 3.12; use `py -3.11` if that is your installed supported version. The local `.venv` and any setup tools are ignored and must not be shared. If an environment already exists, confirm its Python version, skip creation and install the locked requirements into it.

Edit `backend/.env` locally to select Gemini:

```dotenv
AI_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=your-own-google-ai-studio-key
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_MODEL` defaults to `gemini-2.5-flash` when omitted or blank. This is the repository default, not a guarantee of account access or free-tier availability. Google's [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) currently restricts 2.5 access to prior users; consult it and [pricing](https://ai.google.dev/gemini-api/docs/pricing) for your account. If unavailable, explicitly set another model your account can use that supports structured outputs. Access and quotas are not checked at startup, and the backend does not silently switch models or providers.

OpenAI remains optional. To use it, set these values in the same server-side file:

```dotenv
AI_ENABLED=true
AI_PROVIDER=openai
OPENAI_API_KEY=your-own-openai-key
OPENAI_MODEL=gpt-4.1-mini
```

An unset `AI_PROVIDER` preserves legacy OpenAI behavior; the example file explicitly selects Gemini. Only the selected provider's key is required. Keep real keys exclusively in the ignored `backend/.env` or server environment, never in extension settings, source files, or examples. Existing process environment variables take precedence over `.env`.

Gemini uses the [official Google Gen AI SDK](https://googleapis.github.io/python-genai/) with asynchronous requests and [structured JSON outputs](https://ai.google.dev/gemini-api/docs/structured-output); all responses are validated against the existing Pydantic schemas. OpenAI retains its Responses API, Pydantic schemas, and `store=False`. Both paths keep roadmap verification labels, Socratic hint validation (including no code at levels 1 and 2), and complete rubric/evidence checks. Gemini calls have a 12-second transport timeout and no automatic SDK retries; the existing hint validator may retry rejected hints once. The overall request deadline remains 35 seconds.

Model access and quotas depend on the account. Automated AI tests use mocked providers; they do not establish that live requests work for a faculty member's key or model. The manual demonstrations above included live Gemini interactions, but requests can still fail or return inadequate feedback.

Start from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

The unchanged health response includes `ai_configured`: true means AI is enabled, `AI_PROVIDER` is supported, and the selected key is nonempty. It makes no provider request and does not validate credentials, model access, or quota. It never returns keys. `offline_guided_available` stays true regardless of AI configuration.

Missing/disabled AI or an unsupported provider returns HTTP 503 for provider-dependent routes. The deterministic `/learning/question` route does not call the provider. Gemini rate limits, invalid credentials, unavailable models, network errors, and invalid/blocked/truncated output return sanitized HTTP 502 errors; timeouts return 504. For authentication/access messages check the key and account access; for model errors check `GEMINI_MODEL`; for quota errors wait or check your account quota. These are upstream provider failures, not raw provider HTTP statuses returned to the extension. Provider response bodies and credential values are not logged or returned. Hint requests fall back to scripted hints on these failures; the offline guided cycle, recovery workflows, and Learning Passport remain available.

In VS Code Settings, enable **CodeSense: Ai Enabled** and leave **Backend Url** at `http://127.0.0.1:8000`. Restart the backend after changing `.env`. The API key stays exclusively in the backend environment.

## Mode A — Build Your Own

Generate a roadmap, then choose **Start Milestone**. You can select any milestone, move previous/next, open the full roadmap, or resume the current milestone. Every milestone displays its goal, concepts, expected behaviors, steps, and **provisional AI-generated acceptance criteria**. Existing files are never overwritten; **Begin in a new HTML file** opens an untitled editor that you save yourself.

Home now shows **Create New Project**, **Resume Active Project**, **My Projects**, and the guided To-Do List. My Projects lists each saved roadmap with its learning level (or **Level not recorded** for older saves), milestone count, current milestone and active marker. **Open roadmap** switches projects without advancing a milestone; **Resume milestone** opens its saved position. **Back to Projects** returns Home, and **Back to Roadmap** returns the active roadmap. Duplicate titles are safe because projects use stable IDs.

Roadmaps and each project's active milestone and learning history persist in workspace storage under `codesense.customProjects.v1`, separately from guided Passport records. A recoverable legacy `codesense.roadmap` is imported while its original value remains untouched; Passport summaries alone cannot recreate a missing roadmap. If some legacy evidence is malformed, valid evidence is retained and the UI warns that the original record needs review. Storage supports up to 20 projects, keeps the latest 10 hints, 10 advisory reviews and 20 explanation attempts per milestone, and retains lifetime attempt counters. Damaged custom records are preserved and do not disable guided learning. Unrelated or ambiguous project ideas receive a concise prompt to describe a web interface before any roadmap provider call.

For custom hints, expand **Code context · optional** and choose **No code**, **Selected code**, or **Current file**. Only the active milestone, previous hints for that milestone, and your approved snippet are sent. Sharing requires a trusted workspace and a saved web source file inside it (`html`, `htm`, `css`, `js`, `jsx`, `ts`, `tsx`, `vue`, or `svelte`). Select at most 4,000 characters; whole files above that limit are rejected rather than silently truncated. Every code-sharing request shows the exact snapshot in a confirmation dialog. Cancelling sends nothing. Hidden files, `.env` files, credential files, dependency folders, external paths and links resolving outside the workspace are excluded. Secret screening is conservative and heuristic: review the displayed content yourself. Source snapshots are not stored in the Passport; generated hints, which can include Level 3 examples, are recorded. No files are scanned automatically.

Hints use the existing `/mentor/hint` route and validation. Levels 1 and 2 reject code and common solution disclosures; the backend retries rejected output once, then returns a safe generic hint. Network failures and quota errors fall back without blocking navigation. With AI disabled, custom hints are generic scripted questions and no backend request is made.

**AI Code Review** takes only a selected snippet or current saved file through the same per-send consent and secret guard. It compares the active milestone with the approved snippet and returns structured, advisory observations, possible issues, unknowns and next actions. The backend validates the response and fixes `verification_status` to `unverified`; it does not execute code or award a verified pass. Incomplete snippets cannot establish behavior in other files. Review attempts and feedback are saved locally, but code snapshots are not. A failed provider request records an unavailable review attempt without claiming success. A recent review issue can focus a later hint or explain-back question; when refocusing a question, previous rubric gaps or no-code hints may supply context. No extra model call is used for the question.

Choose **Prepare concept question** to display a question based on the milestone's first concept and goal, plus a fixed three-part rubric: explain the concept, connect it to the goal, and predict an outcome with causal reasoning. This question is assembled deterministically by the backend, so the rubric stays stable across retries; it does not consume a Gemini generation. Submit a 20–3,000 character explanation for AI evaluation. The existing `/learning/evaluate` route checks complete rubric coverage and exact supporting evidence. Feedback, attempts and errors are saved locally; you can revise and retry. Failed requests never record a conceptual pass.

The custom Passport shows **Not Started**, **In Progress**, **Review Requested**, or **Self-Reported Complete** for activity, alongside review attempts and the latest completed advisory summary. Learners can self-report completion only after acknowledging the provisional acceptance criteria; this remains unverified. **AI rubric met**, **Needs revision**, or **Assessment unavailable** are separate conceptual outcomes. Any hint or **I used outside solution help** marks the milestone **Assisted learning**. **Independent so far (no assistance recorded)** describes only recorded activity, not independently proven work. No custom recovery verification or completion certificate is claimed.

Every custom milestone displays **Automated verification unavailable for this milestone.** No custom tests are executed, generated or marked verified. The authored To-Do suites, seeded defects, guided recovery and existing Passport remain intact. AI explanation feedback is never proof of implementation correctness.

Guided hints retain their existing selected-demo-code confirmation and offline fallback. Backend routes remain local-only: `GET /health`, `GET /guided-projects`, `GET /guided-projects/todo`, `POST /roadmap/generate`, `POST /mentor/hint`, `POST /mentor/review`, `POST /learning/evaluate`, and `POST /learning/question`. Question generation is deterministic. Existing guided request/response shapes remain compatible; custom hint/evaluation/review requests use `kind: "custom"` plus a bounded `milestone` object. Code-bearing hints and reviews require `context_consent: true`. Clients cannot supply arbitrary tests or replace the assessment rubric. Schema docs are at `http://127.0.0.1:8000/docs`; browser-origin POSTs remain rejected.

Follow the [Mode A manual rehearsal](docs/DEMO_SCRIPT.md#mode-a-manual-rehearsal) for exact launch, consent, retry and reload checks.

## Run the checks

```powershell
# Compile, acceptance checks, seeded-defect validation, progress, UI and controller tests
npm.cmd test

# Alternative to npm test: build/stage, then run all Node suites serially
npm.cmd run build
node --test --test-concurrency=1 test-runner/tests/*.test.cjs extension/tests/*.test.cjs

# Acceptance and seeded-defect checks only
npm.cmd run test:seeded

# Backend validation, offline behavior, AI adapter mocks, hint leakage tests
.\.venv\Scripts\python.exe -m pytest backend\tests -q

# Starts real Uvicorn, checks HTTP, then stops that server
.\.venv\Scripts\python.exe scripts\smoke_backend.py

# Real standalone runner against the reviewed bundled reference
node test-runner\src\run-tests.cjs test-runner\fixtures\correct add-task --trusted-demo

# Only after npm.cmd run package creates a local VSIX:
node scripts\verify-package.cjs
```

The standalone runner exits 0 on pass, 1 for failed checks, and 2 for setup/runner errors. For your own reviewed demo: replace the fixture path with `codesense-lab`; add `--recovery` for recovery tests. The CLI does not update the extension Passport.

## Repository structure

```text
extension/                TypeScript extension, webview, state and message validation
  src/panels/             Sidebar controller
  src/services/           Backend client, lab files, progress and messages
  media/                  Theme-aware CSS and browser UI
  tests/                  State, UI, controller and host checks
backend/                  Optional FastAPI service and Python tests
  app/services/           AI provider, hint validator, roadmap and rubric services
shared/guided-projects.json  Single curriculum/contract source
test-runner/              Separate process, real jsdom checks, fixtures and defects
scripts/                  Build staging, package verification and backend smoke test
docs/                     Architecture, demo, test coverage, pilot and status
.vscode/                  F5 launch and build task
artifacts/                Created by local packaging; absent from GitHub (ignored by git)
```

## What V1 does and does not establish

- **Implemented:** two guided milestones, real checks, offline hints and rubric quizzes, saved Passport, solution reveals, two tested recovery tasks, interactive custom milestones, approved code-context hints and advisory code review, custom explain-back, self-reported progress and separate custom Passport records.
- **Verification boundaries:** AI routes are tested with mocks; live provider behavior needs an API key and account access. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for exact evidence and UI limitations.
- **Execution:** trusted, controlled demo files only. Node/jsdom and VM contexts are **not a secure sandbox**. The worker has a scrubbed environment, an 8-second parent timeout, 500 ms script-initialization limits and a 96 MB V8 heap limit. These do not restrict filesystem/network syscalls or all child processes. Never run hostile, downloaded, or unreviewed code. VS Code workspace trust and a per-run confirmation are required.
- **Checks:** native semantics, accessible names, DOM-visible state and synchronous event behavior are covered. Real browser layout, every accessibility issue, asynchronous code, frameworks, modules and arbitrary workspace projects are outside this contract. A determined learner can game tests; this is an educational prototype.
- **Hints:** heuristic leakage validation rejects common code and direct solutions, retries once, then falls back. It cannot detect every paraphrased disclosure.
- **Learning:** a two-question guided rubric is a limited concept check, not a validated general mastery measure. AI rubric reviews can be wrong. Conceptual assessments do not prove learning improvement; no pilot results are claimed.
- **Later:** complete/delete/filter To-Do tasks, editable custom roadmaps, approved custom test templates, richer analytics, and stronger sandboxing.

Troubleshooting: use `npm.cmd`, open the repository root for F5, rerun `npm.cmd ci` and `npm.cmd run build`, and ensure Node 22.12+ is on PATH. If Node is installed somewhere unusual, set `codesense.nodePath` to its full executable path. A “files changed” notice means rerun checks. Backend problems never prevent the offline guided cycle. Do not delete `codesense-lab` to fix a problem without backing up your own work.

## Project links

- [GitHub repository](https://github.com/adarshsp18/codesense-ai)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Test coverage and seeded defects](docs/TEST_COVERAGE.md)
- [Pilot study plan — no results claimed](docs/PILOT_STUDY.md)

The [MIT license](LICENSE) applies to this source. Local keys, environments, generated builds and VSIX archives are excluded from Git.
