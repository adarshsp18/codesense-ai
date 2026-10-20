# Final UI rehearsal in VS Code

Automated jsdom webview tests cannot establish that every control looks correct in a real VS Code theme. Perform this checklist before presenting, even when host activation tests pass.

On the build machine, the native launch attempt reported **“Code is currently being updated. Please wait for the update to complete before launching.”** Finish the existing VS Code update normally before running F5 or the host test. This build did not terminate updater processes or claim a native host pass.

1. Run `npm.cmd ci` then `npm.cmd run build` from the repository root. Open the root in VS Code; choose **Run CodeSense AI**, press F5. In the new window run **CodeSense AI: Open Mentor**. Confirm branding, tab navigation and readable wrapping at a narrow sidebar width.
2. With `codesense.aiEnabled=false` and no backend, start the guided project. Confirm the real index.html opens and the other file buttons work. Run starter tests; confirm failures are genuine. Verify the execution modal names the controlled demo and explains its isolation limit. Cancel once and confirm no result is invented.
3. Implement accessible HTML per the contract, save and run. Expect 5/5. Answer the quiz incorrectly; implementation remains verified while concepts need revision. Answer correctly; expect Understanding Verified.
4. Implement app.js using the milestone requirements. Test a missing handler or missing input clearing, then fix it. Expect 10/10 for milestone 2. Check all three hint levels and their source labels. No source upload control should appear offline.
5. Reveal a reference explicitly. Confirm an untitled reference opens and the learner file is unchanged. Expect Assisted even if earlier tests/concepts passed. Answer the post-reveal quiz, add the Enter behavior and run recovery: expect 14/14 and Recovered Understanding. M1 recovery has 6 checks.
6. Edit/save a tested file: current verification becomes stale; past results stay visible. Rerun. Reload VS Code and verify actual counters and status persist. Switch to another workspace and verify it has separate progress.
7. Try malformed/short custom ideas and backend unavailable errors. With AI disabled, custom generation explains the requirement. With a configured live key, generate a 3–5 milestone roadmap; verify every milestone's unavailable-verification notice. Use saved-roadmap navigation and the new HTML editor action. Live calls incur your provider's normal charges.
8. With AI enabled, select a small demo snippet. Check context sharing, cancel the send modal, then retry only with nonsensitive content. Confirm unrelated files cannot be sent. Disconnect the backend: hints fall back and guided tests/quiz still work.
9. In a trusted review-only test folder, verify a looping app.js is stopped after roughly eight seconds. Never use malicious code to test isolation; this prototype is not designed to contain it.
10. Check light and dark themes, keyboard Tab/Enter, focus outlines, radio labels, screen-reader status announcements and disabled buttons while busy.

## Automated real host command

The host test creates its own demo in `.tools/host-workspace` and checks activation, all three commands, sidebar opening, file creation, opening the real editor, preserving edits on resume and Passport navigation. It writes `host-test-result.json` only after all assertions pass.

```powershell
New-Item -ItemType Directory -Force .tools\host-workspace | Out-Null
code.cmd --extensionDevelopmentPath="$PWD/extension" --extensionTestsPath="$PWD/extension/tests/host-runner.cjs" --user-data-dir="$PWD/.tools/vscode-host-profile" --extensions-dir="$PWD/.tools/vscode-test-extensions" --disable-extensions --disable-workspace-trust --skip-welcome --skip-release-notes --new-window "$PWD/.tools/host-workspace"
Get-Content .tools\host-workspace\host-test-result.json
```

The command disables workspace-trust onboarding only in the isolated test profile and uses bundled trusted fixtures. Normal use retains workspace-trust checks. A CLI exit alone does not prove host-test success: inspect the result file and extension-host logs. Native GUI testing may be unavailable in headless/restricted environments.
## UI refinement: manual review still required

Run the source development host with F5. These checks are not claimed as passed by the DOM tests:

- Set the sidebar to 300px, 350px and 400px, then widen it. Check wrapping, primary-action visibility and absence of horizontal scrolling on Home, custom roadmap/workspace, guided workspace and Passport.
- Review light, dark and high-contrast VS Code themes, plus 200% zoom. Check text, placeholders, separators, disabled buttons and visible focus. Colors should follow the editor theme.
- Use Tab, Shift+Tab, Enter and Space through Home, milestone navigation, native disclosure summaries, radio choices, hints and explain-back. Confirm focus survives a hint request and moves to the heading on navigation.
- Verify the project prompt and one Generate roadmap action lead Home; Resume milestone and guided To-Do appear below. AI enabled describes configuration, not a successful live connection.
- In custom mode, expand Switch milestone, Suggested steps, Proposed acceptance criteria and Code context. Confirm disclosure state persists during requests. Cancel and approve real code-sharing dialogs; the existing consent requirement must remain intact.
- In guided mode, run failing checks and read the visible failure diagnostics. Passing checks should be collapsed separately. After a current code pass, explain-back should open naturally. Reference solution stays secondary; reveal and recovery still work.
- Request short and long hints. Confirm the reserved output region reduces movement and long text remains fully readable. Check working, disabled, error and empty states with a stopped backend.
- In Passport, inspect current versus stale code evidence, independent/assisted completion labels, recovered understanding and custom AI rubric outcomes. No custom implementation pass or invented score should appear. Expand histories and resume a project.
- With a screen reader, check labels, milestone position, loading/status announcements, disclosure state and evaluation feedback. Reload the window and verify saved learning records remain intact.

