const test=require('node:test');
const assert=require('node:assert/strict');
const { ProgressStore, classification }=require('../dist/services/ProgressStore.js');
function memory() { let data={};return {get:k=>data[k],update:async(k,v)=>{data[k]=JSON.parse(JSON.stringify(v));}}; }
const result=(passed=true,kind='implementation',sourceHash='a')=>({milestoneId:'add-task',kind,validity:'verified',results:[],totalPassed:passed?10:0,totalFailed:passed?0:10,passed,sourceHash,at:new Date().toISOString()});
const assessment=passed=>({passed,source:'Offline guided rubric',correct:[],missing:[],feedback:'feedback',at:new Date().toISOString()});
test('code and understanding are independent and survive store reload',async()=>{
  const storage=memory();let store=new ProgressStore(storage);
  assert.equal(classification(store.entry('add-task')),'Not Started');
  await store.assess('add-task',assessment(true));
  assert.equal(classification(store.entry('add-task')),'In Progress');
  await store.recordTests('add-task',result());
  store=new ProgressStore(storage);
  assert.equal(classification(store.entry('add-task')),'Understanding Verified');
  await store.recordTests('add-task',result(false));
  assert.equal(classification(store.entry('add-task')),'In Progress');
  assert.equal(store.entry('add-task').explanation.passed,true);
});
test('reveal resets explain-back and requires both recovery and explanation',async()=>{
  const store=new ProgressStore(memory());
  await store.recordTests('add-task',result());await store.assess('add-task',assessment(true));
  await store.reveal('add-task');
  assert.equal(store.entry('add-task').explanation,undefined);
  assert.equal(classification(store.entry('add-task')),'Assisted');
  await store.recordTests('add-task',result(true,'recovery'));
  assert.equal(classification(store.entry('add-task')),'Assisted');
  await store.assess('add-task',assessment(true));
  assert.equal(classification(store.entry('add-task')),'Recovered Understanding');
  await store.syncHash('edited');
  assert.equal(classification(store.entry('add-task')),'Assisted');
  assert.equal(store.entry('add-task').recoveryStatus,'pending');
});
test('hints, highest level and attempts persist with bounded history',async()=>{
  const storage=memory();const store=new ProgressStore(storage);
  await store.hint('html-structure',3,'Detailed');await store.hint('html-structure',1,'Conceptual');
  for(let i=0;i<55;i++)await store.recordTests('html-structure',result(false));
  const entry=new ProgressStore(storage).entry('html-structure');
  assert.equal(entry.hintsRequested,2);assert.equal(entry.highestHintLevel,3);assert.equal(entry.testAttempts,55);assert.equal(entry.history.length,50);
});
test('changed source invalidates current code verification without deleting history',async()=>{
  const store=new ProgressStore(memory());await store.recordTests('add-task',result());
  assert.equal(classification(store.entry('add-task')),'Implementation Verified');
  await store.syncHash('b');assert.equal(classification(store.entry('add-task')),'In Progress');
  assert.equal(store.entry('add-task').history.length,1);
});
