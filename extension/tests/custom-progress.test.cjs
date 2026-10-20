const test=require('node:test');const assert=require('node:assert/strict');
const {CustomProjectStore,CUSTOM_KEY,parseRoadmap}=require('../dist/services/CustomProjectStore.js');
const {validateMessage}=require('../dist/services/messages.js');
const roadmap=()=>({title:'Book club',milestones:Array.from({length:3},(_,i)=>({title:`Step ${i+1}`,goal:'Build a readable page',concepts:['HTML semantics'],expected_behaviors:['Readable title'],steps:['Plan the structure'],acceptance_criteria:['Title is visible']}))});
const storage=initial=>{const data=structuredClone(initial||{});return {data,get:k=>data[k],update:async(k,v)=>{data[k]=structuredClone(v);}};};
test('custom navigation persists, resumes, archives roadmaps and preserves guided records',async()=>{
  const saved=storage({'codesense.passport.v1':{untouched:true}});let store=new CustomProjectStore(saved);
  await store.add(roadmap());await store.select(2);const first=store.active().id;
  store=new CustomProjectStore(saved);assert.equal(store.active().current,2);assert.ok(store.active().entries[2].startedAt);
  await store.add({...roadmap(),title:'Second project'});assert.equal(store.snapshot().projects.length,2);
  await store.resume(first);assert.equal(store.active().current,2);assert.equal(store.active().title,'Book club');
  assert.deepEqual(saved.data['codesense.passport.v1'],{untouched:true});
  await assert.rejects(store.select(9),/not found/);await assert.rejects(store.resume('unknown'),/Generate/);
  assert.equal(store.active().current,2);
});
test('legacy roadmap migrates without overwriting its original or creating files',async()=>{
  const old=roadmap(), saved=storage({'codesense.roadmap':old});const store=new CustomProjectStore(saved);
  assert.equal(store.active().title,old.title);await store.resume();assert.ok(saved.data[CUSTOM_KEY]);
  assert.deepEqual(saved.data['codesense.roadmap'],old);assert.equal(new CustomProjectStore(saved).snapshot().projects.length,1);
});
test('custom save failures leave in-memory state unchanged and invalid model output is rejected',async()=>{
  const saved=storage();const store=new CustomProjectStore(saved);await store.add(roadmap());
  saved.update=async()=>{throw new Error('storage full');};await assert.rejects(store.select(1),/storage full/);assert.equal(store.active().current,0);
  assert.throws(()=>parseRoadmap({title:'bad',milestones:[]}));assert.throws(()=>parseRoadmap({...roadmap(),milestones:[...roadmap().milestones.slice(1),null]}));
  const r=roadmap();r.milestones[0].verified=true;assert.equal(parseRoadmap(r).milestones[0].verified,undefined);
});
test('custom messages constrain indexes, levels, consent mode and explanation length',()=>{
  for(const value of [{type:'customSelect',index:-1},{type:'customSelect',index:5},{type:'customHint',level:1,contextMode:'allFiles'},{type:'customHint',level:4,contextMode:'file'},{type:'customExplain',text:'short'},{type:'customResume',projectId:'../x'}])assert.equal(validateMessage(value),undefined);
  assert.deepEqual(validateMessage({type:'customSelect',index:1,code:'ignored'}),{type:'customSelect',index:1});
});
test('custom histories are bounded and assisted status persists independently of concept results',async()=>{
  const saved=storage(),store=new CustomProjectStore(saved);await store.add(roadmap());await store.resume();
  for(let i=0;i<12;i++)await store.hint(1,{text:'Which concept explains this outcome?',source:'Offline scripted hint'});
  for(let i=0;i<22;i++)await store.explanation('A meaningful explanation of the concept.',undefined,'Assessment unavailable');
  const e=new CustomProjectStore(saved).active().entries[0];assert.equal(e.hintsRequested,12);assert.equal(e.hints.length,10);assert.equal(e.explanationAttempts,22);assert.equal(e.explanations.length,20);assert.equal(e.assisted,true);
  assert.equal(e.latestTests,undefined);assert.equal(e.explanations.at(-1).assessment,undefined);
});
test('damaged custom storage is retained and cannot disable or overwrite guided progress',async()=>{
  const damaged={schemaVersion:1,projects:[{bad:true}]},saved=storage({[CUSTOM_KEY]:damaged,'codesense.passport.v1':{untouched:true}});
  const store=new CustomProjectStore(saved);assert.match(store.snapshot().error,/preserved/);await assert.rejects(store.add(roadmap()),/preserved/);
  assert.deepEqual(saved.data[CUSTOM_KEY],damaged);assert.deepEqual(saved.data['codesense.passport.v1'],{untouched:true});
});
