const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const Module=require('node:module');
test('custom controller: generate, start, consent, hint, explain, retry, archive and reload without guided changes',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'codesense-custom-controller-'));
  await fs.writeFile(path.join(root,'app.js'),'// learner owned file');
  const roadmap={title:'Book club',milestones:Array.from({length:3},(_,i)=>({title:`Step ${i+1}`,goal:'Make a readable page',concepts:['HTML semantics'],expected_behaviors:['Readable heading'],steps:['Plan the structure'],acceptance_criteria:['Title visible']}))};
  let state,receiver,stored={},enabled=true,approve=false,requests=[],opens=0,fail=false,pass=false;
  const storage={get:key=>stored[key],update:async(key,value)=>{stored[key]=structuredClone(value);}};
  const disposable={dispose(){}};const uri=file=>({scheme:'file',fsPath:file,toString:()=>file});
  const vscode={Uri:{file:uri,joinPath:(base,...parts)=>uri(path.join(base.fsPath,...parts))},
    workspace:{isTrusted:true,workspaceFolders:[{uri:uri(root)}],textDocuments:[],getConfiguration:()=>({get:(key,fallback)=>key==='aiEnabled'?enabled:fallback}),onDidSaveTextDocument:()=>disposable,onDidChangeConfiguration:()=>disposable,
      createFileSystemWatcher:()=>({onDidChange(){},onDidDelete(){},onDidCreate(){},dispose(){}}),openTextDocument:async x=>{opens++;return x;}},
    window:{activeTextEditor:{selection:{isEmpty:false},document:{uri:uri(path.join(root,'app.js')),getText:()=>'<h1>Book club</h1>'}},showTextDocument:async()=>{},showWarningMessage:async(msg,opts,action)=>approve?action:undefined},commands:{executeCommand:async()=>{}}};
  const oldLoad=Module._load,oldFetch=global.fetch;
  Module._load=function(name,...args){return name==='vscode'?vscode:oldLoad.call(this,name,...args);};
  global.fetch=async(url,opts)=>{
    const route=url.pathname,body=JSON.parse(opts.body);requests.push({route,body});
    if(fail)return {ok:false,json:async()=>({error:{message:'Rate limit. Retry later.'}})};
    let response;
    if(route==='/roadmap/generate')response=roadmap;
    else if(route==='/mentor/hint')response={text:'Which meaning does the heading communicate to a reader?',source:'AI hint (validated)',level:body.level};
    else if(route==='/learning/question')response={question:'Explain HTML semantics and predict a concrete outcome.',rubric:['Meaning','Connection to goal','Causal prediction']};
    else if(route==='/learning/evaluate')response={passed:pass,source:'AI rubric assessment',correct:pass?['Meaning','Connection to goal','Causal prediction']:[],missing:pass?[]:['Meaning','Connection to goal','Causal prediction'],feedback:pass?'Concepts supported; implementation not verified.':'Explain why the outcome follows.'};
    else throw new Error('Unexpected route');
    return {ok:true,json:async()=>structuredClone(response)};
  };
  try{
    const {MentorPanel}=require('../dist/panels/MentorPanel.js');
    const {ProgressStore}=require('../dist/services/ProgressStore.js');
    const guided=new ProgressStore(storage);await guided.hint('add-task',1,'Existing guided history');
    const create=async()=>{const extensionPath=path.resolve(__dirname,'..');const panel=new MentorPanel({workspaceState:storage,extensionPath,extensionUri:uri(extensionPath),subscriptions:[]});await panel.resolveWebviewView({webview:{asWebviewUri:u=>u.toString(),cspSource:'test',onDidReceiveMessage:fn=>{receiver=fn;},postMessage:s=>{state=s;}}});};
    const act=async m=>{receiver(m);const deadline=Date.now()+5000;while(state.busy&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));assert.equal(state.busy,false);};
    await create();await act({type:'roadmap',idea:'A book club web page',difficulty:'beginner'});assert.equal(state.screen,'roadmap');
    const firstId=state.roadmap.id;await act({type:'customSelect',index:1});assert.equal(state.screen,'customMilestone');assert.equal(state.roadmap.current,1);assert.equal(opens,0);
    await create();await act({type:'customResume'});assert.equal(state.roadmap.current,1);
    await act({type:'customHint',level:1,contextMode:'none'});assert.equal(requests.at(-1).body.code_context,'');assert.deepEqual(requests.at(-1).body.milestone,roadmap.milestones[1]);
    const count=requests.length;await act({type:'customHint',level:2,contextMode:'selection'});assert.equal(requests.length,count);assert.match(state.notice,/cancelled/);
    approve=true;await act({type:'customHint',level:2,contextMode:'file'});assert.equal(requests.at(-1).body.code_context,'<h1>Book club</h1>');assert.equal(requests.at(-1).body.context_consent,true);
    assert.equal(JSON.stringify(stored).includes('<h1>Book club</h1>'),false,'Raw code is not persisted');
    await act({type:'customQuestion'});assert.equal(state.roadmap.entries[1].question.rubric.length,3);
    const explanation='A heading communicates the topic and gives the document meaningful structure.';
    await act({type:'customExplain',text:explanation});assert.equal(state.roadmap.entries[1].explanations.at(-1).assessment.passed,false);
    pass=true;await act({type:'customExplain',text:explanation});assert.equal(state.roadmap.entries[1].explanations.at(-1).assessment.passed,true);
    fail=true;await act({type:'customExplain',text:explanation});assert.equal(state.roadmap.entries[1].explanations.at(-1).assessment,undefined);assert.match(state.notice,/No conceptual pass/);
    await act({type:'customHint',level:1,contextMode:'none'});assert.match(state.roadmap.entries[1].hints.at(-1).source,/fallback/);
    assert.equal(state.roadmap.entries[1].explanationAttempts,3);assert.equal(state.roadmap.entries[1].assisted,true);
    const before=structuredClone(stored);await act({type:'roadmap',idea:'A second learning project',difficulty:'beginner'});assert.deepEqual(stored,before,'Failed generation preserves saved projects');
    fail=false;await act({type:'roadmap',idea:'A second learning project',difficulty:'beginner'});assert.equal(state.custom.projects.length,2);
    await create();await act({type:'customResume',projectId:firstId});assert.equal(state.roadmap.entries[1].explanationAttempts,3);
    await act({type:'customSelect',index:0});assert.equal(state.roadmap.entries[0].hintsRequested,0);assert.equal(state.roadmap.entries[0].assisted,false);
    await act({type:'customAssisted'});assert.equal(state.roadmap.entries[0].assisted,true);
    enabled=false;const offlineCount=requests.length;await act({type:'customHint',level:1,contextMode:'file'});assert.equal(requests.length,offlineCount);assert.equal(state.roadmap.entries[0].hints.at(-1).source,'Offline scripted hint');
    assert.equal(stored['codesense.passport.v1'].milestones['add-task'].hintsRequested,1);assert.deepEqual(stored['codesense.passport.v1'].milestones['add-task'].hints,['Existing guided history']);
    assert.equal(await fs.readFile(path.join(root,'app.js'),'utf8'),'// learner owned file');assert.equal(opens,0);
    assert.equal(JSON.stringify(state.custom).includes('Implementation Verified'),false);
  }finally{Module._load=oldLoad;global.fetch=oldFetch;}
});
