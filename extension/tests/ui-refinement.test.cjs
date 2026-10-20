const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {JSDOM}=require('jsdom');const {getByRole,getByLabelText}=require('@testing-library/dom');
const {ProgressStore}=require('../dist/services/ProgressStore.js');const project=require('../../shared/guided-projects.json');
function setup(){
  const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only'}),messages=[];
  dom.window.acquireVsCodeApi=()=>({postMessage:m=>messages.push(m),getState:()=>undefined,setState:()=>{}});
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../media/mentor.js'),'utf8'));
  const state={type:'state',screen:'home',selected:'html-structure',project,progress:new ProgressStore({get:()=>undefined,update:async()=>{}}).snapshot(),classifications:{'html-structure':'Not Started','add-task':'Not Started'},busy:false,notice:'',aiEnabled:true};
  const render=()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:state}));render();return {dom,d:dom.window.document,messages,state,render};
}
const result=(passed,hash='current')=>({passed,sourceHash:hash,totalPassed:passed?2:1,totalFailed:passed?0:1,results:[{id:'label',name:'Task input has a label',passed,message:'Name the input so readers can identify it.'},{id:'list',name:'Task list exists',passed:true,message:'Found the list.'}]});
test('Home puts one labelled project form first, followed by resume and guided actions',()=>{
  const {dom,d,state,render,messages}=setup();
  state.roadmap={title:'Book club',current:1,milestones:[{},{},{}]};render();
  assert.equal(getByRole(d.body,'heading',{level:1}).textContent,'What would you like to build?');
  const input=getByLabelText(d.body,'Your web project idea');input.value='An accessible event page';
  const select=getByLabelText(d.body,'Learning level');select.value='intermediate';
  assert.equal(d.querySelector('main button').dataset.action,'roadmap');
  assert.equal(d.querySelectorAll('[data-action=roadmap]').length,1);
  getByRole(d.body,'button',{name:'Generate roadmap'}).click();assert.equal(messages.at(-1).idea,input.value);assert.equal(messages.at(-1).difficulty,'intermediate');
  assert.ok(d.querySelector('[data-action=customResume]'));assert.ok(d.querySelector('[data-action=start]'));
  assert.equal(d.querySelector('.hero'),null);assert.equal(d.querySelector('.mark'),null);dom.window.close();
});
test('Guided diagnostics put failures first and keep passed checks under disclosure',()=>{
  const {dom,d,state,render}=setup();state.screen='milestone';const e=state.progress.milestones['html-structure'];e.currentHash='current';e.latestTests=result(false);render();
  assert.match(d.querySelector('.diagnostics').textContent,/Name the input/);
  assert.match(d.querySelector('.diagnostics>.test').textContent,/FAIL.*Task input/s);
  assert.equal(d.querySelector('[data-disclosure=checks-passed]').open,false);
  assert.equal(d.querySelector('[data-disclosure=guided-reference]').open,false);
  assert.equal(d.querySelectorAll('.hint-actions button').length,3);
  assert.equal(d.querySelector('[aria-current=step]').dataset.id,'html-structure');dom.window.close();
});
test('Disclosures, context checkbox and keyboard focus survive a busy hint round trip',()=>{
  const {dom,d,state,render}=setup();state.screen='milestone';render();
  d.querySelector('[data-disclosure=guided-context]').open=true;d.getElementById('selection').checked=true;
  const button=d.querySelector('[data-action=hint][data-level="2"]');button.focus();
  state.busy=true;render();assert.equal(d.querySelector('[data-disclosure=guided-context]').open,true);assert.equal(d.getElementById('selection').checked,true);
  state.busy=false;state.hint={level:2,source:'AI hint (validated)',text:'Which meaning should a reader infer from this element?'};render();
  assert.equal(d.activeElement.dataset.action,'hint');assert.equal(d.activeElement.dataset.level,'2');
  assert.equal(d.getElementById('selection').checked,true);assert.equal(d.querySelector('[data-disclosure=guided-context]').open,true);
  assert.equal(d.querySelector('.mentor-output').getAttribute('aria-live'),'polite');dom.window.close();
});
test('Text selection survives updates and navigating does not carry a disclosure to another milestone',()=>{
  const {dom,d,state,render}=setup();const input=d.getElementById('idea');input.value='A learner project';input.focus();input.setSelectionRange(2,9);state.notice='Configuration changed';render();
  assert.equal(d.activeElement.id,'idea');assert.equal(d.activeElement.selectionStart,2);assert.equal(d.activeElement.selectionEnd,9);assert.equal(d.activeElement.value,'A learner project');
  state.screen='milestone';render();d.querySelector('[data-disclosure=guided-reference]').open=true;
  state.selected='add-task';render();assert.equal(d.querySelector('[data-disclosure=guided-reference]').open,false);
  assert.equal(d.activeElement.tagName,'H1');dom.window.close();
});
test('A new current code pass opens explain-back once, while the learner can collapse it afterward',()=>{
  const {dom,d,state,render}=setup();state.screen='milestone';const e=state.progress.milestones['html-structure'];e.currentHash='current';render();
  assert.equal(d.querySelector('[data-disclosure=guided-understanding]').open,false);
  e.latestTests=result(true);render();assert.equal(d.querySelector('[data-disclosure=guided-understanding]').open,true);
  d.querySelector('[data-disclosure=guided-understanding]').open=false;state.notice='Saved';render();assert.equal(d.querySelector('[data-disclosure=guided-understanding]').open,false);dom.window.close();
});
test('Passport distinguishes current evidence, assistance and stale verification without invented scores',()=>{
  const {dom,d,state,render}=setup();state.screen='passport';const e=state.progress.milestones['html-structure'];e.currentHash='current';e.latestTests=result(true);e.explanation={passed:true,source:'Offline guided rubric',feedback:'Both concepts supported',missing:[],correct:[]};render();
  assert.match(d.body.textContent,/Independent completion \(no assistance recorded\)/);
  e.hintsRequested=2;render();assert.match(d.body.textContent,/Assisted completion \(hints used\)/);
  e.currentHash='changed';render();assert.match(d.body.textContent,/Needs a passing current check/);assert.doesNotMatch(d.body.textContent,/Assisted completion/);
  assert.match(d.body.textContent,/Save your work and run/);assert.equal(d.querySelector('canvas'),null);dom.window.close();
});
