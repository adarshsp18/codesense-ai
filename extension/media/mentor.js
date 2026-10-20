/* Model and learner strings are escaped. Actions remain handled by the extension host. */
const vscode = acquireVsCodeApi();
let state;
let drafts = vscode.getState() || {};
const app = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const send = (type, extra = {}) => vscode.postMessage({type, ...extra});
const button = (label, action, extra = '') => `<button type="button" data-action="${action}" ${extra}>${esc(label)}</button>`;
const bullets = items => `<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const badge = text => `<span class="badge">${esc(text)}</span>`;
const disclosure = (key, title, content, open = false, cls = '') => `<details data-disclosure="${esc(key)}" class="${cls}" ${open?'open':''}><summary>${esc(title)}</summary>${content}</details>`;
const heading = (context, title) => `<div class="eyebrow">${esc(context)}</div><h1 tabindex="-1">${esc(title)}</h1>`;
const hints = action => `<div class="hint-actions" aria-label="Progressive hints">${[1,2,3].map(n=>`<button type="button" data-action="${action}" data-level="${n}" class="secondary">Hint ${n}<small>${['Concept','Direction','Example'][n-1]}</small></button>`).join('')}</div>`;
function hintOutput(hint) {
  return `<div class="mentor-output" role="status" aria-live="polite" aria-atomic="true">${hint?`<div class="source">Hint ${hint.level} · ${esc(hint.source)}</div><p>${esc(hint.text)}</p>`:'<p class="muted">Start with Hint 1 when you need a nudge.<br>Hints 1 and 2 guide you without code.</p>'}</div>`;
}
function tests(result, currentHash, key = 'checks') {
  if (!result) return '<div class="diagnostics"><p class="muted">No checks run yet. Save your work, then run the verified tests.</p></div>';
  const failed=result.results.filter(r=>!r.passed), passed=result.results.filter(r=>r.passed);
  const item=r=>`<div class="test"><div class="test-name"><span class="test-label ${r.passed?'pass':'fail'}">${r.passed?'PASS':'FAIL'}</span><span>${esc(r.name)}</span></div>${r.passed?'':`<small>${esc(r.message)}</small>`}</div>`;
  return `<div class="diagnostics"><p class="status ${result.passed?'pass':'fail'}">${result.totalPassed}/${result.results.length} verified checks passed</p><small>${result.sourceHash !== currentHash?'Files changed. Rerun checks for current verification.':'Evidence applies to the saved, tested snapshot.'}</small>${failed.map(item).join('')}${passed.length?disclosure(`${key}-passed`,`Passed checks (${passed.length})`,passed.map(item).join('')):''}</div>`;
}
function home() {
  const projects=state.custom?.projects||[];
  return `${heading('Create New Project','What would you like to build?')}
    <label class="sr-only" for="idea">Your web project idea</label><textarea id="idea" maxlength="2000" aria-describedby="idea-help" placeholder="An accessible landing page for my book club…">${esc(drafts.idea||'')}</textarea>
    <div class="form-row"><label for="difficulty">Learning level</label><select id="difficulty"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
    ${button('Generate roadmap','roadmap','class="wide"')}<small id="idea-help">${state.aiEnabled?'Sends your idea to the configured AI provider. Leave out private information.':'Custom roadmaps require AI configuration. Start a guided project offline below.'}</small>
    ${state.roadmap?`<section class="section"><div class="section-label">Resume Active Project</div><h2>${esc(state.roadmap.title)}</h2><p class="muted">Milestone ${state.roadmap.current+1} of ${state.roadmap.milestones.length}</p><div class="actions">${button('Resume Current Milestone','customResume','class="secondary"')}${button('View Roadmap','savedRoadmap','class="link"')}</div></section>`:''}
    <section class="section"><div class="section-label">My Projects</div>${projects.length?projects.map(p=>`<article class="project-row" data-active="${p.id===state.custom.activeProjectId}"><div class="project-title"><h2>${esc(p.title)}</h2>${p.id===state.custom.activeProjectId?'<span class="project-active">Active</span>':''}</div><p class="muted">${p.level?esc(p.level[0].toUpperCase()+p.level.slice(1)):'Level not recorded'} · ${p.milestones.length} milestones · Current: ${p.current+1}. ${esc(p.milestones[p.current].title)}</p><div class="actions">${button('Open roadmap','customOpen',`data-project-id="${esc(p.id)}" class="secondary"`)}${button('Resume milestone','customResume',`data-project-id="${esc(p.id)}" class="link"`)}</div></article>`).join(''):state.custom?.error?'<p class="muted">Saved custom projects are unavailable. The original workspace record was preserved.</p>':'<p class="muted">No custom projects saved yet.</p>'}</section>
    <section class="section"><div class="section-label">Guided project · available offline</div><h2>To-Do List</h2><p class="muted">Two milestones. Verified checks, hints, and explain-back.</p>${button('Start / resume guided project','start','class="wide secondary"')}</section>`;
}
function milestone() {
  const m=state.project.milestones.find(m=>m.id===state.selected), e=state.progress.milestones[m.id];
  const codeCurrent=e.latestTests?.passed && e.latestTests.sourceHash===e.currentHash;
  return `${heading(`Guided To-Do List / ${m.id==='html-structure'?'1':'2'} of 2`,m.title)}
    <nav class="milestone-nav" aria-label="Guided milestones">${state.project.milestones.map((x,i)=>button(`${i+1}. ${i===0?'Structure':'Interaction'}`,'select',`data-id="${x.id}" ${x.id===m.id?'aria-current="step"':''}`)).join('')}</nav>
    <p>${esc(m.goal)}</p><div class="concepts">${m.concepts.map(badge).join('')}</div>
    <div class="row" aria-label="Project files">${['index.html','app.js','style.css'].map(x=>button(x,'file',`data-file="${x}" class="link"`)).join('')}</div>
    ${button('Save & run verified tests','tests','class="wide"')}<small>Runs your reviewed demo locally, after confirmation.</small>
    ${disclosure('guided-requirements','Requirements & project contract',bullets(m.acceptanceCriteria)+`<p>${esc(state.project.contract)}</p>`)}
    ${tests(e.latestTests,e.currentHash)}
    <section class="section"><h2>Mentor</h2>${hints('hint')}${state.aiEnabled?disclosure('guided-context','Include selected demo code','<label class="check-label"><input id="selection" type="checkbox">Review and confirm selected code before sending</label><small>Only the selected demo snippet is shared. Leave out secrets.</small>'):''}${hintOutput(state.hint)}</section>
    ${disclosure('guided-understanding','Explain your understanding',`<p>${esc(m.question)}</p><small>Answer both questions. Understanding is separate from working code.</small>${m.assessment.map((q,i)=>`<fieldset><legend>${esc(q.prompt)}</legend>${q.options.map((o,j)=>`<label><input type="radio" name="q${i}" value="${j}">${esc(o)}</label>`).join('')}</fieldset>`).join('')}${button('Check my understanding','assess','class="wide secondary"')}
    ${state.aiEnabled?disclosure('guided-ai-explanation','Write an explanation for AI review',`<label for="explanation">Your explanation</label><textarea id="explanation" maxlength="3000" aria-describedby="explanation-help">${esc(drafts.explanation||'')}</textarea><small id="explanation-help">20–3,000 characters. Submit sends this text to the configured AI provider.</small>${button('Submit explanation to AI','explain','class="wide secondary"')}`):''}
    ${e.explanation?`<p class="status ${e.explanation.passed?'pass':'fail'}">${e.explanation.passed?'Guided conceptual rubric met':'Conceptual revision needed'}</p><small>${esc(e.explanation.source)}</small><p>${esc(e.explanation.feedback)}</p>${e.explanation.missing.length?`<h3>Revisit</h3>${bullets(e.explanation.missing)}`:''}`:''}`,!!(codeCurrent||e.explanation||e.revealed),'section')}
    ${e.revealed?`<section class="section"><h2>Recovery mini-task</h2><p>${esc(m.recovery.goal)}</p>${button('Run recovery checks','recovery','class="wide"')}${tests(e.latestRecovery,e.currentHash,'recovery')}<small>Recovery requires current code checks, this mini-task, and a post-reveal explain-back.</small></section>`:''}
    ${disclosure('guided-reference','Reference solution',`<p>Revealing records Assisted status. Explain it back and pass the recovery mini-task afterward.</p>${button('Reveal solution','reveal','class="secondary"')}`,false,'section compact')}
    ${button('Back to Projects','home','class="wide link"')}`;
}
function guidedNext(e) {
  if (!e.latestTests?.passed || e.latestTests.sourceHash!==e.currentHash) return 'Save your work and run the verified checks.';
  if (!e.explanation?.passed) return 'Explain the concepts to complete the understanding check.';
  if (e.revealed && (!e.latestRecovery?.passed || e.latestRecovery.sourceHash!==e.currentHash)) return 'Complete the recovery mini-task.';
  return 'Review your evidence or continue to another milestone.';
}
function passport() {
  return `${heading('Workspace record','Learning Passport')}<p class="muted">Code checks and understanding are separate evidence.</p>
    <section class="section"><div class="section-label">Guided To-Do List</div>${state.project.milestones.map(m=>{
      const e=state.progress.milestones[m.id], current=e.latestTests?.passed && e.latestTests.sourceHash===e.currentHash;
      return `<article class="project-row"><h2>${esc(m.title)}</h2><p class="status" data-status="${esc(state.classifications[m.id])}">${esc(state.classifications[m.id])}</p>
        <dl class="evidence"><div><dt>Code</dt><dd>${current?'Verified for current files':e.latestTests?'Needs a passing current check':'Not checked'}</dd></div><div><dt>Concepts</dt><dd>${e.explanation?(e.explanation.passed?'Rubric met':'Needs revision'):'Not assessed'}</dd></div><div><dt>Assistance</dt><dd data-assistance="${e.revealed||e.hintsRequested?'assisted':'independent'}">${e.revealed?'Solution revealed':current&&e.explanation?.passed?(e.hintsRequested?'Assisted completion (hints used)':'Independent completion (no assistance recorded)'):e.hintsRequested?'Hints used':'None recorded'}</dd></div><div><dt>Recovery</dt><dd>${esc(e.recoveryStatus)} · ${e.recoveryAttempts} attempts</dd></div></dl>
        <div class="metric"><div><strong>${e.testAttempts}</strong><span>TEST ATTEMPTS</span></div><div><strong>${e.hintsRequested}</strong><span>HINTS · LEVEL ${e.highestHintLevel}</span></div></div>
        ${disclosure(`evidence-${m.id}`,'View test & understanding evidence',tests(e.latestTests,e.currentHash,`passport-${m.id}`)+(e.explanation?`<small>${esc(e.explanation.source)}</small><p>${esc(e.explanation.feedback)}</p>`:'<p>No conceptual assessment yet.</p>'))}
        <p class="next-step"><strong>Next:</strong> ${guidedNext(e)}</p>${button('Continue milestone','select',`data-id="${m.id}" class="secondary"`)}</article>`;
    }).join('')}</section>${customPassport()}`;
}
function customDetails(m, prefix='custom') {
  return `<p>${esc(m.goal)}</p><div class="concepts">${m.concepts.map(badge).join('')}</div><h3>Expected behaviors</h3>${bullets(m.expected_behaviors)}
    ${disclosure(`${prefix}-steps`,'Suggested steps',`<ol>${m.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`)}
    ${disclosure(`${prefix}-criteria`,'Proposed acceptance criteria',`<small>AI-generated and provisional. These are not verified checks.</small>${bullets(m.acceptance_criteria)}`)}
    <p class="verification-note">Automated verification unavailable for this milestone.</p>`;
}
function roadmap() {
  const r=state.roadmap;
  if (!r || !Array.isArray(r.milestones)) return `${heading('Custom project','No roadmap yet')}<p class="muted">Describe a project on Home to create your first milestones.</p>${button('Go to Home','home','class="secondary"')}`;
  return `${heading('Custom project / Roadmap',r.title)}${button('Back to Projects','home','class="link"')}<p class="muted">Choose one milestone. Work in your own files.</p>
    ${button('Resume Current Milestone','customResume','class="wide"')}
    ${r.milestones.map((m,i)=>`<article class="project-row"><div class="eyebrow">${i+1} of ${r.milestones.length}${i===r.current?' · Current milestone':''}</div><h2>${esc(m.title)}</h2><p>${esc(m.goal)}</p>
    ${button(r.entries?.[i]?.startedAt?'Continue Milestone':'Start Milestone','customSelect',`data-index="${i}" class="secondary"`)}
    ${disclosure(`roadmap-${i}`,'Milestone details',customDetails(m,`roadmap-${i}`))}</article>`).join('')}
    ${disclosure('starter-file','Need a starting file?',`<p>Open an untitled HTML starter and save it yourself. Existing files stay unchanged.</p>${button('Begin in a new HTML file','beginCustom','class="secondary"')}`,false,'section compact')}`;
}
function customDraftKey() { return `${state.roadmap?.id}:${state.roadmap?.current}`; }
function customStatus(e) { return e.selfReportedCompleteAt?'Self-Reported Complete':e.reviewAttempts?'Review Requested':e.startedAt?'In Progress':'Not Started'; }
function customReview(e) {
  const latest=e.reviews?.at(-1), successful=e.reviews?.slice().reverse().find(item=>item.result), r=successful?.result;
  return `<section class="section"><h2>Review My Code</h2><p class="verification-note">AI Code Review — Advisory only. Implementation not automatically verified.</p>
    <label for="reviewContext">Review code from</label><select id="reviewContext"><option value="selection">Selected code</option><option value="file">Current file</option></select>
    <small>Choose relevant code in a saved workspace file. Review and approve the exact snapshot before sending. Up to 4,000 characters; no secrets or unrelated files.</small>
    ${button('Review My Code','customReview','class="wide secondary"')}
    <div class="review-output" role="status" aria-live="polite">${latest?.error?`<p class="notice">${esc(latest.error)}</p>`:''}${r?`<p class="muted">Latest completed advisory review · ${esc(successful.at)}</p><p>${esc(r.review_summary)}</p>
      <h3>Appears satisfied in the snippet</h3>${r.satisfied.length?bullets(r.satisfied):'<p class="muted">No criterion is established from this snippet.</p>'}
      <h3>Potential issues</h3>${r.potential_issues.length?bullets(r.potential_issues):'<p class="muted">No specific issue identified in this snippet.</p>'}
      <h3>Observed evidence</h3>${r.observations.length?`<ul>${r.observations.map(o=>`<li>${esc(o.observation)} <span class="muted">${esc(o.evidence)}</span></li>`).join('')}</ul>`:'<p class="muted">No grounded observation returned.</p>'}
      <h3>Cannot verify here</h3>${bullets(r.cannot_verify)}<h3>Next actions</h3>${bullets(r.next_actions)}`:latest?.error?'':'<p class="muted">No review requested yet. Select relevant code to receive advisory feedback.</p>'}</div></section>`;
}
function customMentoring(p) {
  const e=p.entries[p.current], hint=e.hints.at(-1), last=e.explanations.at(-1);
  return `<section class="section"><h2>Mentor</h2>${hints('customHint')}
    ${disclosure('custom-context','Code context · optional',`<label for="customContext">Include with this hint</label><select id="customContext"><option value="none">No code — milestone only</option><option value="selection">Selected code — review first</option><option value="file">Current file — review first</option></select><small>Review and approve every send. Up to 4,000 characters from one relevant file. No workspace scan; never include secrets. Source snapshots are not saved; hints are recorded.</small>`)}
    ${hintOutput(hint)}${!state.aiEnabled?'<small>Offline: scripted hints only. No code is sent.</small>':''}</section>
    ${customReview(e)}
    <section class="section"><h2>Explain it back</h2>${e.question?`<p>${esc(e.question.question)}</p>${disclosure('custom-rubric','Assessment rubric',bullets(e.question.rubric))}${e.reviewAttempts||e.explanationAttempts||e.hintsRequested?button('Refocus concept question','customQuestion','data-refresh="true" class="link"'):''}
      <label for="customExplanation">Your explanation</label><textarea id="customExplanation" maxlength="3000" aria-describedby="custom-explanation-help">${esc(drafts.customExplanations?.[customDraftKey()]??last?.text??'')}</textarea>
      <small id="custom-explanation-help">20–3,000 characters. Submit sends your explanation and milestone to the configured AI provider. Leave out secrets.</small>${button(last?'Retry explanation':'Submit explanation to AI','customExplain','class="wide secondary"')}`:
      `<p class="muted">Explain a concept from this milestone using a visible rubric.</p>${button('Prepare concept question','customQuestion','class="wide secondary"')}`}
    ${last?.assessment?`<p class="status ${last.assessment.passed?'pass':'fail'}">${last.assessment.passed?'AI conceptual rubric met':'Conceptual revision needed'}</p><p>${esc(last.assessment.feedback)}</p>${last.assessment.missing.length?`<h3>Revisit</h3>${bullets(last.assessment.missing)}`:''}`:last?.error?`<p class="notice">${esc(last.error)}</p>`:''}
    <small>AI feedback is not proof of implementation correctness or mastery.</small></section>
    <section class="section"><h2>Milestone progress</h2><p class="status" data-custom-status="${esc(customStatus(e))}">${esc(customStatus(e))}</p>
      ${disclosure('custom-self-report','Self-report completion',`<p>Review the provisional acceptance criteria before marking your own work complete. This does not verify implementation or conceptual understanding.</p>${bullets(p.milestones[p.current].acceptance_criteria)}<label class="check-label"><input id="criteriaReviewed" type="checkbox">I reviewed these proposed criteria</label>${button('Mark Self-Reported Complete','customComplete','class="wide secondary"')}`)}
      ${disclosure('custom-learning-record','Assistance & learning record',`<p data-assistance="${e.assisted?'assisted':'independent'}">${e.assisted?'Assisted learning':'Independent so far (no assistance recorded)'}</p><p>Hints: ${e.hintsRequested} · Reviews: ${e.reviewAttempts||0} · Explanation attempts: ${e.explanationAttempts}</p>${!e.assisted?button('I used outside solution help','customAssisted','class="secondary"'):''}<small>Hints and reported outside help are recorded. Custom recovery verification is unavailable.</small>`)}</section>`;
}
function customMilestone() {
  const p=state.roadmap;
  if (!p) return roadmap();
  const m=p.milestones[p.current];
  return `${heading(`${p.title} / ${p.current+1} of ${p.milestones.length}`,m.title)}
    ${disclosure('custom-navigation','Switch milestone',`<nav class="milestone-list" aria-label="Custom milestones">${p.milestones.map((x,i)=>button(`${i+1}. ${x.title}`,'customSelect',`data-index="${i}" class="secondary" ${i===p.current?'aria-current="step"':''}`)).join('')}</nav>`)}
    ${customDetails(m)}${customMentoring(p)}
    <nav class="actions section compact" aria-label="Milestone navigation">${p.current>0?button('Previous milestone','customSelect',`data-index="${p.current-1}" class="secondary"`):''}${p.current<p.milestones.length-1?button('Next milestone','customSelect',`data-index="${p.current+1}" class="secondary"`):''}</nav>
    <div class="actions">${button('Back to Roadmap','savedRoadmap','class="link"')}${button('Back to Projects','home','class="link"')}</div>`;
}
function customPassport() {
  const projects=state.custom?.projects||[];
  if (!projects.length) return '<section class="section"><h2>Custom projects</h2><p class="muted">No custom learning record yet. Start a roadmap from Home.</p></section>';
  return `<section class="section"><div class="section-label">Custom projects · implementation unverified</div>${projects.map(p=>`<article class="project-row"><h2>${esc(p.title)}</h2><p class="muted">Current milestone: ${p.current+1} of ${p.milestones.length}</p>${button('Resume custom project','customResume',`data-project-id="${esc(p.id)}" class="secondary"`)}
    ${p.milestones.map((m,i)=>{const e=p.entries[i], last=e.explanations.at(-1), review=e.reviews?.at(-1), completedReview=e.reviews?.slice().reverse().find(item=>item.result);return disclosure(`custom-evidence-${p.id}-${i}`,`${i+1}. ${m.title}`,`<dl class="evidence"><div><dt>Progress</dt><dd>${esc(customStatus(e))}</dd></div><div><dt>Assistance</dt><dd data-assistance="${e.assisted?'assisted':'independent'}">${e.assisted?'Assisted learning':'Independent so far (no assistance recorded)'}</dd></div><div><dt>Concepts</dt><dd>${last?.assessment?(last.assessment.passed?'AI rubric met':'Needs revision'):last?.error?'Assessment unavailable':'Not assessed'}</dd></div><div><dt>Hints</dt><dd>${e.hintsRequested} · highest level ${e.highestHintLevel}</dd></div><div><dt>Code review</dt><dd>${e.reviewAttempts||0} attempts · ${review?.error?'Latest attempt unavailable':completedReview?'Advisory feedback saved':'None yet'}</dd></div><div><dt>Explain-back</dt><dd>${e.explanationAttempts} attempts</dd></div></dl><p class="verification-note">Automated verification unavailable for this milestone.</p>${completedReview?`<p class="muted">Latest completed review: ${esc(completedReview.result.review_summary)}</p>`:''}<p class="next-step"><strong>Next:</strong> ${!e.startedAt?'Start the milestone.':!e.reviewAttempts?'Review relevant code or prepare a concept question.':!e.question?'Prepare a concept question.':!last?.assessment?.passed?'Revise your explanation against the rubric.':'Review your conceptual evidence or continue to the next milestone.'}</p>
    ${e.explanations.length?disclosure(`custom-history-${p.id}-${i}`,'Explain-back history (latest 20)',e.explanations.map(a=>`<p class="muted">${esc(a.at)} · ${a.assessment?(a.assessment.passed?'AI rubric met':'Needs revision'):'Assessment unavailable'}</p><blockquote>${esc(a.text)}</blockquote><p>${esc(a.assessment?.feedback||a.error)}</p>`).join('')):''}`);}).join('')}</article>`).join('')}</section>`;
}

// Keep presentation state through host updates; no learning or consent decisions live here.
let renderedView;
let pendingFocus;
const disclosureState = new Map();
const controlState = new Map();
const guidedReadiness = new Map();
const viewKey = () => `${state.screen}:${state.screen==='customMilestone'?customDraftKey():state.screen==='milestone'?state.selected:''}`;
function controlKey(el) {
  if (el.id) return `id:${el.id}`;
  if (el.matches('summary')) return `summary:${el.parentElement.dataset.disclosure}`;
  if (el.name) return `field:${el.name}:${el.value}`;
  if (el.dataset.action) return ['action',el.dataset.action,el.dataset.id,el.dataset.level,el.dataset.index,el.dataset.projectId,el.closest('nav')?.getAttribute('aria-label')].join(':');
}
function render() {
  const key=viewKey(), sameView=key===renderedView;
  const active=document.activeElement;
  const selection={start:active?.selectionStart,end:active?.selectionEnd,direction:active?.selectionDirection};
  const guidedEntry=state.screen==='milestone'?state.progress.milestones[state.selected]:undefined;
  const ready=!!(guidedEntry?.latestTests?.passed && guidedEntry.latestTests.sourceHash===guidedEntry.currentHash);
  const newlyReady=ready && guidedReadiness.get(state.selected)===false;
  if (renderedView) {
    disclosureState.set(renderedView,new Map([...app.querySelectorAll('details[data-disclosure]')].map(el=>[el.dataset.disclosure,el.open])));
    controlState.set(renderedView,new Map([...app.querySelectorAll('input,select,textarea')].map(el=>[controlKey(el),{value:el.value,checked:el.checked}])));
  }
  if (sameView && active && app.contains(active)) pendingFocus=controlKey(active)||pendingFocus;
  if (!sameView) pendingFocus=undefined;
  app.innerHTML=`<header class="app-header"><div class="identity"><div class="brand"><strong>CodeSense AI</strong><span>Build it. Understand it.</span></div><div class="availability" role="status" aria-live="polite" title="AI enabled is a setting, not a live connection check">${state.busy?'Working…':state.aiEnabled?'AI enabled':'Offline'}</div></div><nav class="app-nav" aria-label="Main navigation">${button('Home','home',state.screen==='home'?'aria-current="page"':'')}${button('Passport','passport',state.screen==='passport'?'aria-current="page"':'')}${button('Settings','settings','class="settings"')}</nav></header>
    <main aria-busy="${state.busy}">${state.notice?`<div class="notice" role="status">${esc(state.notice)}</div>`:''}${state.custom?.error?`<div class="notice">${esc(state.custom.error)}</div>`:''}${state.custom?.migrationWarning?`<div class="notice">${esc(state.custom.migrationWarning)}</div>`:''}${({home,milestone,passport,roadmap,customMilestone}[state.screen]||home)()}</main><footer>Learning records stay in this workspace.</footer>`;
  app.querySelectorAll('button').forEach(b=>b.disabled=state.busy);
  if (document.getElementById('difficulty')) document.getElementById('difficulty').value=drafts.difficulty||'beginner';
  for (const el of app.querySelectorAll('details[data-disclosure]')) {
    const stored=disclosureState.get(key)?.get(el.dataset.disclosure);
    if (el.dataset.disclosure==='guided-understanding' && newlyReady) el.open=true;
    else if (stored!==undefined) el.open=stored;
  }
  if (sameView) for (const el of app.querySelectorAll('input,select,textarea')) {
    const stored=controlState.get(key)?.get(controlKey(el));
    if (stored) { el.value=stored.value; if(typeof stored.checked==='boolean') el.checked=stored.checked; }
  }
  const target=pendingFocus && [...app.querySelectorAll('button,input,select,textarea,summary')].find(el=>controlKey(el)===pendingFocus);
  if (sameView && target && !target.disabled) {
    target.focus({preventScroll:true});
    if (typeof selection.start==='number' && target.setSelectionRange) target.setSelectionRange(selection.start,selection.end,selection.direction);
  } else if (renderedView && !sameView && !state.busy) app.querySelector('h1')?.focus();
  renderedView=key;
  if (guidedEntry) guidedReadiness.set(state.selected,ready);
}

app.addEventListener('input', e=> { if(e.target.id==='customExplanation') { drafts.customExplanations ||= {}; drafts.customExplanations[customDraftKey()]=e.target.value; vscode.setState(drafts); } else if(e.target.id && e.target.id!=='customContext') { drafts[e.target.id] = e.target.value; vscode.setState(drafts); } });
app.addEventListener('click', event=> {
  const el=event.target.closest('button[data-action]'); if(!el || state.busy) return;
  const action=el.dataset.action, id=el.dataset.id||state.selected;
  if(action==='roadmap') {
    const idea=document.getElementById('idea').value;
    if(idea.trim().length<8) { state.notice="CodeSense AI helps you build web interfaces. Please describe a website or web application you'd like to create."; render(); return; }
    return send(action,{idea,difficulty:document.getElementById('difficulty').value});
  }
  if(action==='customHint') return send(action,{level:Number(el.dataset.level),contextMode:document.getElementById('customContext').value});
  if(action==='customQuestion') return send(action,el.dataset.refresh?{refresh:true}:{});
  if(action==='customReview') return send(action,{contextMode:document.getElementById('reviewContext').value});
  if(action==='customComplete') {
    if(!document.getElementById('criteriaReviewed').checked) { state.notice='Review the proposed acceptance criteria before self-reporting completion.'; render(); return; }
    return send(action,{criteriaReviewed:true});
  }
  if(action==='customExplain') return send(action,{text:document.getElementById('customExplanation').value});
  if(action==='customSelect') return send(action,{index:Number(el.dataset.index)});
  if(action==='customOpen') return send(action,{projectId:el.dataset.projectId});
  if(action==='customResume') return send(action,{projectId:el.dataset.projectId});
  if(action==='file') return send(action,{file:el.dataset.file});
  if(action==='hint') return send(action,{id,level:Number(el.dataset.level),includeSelection:!!document.getElementById('selection')?.checked});
  if(action==='recovery') return send('tests',{id,recovery:true});
  if(action==='assess') {
    const answers=[0,1].map(i=>document.querySelector(`input[name="q${i}"]:checked`)?.value);
    if(answers.includes(undefined)) { state.notice='Choose an answer for both questions first.'; render(); return; }
    return send(action,{id,answers:answers.map(Number)});
  }
  if(action==='explain') return send(action,{id,text:document.getElementById('explanation').value});
  send(action,{id});
});
window.addEventListener('message',event=> { if(event.data.type==='state') { state=event.data; render(); } });
send('ready');
