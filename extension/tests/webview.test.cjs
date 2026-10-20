const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {JSDOM}=require('jsdom');
const project=require('../../shared/guided-projects.json');
const {ProgressStore}=require('../dist/services/ProgressStore.js');
function setup(){
  const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only'});const messages=[];
  dom.window.acquireVsCodeApi=()=>({postMessage:m=>messages.push(m),getState:()=>undefined,setState:()=>{}});
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../media/mentor.js'),'utf8'));
  const state={type:'state',screen:'home',selected:'html-structure',project,progress:new ProgressStore({get:()=>undefined,update:async()=>{}}).snapshot(),classifications:{'html-structure':'Not Started','add-task':'Not Started'},busy:false,notice:'',aiEnabled:false};
  const render=()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:state}));render();return {dom,messages,state,render};
}
test('offline home has functional start action and clear custom limitation',()=>{
  const {dom,messages}=setup();const d=dom.window.document;
  assert.match(d.body.textContent,/requires? AI configuration/);d.querySelector('[data-action=start]').click();
  assert.equal(messages.at(-1).type,'start');dom.window.close();
});
test('milestone interactions send typed messages and escape injected hint HTML',()=>{
  const {dom,messages,state,render}=setup();state.screen='milestone';state.hint={text:'<img src=x onerror=alert(1)>',source:'test',level:1};render();const d=dom.window.document;
  assert.equal(d.querySelector('img'),null);
  d.querySelector('[data-action=tests]').click();assert.equal(messages.at(-1).type,'tests');
  d.querySelector('[data-action=hint][data-level="2"]').click();assert.equal(messages.at(-1).level,2);
  d.querySelector('[name=q0][value="1"]').checked=true;d.querySelector('[name=q1][value="0"]').checked=true;d.querySelector('[data-action=assess]').click();
  assert.deepEqual(Array.from(messages.at(-1).answers),[1,0]);dom.window.close();
});
test('loading disables actions; passport shows actual counters',()=>{
  const {dom,state,render}=setup();state.busy=true;render();assert.ok([...dom.window.document.querySelectorAll('button')].every(b=>b.disabled));
  state.busy=false;state.screen='passport';state.progress.milestones['add-task'].testAttempts=7;render();assert.match(dom.window.document.body.textContent,/7TEST ATTEMPTS/);dom.window.close();
});
test('manifest commands match registrations and CSP has no network access',()=>{
  const manifest=require('../package.json');const ext=fs.readFileSync(path.join(__dirname,'../src/extension.ts'),'utf8');
  for(const c of manifest.contributes.commands)assert.ok(ext.includes(`'${c.command}'`));
  const panel=fs.readFileSync(path.join(__dirname,'../src/panels/MentorPanel.ts'),'utf8');
  assert.match(panel,/default-src 'none'/);assert.match(panel,/connect-src 'none'/);assert.match(panel,/script-src 'nonce-/);assert.doesNotMatch(panel,/unsafe-inline/);
});
