const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const Module=require('node:module');
test('offline guided cycle through the real controller: fail, hint, pass, assess, reveal, recover, reload', {timeout:30000},async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'codesense-controller-'));
  let state,receiver,opened,stored={};
  const storage={get:key=>stored[key],update:async(key,value)=>{stored[key]=JSON.parse(JSON.stringify(value));await fs.writeFile(path.join(root,'progress.json'),JSON.stringify(stored));}};
  const disposable={dispose(){}};
  const uri=file=>({fsPath:file,scheme:'file',toString:()=>file});
  const vscode={
    Uri:{file:uri,joinPath:(base,...parts)=>uri(path.join(base.fsPath,...parts))},
    workspace:{isTrusted:true,workspaceFolders:[{uri:uri(root)}],textDocuments:[],
      getConfiguration:()=>({get:(key,fallback)=>key==='nodePath'?process.execPath:fallback}),
      onDidSaveTextDocument:()=>disposable,onDidChangeConfiguration:()=>disposable,
      createFileSystemWatcher:()=>({onDidChange(){},onDidDelete(){},onDidCreate(){},dispose(){}}),
      openTextDocument:async value=>value,
    },
    window:{showTextDocument:async value=>{opened=value;},showWarningMessage:async(message,opts,action)=>action},
    commands:{executeCommand:async()=>{}},
  };
  const oldLoad=Module._load;const oldFetch=global.fetch;
  Module._load=function(name,...args){return name==='vscode'?vscode:oldLoad.call(this,name,...args);};
  global.fetch=async()=>{throw new Error('Offline mode attempted a network call');};
  try{
    const {MentorPanel}=require('../dist/panels/MentorPanel.js');
    const extensionPath=path.resolve(__dirname,'..');
    const create=async()=>{
      const panel=new MentorPanel({workspaceState:storage,extensionPath,extensionUri:uri(extensionPath),subscriptions:[]});
      await panel.resolveWebviewView({webview:{asWebviewUri:u=>u.toString(),cspSource:'test-resource:',onDidReceiveMessage:fn=>{receiver=fn;},postMessage:s=>{state=s;}}});
      return panel;
    };
    await create();
    const act=async message=>{
      receiver(message);
      const until=Date.now()+12000;
      while(state.busy && Date.now()<until)await new Promise(r=>setTimeout(r,10));
      assert.equal(state.busy,false,'Controller operation finished');
    };
    await act({type:'start'});assert.equal(state.screen,'milestone');assert.match(opened.fsPath,/index.html$/);
    await act({type:'tests',id:'html-structure'});assert.equal(state.progress.milestones['html-structure'].latestTests.passed,false);
    await act({type:'hint',id:'html-structure',level:1});assert.equal(state.hint.source,'Offline scripted hint');
    const fixture=path.resolve(__dirname,'../../test-runner/fixtures/correct');
    const lab=path.join(root,'codesense-lab');
    await fs.copyFile(path.join(fixture,'index.html'),path.join(lab,'index.html'));
    await act({type:'tests',id:'html-structure'});assert.equal(state.classifications['html-structure'],'Implementation Verified');
    await act({type:'assess',id:'html-structure',answers:[0,1]});assert.equal(state.progress.milestones['html-structure'].explanation.passed,false);
    await act({type:'assess',id:'html-structure',answers:[1,0]});assert.equal(state.classifications['html-structure'],'Understanding Verified');
    await act({type:'select',id:'add-task'});
    await act({type:'reveal',id:'add-task'});assert.equal(state.classifications['add-task'],'Assisted');assert.match(opened.content,/addTask/);
    await fs.copyFile(path.join(fixture,'app.js'),path.join(lab,'app.js'));
    await act({type:'tests',id:'add-task'});assert.equal(state.progress.milestones['add-task'].latestTests.passed,true);
    await act({type:'assess',id:'add-task',answers:[1,2]});assert.equal(state.classifications['add-task'],'Assisted');
    await fs.appendFile(path.join(lab,'app.js'),"\ninput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addTask(); } });");
    await act({type:'tests',id:'add-task',recovery:true});assert.equal(state.classifications['add-task'],'Recovered Understanding');
    stored=JSON.parse(await fs.readFile(path.join(root,'progress.json'),'utf8'));
    await create();assert.equal(state.classifications['add-task'],'Recovered Understanding');
    await act({type:'roadmap',idea:'A book club registration page',difficulty:'beginner'});
    assert.match(state.notice,/Offline demo mode is active/);
  } finally {Module._load=oldLoad;global.fetch=oldFetch;}
});
