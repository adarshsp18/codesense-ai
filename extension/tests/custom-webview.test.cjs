const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const {ProgressStore}=require('../dist/services/ProgressStore.js');const {CustomProjectStore}=require('../dist/services/CustomProjectStore.js');
async function setup(){
  const saved={};const storage={get:k=>saved[k],update:async(k,v)=>{saved[k]=structuredClone(v);}};const custom=new CustomProjectStore(storage);
  await custom.add({title:'Custom <script>bad()</script>',milestones:Array.from({length:3},(_,i)=>({title:`Step ${i+1}`,goal:'<img src=x onerror=bad()>Build a semantic page',concepts:['HTML semantics'],expected_behaviors:['Meaningful headings'],steps:['Plan your structure'],acceptance_criteria:['Heading visible']}))});
  const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only'}),messages=[];let drafts;
  dom.window.acquireVsCodeApi=()=>({postMessage:m=>messages.push(m),getState:()=>drafts,setState:v=>{drafts=v;}});
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../media/mentor.js'),'utf8'));
  const state={type:'state',screen:'roadmap',roadmap:custom.active(),custom:custom.snapshot(),project:require('../../shared/guided-projects.json'),progress:new ProgressStore(storage).snapshot(),classifications:{},busy:false,aiEnabled:true};
  const render=()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:state}));render();return {dom,messages,state,render};
}
test('custom roadmap and milestone UI provide navigation and clearly provisional, unverified requirements',async()=>{
  const {dom,messages,state,render}=await setup(),d=dom.window.document;
  assert.equal(d.querySelectorAll('[data-action=customSelect]').length,3);assert.equal(d.querySelector('img'),null);assert.equal(d.querySelector('script'),null);
  d.querySelector('[data-action=customSelect][data-index="1"]').click();assert.equal(messages.at(-1).index,1);
  state.screen='customMilestone';state.roadmap.current=1;render();
  assert.match(d.body.textContent,/Expected behaviors/);assert.match(d.body.textContent,/Suggested steps/);assert.match(d.body.textContent,/provisional/);
  assert.match(d.body.textContent,/Automated verification unavailable for this milestone\./);
  assert.equal(d.querySelector('[data-action=tests]'),null);assert.equal(d.querySelector('[data-action=reveal]'),null);
  assert.match(d.body.textContent,/Previous milestone/);assert.match(d.body.textContent,/Next milestone/);
  d.getElementById('customContext').value='selection';d.querySelector('[data-action=customHint][data-level="2"]').click();
  assert.equal(messages.at(-1).contextMode,'selection');assert.equal(messages.at(-1).level,2);
  assert.equal(messages.at(-1).code,undefined);assert.equal(messages.at(-1).milestone,undefined,'Host supplies trusted active milestone');
  dom.window.close();
});
test('custom explanation drafts are separate per milestone; feedback and Passport never assert implementation verification',async()=>{
  const {dom,messages,state,render}=await setup(),d=dom.window.document;state.screen='customMilestone';
  for(const e of state.roadmap.entries)e.question={question:'Explain semantics in this milestone.',rubric:['Meaning','Goal connection','Prediction']};
  render();let input=d.getElementById('customExplanation');input.value='First explanation with meaningful reasoning.';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  state.roadmap.current=1;render();assert.equal(d.getElementById('customExplanation').value,'');
  input=d.getElementById('customExplanation');input.value='Second explanation with different reasoning.';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  state.roadmap.current=0;render();assert.equal(d.getElementById('customExplanation').value,'First explanation with meaningful reasoning.');
  d.querySelector('[data-action=customExplain]').click();assert.equal(messages.at(-1).text,'First explanation with meaningful reasoning.');
  const e=state.roadmap.entries[0];e.explanations=[{text:'Stored explanation',at:'2026-10-19',assessment:{passed:true,feedback:'<img src=x>Concept supported.',source:'AI rubric assessment',correct:['Meaning','Goal connection','Prediction'],missing:[]}}];e.explanationAttempts=1;render();
  assert.match(d.body.textContent,/AI conceptual rubric met/);assert.match(d.body.textContent,/not proof of implementation correctness/);assert.equal(d.querySelector('img'),null);
  state.custom.projects=[state.roadmap];state.screen='passport';render();assert.match(d.body.textContent,/Stored explanation/);assert.match(d.body.textContent,/Automated verification unavailable/);
  assert.doesNotMatch(d.body.textContent,/Implementation Verified/);d.querySelector('[data-action=customResume]').click();assert.equal(messages.at(-1).projectId,state.roadmap.id);
  dom.window.close();
});
test('custom review and self-report controls preserve advisory, provisional and escaped evidence',async()=>{
  const {dom,messages,state,render}=await setup(),d=dom.window.document;
  state.screen='customMilestone';state.roadmap.entries[0].startedAt='2026-10-20T00:00:00Z';render();
  assert.match(d.body.textContent,/AI Code Review — Advisory only\. Implementation not automatically verified\./);
  assert.equal(d.querySelector('[data-custom-status]').textContent,'In Progress');
  d.getElementById('reviewContext').value='file';d.querySelector('[data-action=customReview]').click();
  assert.equal(messages.at(-1).type,'customReview');assert.equal(messages.at(-1).contextMode,'file');
  d.querySelector('[data-disclosure=custom-self-report]').open=true;d.querySelector('[data-action=customComplete]').click();
  assert.notEqual(messages.at(-1).type,'customComplete');assert.match(d.body.textContent,/Review the proposed acceptance criteria/);
  d.getElementById('criteriaReviewed').checked=true;d.querySelector('[data-action=customComplete]').click();
  assert.equal(messages.at(-1).type,'customComplete');assert.equal(messages.at(-1).criteriaReviewed,true);
  const e=state.roadmap.entries[0];e.reviewAttempts=1;e.reviews=[{at:'2026-10-20T00:00:00Z',result:{review_summary:'<img src=x onerror=bad()> This snippet needs label review.',satisfied:[],potential_issues:['<img src=x onerror=bad()> Missing label'],observations:[],cannot_verify:['Other files unknown'],next_actions:['Inspect the input','Try manual behavior'],verification_status:'unverified'}}];e.selfReportedCompleteAt='2026-10-20T01:00:00Z';render();
  assert.equal(d.querySelector('[data-custom-status]').textContent,'Self-Reported Complete');assert.equal(d.querySelector('img'),null);assert.match(d.body.textContent,/Missing label/);
  e.question={question:'Explain the label relationship.',rubric:['Meaning','Goal connection','Prediction']};render();d.querySelector('[data-action=customQuestion][data-refresh=true]').click();assert.equal(messages.at(-1).refresh,true);
  state.custom.projects=[state.roadmap];state.screen='passport';render();assert.match(d.body.textContent,/Self-Reported Complete/);assert.match(d.body.textContent,/Advisory feedback saved/);assert.match(d.body.textContent,/Automated verification unavailable/);
  assert.doesNotMatch(d.body.textContent,/Implementation Verified/);dom.window.close();
});
