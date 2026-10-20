const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Module=require('node:module');

test('guided code sharing blocks synthetic secrets, requires consent, and sends only approved code',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'codesense-guided-secret-'));
  const lab=path.join(root,'codesense-lab');
  await fs.mkdir(lab);
  await fs.writeFile(path.join(lab,'.codesense-lab.json'),JSON.stringify({project:'todo-v1'}));
  for(const file of ['index.html','app.js','style.css'])await fs.writeFile(path.join(lab,file),'// reviewed demo');
  let selection='const credential = "'+('AIza'+'A'.repeat(35))+'";';
  let approved=true,dialogs=[],calls=[],receiver,state;
  const uri=file=>({scheme:'file',fsPath:file,toString:()=>file});
  const editor={selection:{isEmpty:false},document:{uri:uri(path.join(lab,'app.js')),fileName:path.join(lab,'app.js'),getText:()=>selection}};
  const disposable={dispose(){}};
  const vscode={Uri:{file:uri,joinPath:(base,...parts)=>uri(path.join(base.fsPath,...parts))},
    workspace:{isTrusted:true,workspaceFolders:[{uri:uri(root)}],textDocuments:[],getConfiguration:()=>({get:(key,fallback)=>key==='aiEnabled'?true:fallback}),
      onDidSaveTextDocument:()=>disposable,onDidChangeConfiguration:()=>disposable,
      createFileSystemWatcher:()=>({onDidChange(){},onDidDelete(){},onDidCreate(){},dispose(){}})},
    window:{activeTextEditor:editor,showWarningMessage:async(message,options,action)=>{dialogs.push({message,options});return approved?action:undefined;}},
    commands:{executeCommand:async()=>{}}};
  const oldLoad=Module._load,oldFetch=global.fetch;
  Module._load=function(name,...args){return name==='vscode'?vscode:oldLoad.call(this,name,...args);};
  global.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({text:'Which behavior should change after the click?',source:'AI hint (validated)',level:1})};};
  try{
    const {MentorPanel}=require('../dist/panels/MentorPanel.js');
    const extensionPath=path.resolve(__dirname,'..');
    const panel=new MentorPanel({workspaceState:{get:()=>undefined,update:async()=>{}},extensionPath,extensionUri:uri(extensionPath),subscriptions:[]});
    await panel.resolveWebviewView({webview:{asWebviewUri:u=>u.toString(),cspSource:'test',onDidReceiveMessage:fn=>{receiver=fn;},postMessage:s=>{state=s;}}});
    const act=async()=>{receiver({type:'hint',id:'add-task',level:1,includeSelection:true});const deadline=Date.now()+5000;while(state.busy&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));assert.equal(state.busy,false);};
    await act();assert.match(state.notice,/secret/i);assert.equal(calls.length,0);assert.equal(dialogs.length,0);
    selection='const count = 1;';approved=false;
    await act();assert.equal(calls.length,0);assert.equal(dialogs.length,1);assert.equal(dialogs[0].options.detail,selection);
    approved=true;await act();assert.equal(calls.length,1);assert.equal(calls[0].body.code_context,selection);assert.equal(calls[0].body.context_consent,true);
  }finally{Module._load=oldLoad;global.fetch=oldFetch;}
});
