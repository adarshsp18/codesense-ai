// Extract outside the repo to verify the VSIX does not borrow workspace dependencies.
const fs=require('node:fs');const fsp=fs.promises;const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');const yauzl=require('yauzl');
async function main(){
  const target=await fsp.mkdtemp(path.join(os.tmpdir(),'codesense-vsix-'));
  const archive=path.resolve(__dirname,'../artifacts/codesense-ai-0.1.0.vsix');
  await new Promise((resolve,reject)=>yauzl.open(archive,{lazyEntries:true},(err,zip)=>{
    if(err)return reject(err);
    zip.on('error',reject);zip.on('end',resolve);
    zip.on('entry',entry=>{
      const output=path.resolve(target,entry.fileName);
      if(!output.startsWith(target+path.sep))return reject(new Error('Unexpected archive path.'));
      if(entry.fileName.endsWith('/')){fs.mkdirSync(output,{recursive:true});return zip.readEntry();}
      fs.mkdirSync(path.dirname(output),{recursive:true});
      zip.openReadStream(entry,(error,stream)=>{
        if(error)return reject(error);const writer=fs.createWriteStream(output);writer.on('error',reject);writer.on('finish',()=>zip.readEntry());stream.on('error',reject);stream.pipe(writer);
      });
    });zip.readEntry();
  }));
  const extension=path.join(target,'extension');
  assert.ok(fs.existsSync(path.join(extension,'dist/extension.js')));
  const {execute}=require(path.join(extension,'runtime/test-runner/src/process.cjs'));
  const fixture=path.join(extension,'runtime/test-runner/fixtures/correct');
  const source={html:fs.readFileSync(path.join(fixture,'index.html'),'utf8'),js:fs.readFileSync(path.join(fixture,'app.js'),'utf8'),css:''};
  assert.equal((await execute(source,'add-task')).passed,true);
  console.log('VSIX verified: manifest, compiled entry point, curriculum, fixtures and runtime dependencies work outside the repository.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
