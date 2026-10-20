const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const Module=require('node:module');
test('custom code context requires per-request review and excludes secrets, private files and outside paths',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'codesense-custom-context-'));
  const external=await fs.mkdtemp(path.join(os.tmpdir(),'codesense-custom-external-'));
  for(const name of ['app.js','.env','.env.js','credentials.js','large.js'])await fs.writeFile(path.join(root,name),'// test only');
  await fs.writeFile(path.join(external,'other.js'),'// external');
  let approved=false,dialogs=[],selection='const count = 1;',whole='const count = 1;\nconsole.log(count);';
  const editor={selection:{isEmpty:false},document:{uri:{scheme:'file',fsPath:path.join(root,'app.js')},getText:s=>s?selection:whole}};
  const vscode={workspace:{isTrusted:true,workspaceFolders:[{uri:{scheme:'file',fsPath:root}}]},window:{activeTextEditor:editor,showWarningMessage:async(message,options,action)=>{dialogs.push({message,options,action});return approved?action:undefined;}}};
  const old=Module._load;Module._load=function(name,...args){return name==='vscode'?vscode:old.call(this,name,...args);};
  try{
    const {approvedCode,possibleSecret}=require('../dist/services/CodeContext.js');
    assert.equal(await approvedCode('none'),'');assert.equal(dialogs.length,0);
    assert.equal(await approvedCode('selection'),undefined);assert.equal(dialogs[0].options.detail,selection);
    approved=true;assert.equal(await approvedCode('selection'),selection);assert.equal(await approvedCode('file'),whole);
    assert.equal(dialogs.length,3,'Each sharing request asks again');
    const before=dialogs.length;
    for(const sensitive of ['const api_key = "private";', 'AIza'+'x'.repeat(35), 'ghp_'+'x'.repeat(36), 'Authorization: Bearer '+'x'.repeat(24), 'GEMINI_API_KEY='+'x'.repeat(24), '-----BEGIN PRIVATE KEY-----', '{"password":"private"}', 'const token = "abc";']){
      selection=sensitive;assert.ok(possibleSecret(sensitive));await assert.rejects(approvedCode('selection'),/secret/);
    }
    selection='safe snippet';whole='x'.repeat(4001);await assert.rejects(approvedCode('file'),/4,000/);
    editor.selection.isEmpty=true;await assert.rejects(approvedCode('selection'),/Select/);editor.selection.isEmpty=false;
    for(const name of ['.env','.env.js','credentials.js']){
      editor.document.uri.fsPath=path.join(root,name);await assert.rejects(approvedCode('selection'),/excluded/);
    }
    editor.document.uri.fsPath=path.join(external,'other.js');await assert.rejects(approvedCode('selection'),/workspace/);
    const junction=path.join(root,'external-link');await fs.symlink(external,junction,'junction');
    editor.document.uri.fsPath=path.join(junction,'other.js');await assert.rejects(approvedCode('selection'),/workspace/);
    editor.document.uri.fsPath=path.join(root,'app.js');editor.document.uri.scheme='untitled';await assert.rejects(approvedCode('selection'),/saved/);
    editor.document.uri.scheme='file';vscode.workspace.isTrusted=false;await assert.rejects(approvedCode('selection'),/Trust/);
    assert.equal(dialogs.length,before,'Rejected data never reaches a send confirmation');
  }finally{Module._load=old;}
});
