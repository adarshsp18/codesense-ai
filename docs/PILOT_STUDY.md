# Small classroom pilot — recording plan, not results

Invite 3–5 classmates voluntarily. Use anonymous IDs, explain that the exercise evaluates the tool rather than grading them, and let them stop. Do not record names, emails, API keys or unrelated source code. No pilot has been conducted as part of this implementation.

1. Ask the pre-test question without hints. Score it using the rubric below.
2. Start a fresh local workspace per participant so Passport counters are separate. Use the same two guided milestones, instructions and maximum session length (suggestion: 15 minutes).
3. Record start/end time, hint count, implementation and recovery attempts, solution reveals and final classifications from Passport. Record observable behavior, not assumed mastery.
4. Ask the post-test question without hints. Apply the same rubric. If feasible, have a second team member independently score anonymized responses and discuss disagreements.
5. Ask “What helped you understand?” and “What confused you?” Record brief voluntary feedback.
6. Enter observations in `pilot-template.csv`. Leave missing data blank; never enter zero to mean missing.

## Comparable questions

**Pre-test:** “A To-Do page has a Task input, an Add Task button and a list. JavaScript creates an item in memory when you click, but it does not appear. Explain what creates the behavior, why the item is invisible, what makes it part of the page, how its text should be set, and what should happen for blank input.”

**Post-test:** “A shopping-list page has a Product input, an Add Product button and a list. A newly created product item exists in memory but is not visible. Explain how the click triggers the behavior, why creation is insufficient, how it becomes part of the page, how to use the typed text, and how to handle spaces-only input.”

## Five-point scoring rubric

Award one point for each explicit correct concept, zero if missing or contradictory. Total is an integer from 0 to 5. Do not award for terminology alone without meaning.

| Point | Required concept |
|---|---|
| 1 | An event listener/handler connects a user action to behavior. |
| 2 | Creating a node makes a detached in-memory object; it does not automatically appear. |
| 3 | The node must be inserted into the document/list to become part of the page. |
| 4 | The entered text supplies the item's text content; treating it as text avoids interpreting it as HTML. |
| 5 | Trim and reject empty/whitespace input before changing the list. |

## Recording and calculation

`pilot-template.csv` contains only anonymous placeholder IDs and empty measurements. `milestone_completed` means the recorded classification and supporting implementation/concept outcomes meet your stated criterion; include the classification so Assisted is not confused with independent completion. Use yes/no for reveal/completion. Time is elapsed minutes. `test_attempts` includes implementation plus recovery attempts; `hints` is the total across both milestones.

Individual score change = post-test score − pre-test score (range −5 to +5). Average change = sum of individual changes / number of participants with **both** scores. Report that denominator, pre/post scores, session times, reveal counts, and missing observations. Do not divide by all invited participants when data is missing. For three paired changes of a, b and c, the mean is (a + b + c) / 3; these are symbolic values, not pilot results.

This tiny convenience sample provides **preliminary evidence**, not conclusive proof of learning effectiveness or causality. Practice effects, unequal prior knowledge, facilitator assistance and the similar questions are limitations. Report actual feedback, including negative feedback; do not generalize beyond the sample.
