# Two-minute NEXUS demonstration

## Before presenting

Follow the [source setup instructions](../README.md#start-here--windows-powershell): clone, install dependencies, build, then launch with F5. GitHub does not include a prebuilt VSIX. Review the [reported automated results](IMPLEMENTATION_STATUS.md#current-evidence-summary) and run the checks when validating a new build. Keep AI disabled and stop the backend to show offline independence. Widen the sidebar. Start the guided project. Prepare the HTML structure yourself in `codesense-lab/index.html`, but leave `app.js` unfinished. If you copy a reference, use Reveal in that session so the Assisted label is honest. Keep the bundled reference files available for an explicit reveal; do not present copied code as independent work. Rehearse modal confirmations and editor focus.

## Script

| Time | Action | Say |
|---|---|---|
| 0:00–0:15 | Show Home and start the To-Do project | “AI can help us build quickly. CodeSense separates working code from understanding it.” |
| 0:15–0:35 | Show real HTML; run milestone 1; answer concept questions | “These are executable, curated DOM checks. Conceptual understanding is assessed separately by a limited guided rubric.” |
| 0:35–0:55 | Open milestone 2; run incomplete JS; request level 1 then 2 | “Failures are real. Hints guide reasoning before revealing code. This demo works without a key or a backend.” |
| 0:55–1:15 | Explicitly Reveal; copy reference JS into app.js; rerun | “Students may reveal a solution, but the Passport records Assisted. Passing tests alone does not establish understanding.” |
| 1:15–1:40 | Answer explain-back; implement Enter mini-task; run recovery checks | “Recovery requires both explain-back and a related implementation task. These checks rerun the original behavior too.” |
| 1:40–1:55 | Show Passport; optionally reload window | “Attempts, hints, conceptual outcomes and assistance persist locally. We do not invent mastery scores.” |
| 1:55–2:00 | Return Home and point to custom mode | “Live AI can create custom roadmaps. Custom tests are explicitly unavailable in V1; verified templates are a finals goal.” |

If time is short, demonstrate the recovery check with the change prepared in an editor but only save it after explaining the task. Do not claim a pass without executing it.

## Recovery rehearsal reference — deliberate assistance

Milestone 1: add visible help text and connect the input's `aria-describedby` to that text's ID. Run recovery checks and answer the post-reveal quiz.

Milestone 2, when using the bundled reference's variable/function names:

```javascript
input.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addTask();
  }
});
```

This snippet is an explicit rehearsal solution, not a level 1 or 2 hint. Use the Reveal flow when relying on it. Recovery requires the current reference behavior plus keyboard behavior and explain-back.

## Likely judging questions

- **Does AI decide code correctness?** No. Only the curated executable suites set implementation verification.
- **How do you know tests are valid?** We review requirements, pass a correct reference and confirm seeded defects fail the relevant checks. This is evidence, not perfection.
- **Can it test any website?** No. Automated implementation checks support the two To-Do milestones. Mode A supports custom projects with advisory reviews, conceptual assessment and self-reported completion, but no automated implementation verification.
- **Is jsdom a sandbox?** No. This is a trusted, controlled demo with a separate process and limits. Strong isolation is future work.
- **Does the quiz prove learning?** No. It checks limited concepts. Our planned 3–5 participant pilot will provide preliminary evidence only.

## Mode A manual rehearsal

Use this as a separate live-AI demo after the offline guided demonstration. Roadmaps, multiple-project navigation, live Gemini hints, selected-code consent, advisory review, free-text assessment, self-reported completion and Passport persistence after reload have been manually demonstrated in the Extension Development Host. Automated checks cover controller, webview, storage and mocked backend/provider behavior. The steps below remain a rehearsal guide, not a claim that every edge case or live request passed.

1. In `backend/.env`, keep the existing secret key server-side and confirm `AI_ENABLED=true`, `AI_PROVIDER=gemini`, and a model available to your account. Do not display `.env` while presenting or copy it into project context.
2. Restart the backend from the repository root: `.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`. Check `Invoke-RestMethod http://127.0.0.1:8000/health`. `ai_configured: true` checks configuration presence, not account quota.
3. Open the repository root in VS Code. Select **Run CodeSense AI** and press **F5**. Its existing launch task compiles/stages the extension. In the development host, open a trusted disposable web-project folder for the custom demo.
4. Open **CodeSense AI: Open Mentor**. In Settings, enable **CodeSense: Ai Enabled** and leave **Backend Url** at `http://127.0.0.1:8000`. On Home, under **What would you like to build?**, enter “A beginner login and registration web interface with clearly labeled fields, using only fictional credentials” and choose Beginner. Click **Generate roadmap**. Expect 3–4 milestones; malformed/failed generations should show an error and retain older projects.
5. Click **Start Milestone** on the first milestone. Inspect goal, concepts, expected behaviors, suggested steps, and provisional criteria. Confirm **Automated verification unavailable for this milestone.** appears and there is no custom test-run or implementation-verified control. Select another milestone, use Previous/Next, and return to the first.
6. Create or open your own saved `index.html` inside the trusted demo workspace. Make an intentionally incomplete login form with a username input that lacks an associated label. **Begin in a new HTML file** is optional and opens an untitled editor; save it yourself before sharing context. Keep existing work intact. Request a Level 1 hint with **No code** and confirm the hint and assistance count appear.
7. Select a small relevant, nonsecret snippet. Expand **Code context · optional**, choose **Selected code**, and request Hint 2, and inspect the confirmation text. **Cancel first**: the UI should report cancellation, send no request, and leave hint counts unchanged. Repeat and choose **Send selection**. Check the response is a conceptual/directional question with no code. Try **Current file** and confirm **Send current file**; files larger than 4,000 characters require a selection. Opening `.env`, a private file, a dependency file or an external file must block sharing before a confirmation. Do not deliberately insert real secrets to test this.
8. In **Review My Code**, choose **Selected code** and click **Review My Code**. Cancel the first consent dialog and confirm no attempt is recorded. Approve the next one. Inspect satisfied items, potential issues, grounded observations, unknowns and next actions. For the incomplete form, the missing label is a plausible issue; inspect the actual response rather than assuming the model finds it. Confirm **AI Code Review — Advisory only. Implementation not automatically verified.** remains visible. If the provider fails, expect an unavailable attempt and no verified result.
9. Click **Prepare concept question**. If the review identified an issue, the question should refer to it; the three-part rubric stays fixed. Expand **Assessment rubric**, enter a 20–3,000 character explanation, and click **Submit explanation to AI**. Inspect feedback, revise and retry; **Refocus concept question** can use newer review, rubric or hint evidence without changing the rubric. **AI conceptual rubric met** still does not verify code. Expand **Self-report completion**, review the provisional criteria, check the acknowledgment and click **Mark Self-Reported Complete**. Confirm the status says **Self-Reported Complete** while automated verification remains unavailable.
10. Open **Passport**. Find the custom project and check milestone progress, review attempts/latest completed summary, hint totals/highest level, assistance label, conceptual outcome, explanation attempts and history. If outside help was used without a hint, record **I used outside solution help** from that milestone. Return Home, create a second roadmap, then use **My Projects → Open roadmap** or **Resume milestone** to switch between them; each project's records must remain intact. Passport also offers **Resume custom project**.
11. Run **Developer: Reload Window**. Open **CodeSense AI: Open Mentor**, then choose **Resume Current Milestone** under **Resume Active Project**, or **My Projects → Resume milestone**. Expect the same project/current milestone, review, self-report, hints, submitted explanations and outcomes. Previously existing guided Passport records must remain available in the same workspace.
12. Stop the backend. Request a custom hint with **No code**: expect a labelled generic fallback and usable navigation. Retry an explanation: expect **Assessment unavailable**, the saved explanation and no new conceptual pass. Restart the backend and retry. If the provider rate-limits requests, expect the same safe behavior; do not force quota exhaustion for the demo.
13. Disable **CodeSense: Ai Enabled** and run the original guided To-Do flow, including verified tests, conceptual quiz, reveal and recovery. This still works offline. Custom navigation and generic hints also remain available offline; preparing a new question and evaluating explanations need the backend/AI settings.

The first custom concept question intentionally uses a stable template based on the milestone's first concept and goal, avoiding an extra model call and changing rubrics between retries. Custom test-template matching, editable roadmaps, automatic implementation completion and custom recovery are outside this deadline's slice. Secret and hint screening are heuristic; review context and model feedback yourself.
