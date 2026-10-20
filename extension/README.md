# CodeSense AI

**Don't Just Build It. Understand It.**

An offline-first VS Code learning mentor for the NEXUS 2026 PS2 challenge. Mode A supports saved custom web-project roadmaps, consent-based code hints, advisory AI Code Review and conceptual explain-back. Mode B provides an authored To-Do List with verified guided checks, offline hints and recovery.

Open a local folder, open the CodeSense activity-bar icon, and select **Start / resume guided project**. Edit `codesense-lab/index.html` and `app.js` in the real editor. Node.js 22.12 or newer must be installed and available on PATH (or set `codesense.nodePath`).

Two implemented milestones teach accessible HTML and adding tasks with JavaScript. Run verified local checks, request progressive hints, and answer a guided conceptual assessment. Implementation and understanding are separate achievements. Progress persists in VS Code workspace storage.

Revealing a reference records **Assisted**. A fresh explain-back and a related, executable recovery task are required for **Recovered Understanding**.

Offline mode is the default and makes no backend or AI requests. Optional AI features need the repository's loopback FastAPI backend, an environment-based Gemini key (or optional OpenAI configuration), and `codesense.aiEnabled`. AI Code Review is advisory; arbitrary custom milestones have no verified executable tests in V1.

**Execution boundary:** Only run demo code you wrote or reviewed. Tests use a separate process, a scrubbed environment, an 8-second timeout, and a V8 heap limit. Node.js and jsdom are not a secure sandbox. Do not run untrusted or downloaded code. CSS layout and real browser keyboard defaults are outside these DOM checks.

Commands: **CodeSense AI: Open Mentor**, **CodeSense AI: Start Guided To-Do Project**, and **CodeSense AI: Learning Passport**.
