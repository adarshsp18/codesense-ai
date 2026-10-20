// Stage a self-contained VSIX without changing the development dependency tree.
const fs=require('node:fs');const path=require('node:path');
const {createVSIX}=require('@vscode/vsce');
async function main(){
  const root=path.resolve(__dirname,'..');
  const stage=path.join(root,'.tools',`package-${Date.now()}`);
  fs.mkdirSync(stage,{recursive:true});
  for(const name of ['dist','media','runtime'])fs.cpSync(path.join(root,'extension',name),path.join(stage,name),{recursive:true});
  fs.copyFileSync(path.join(root,'extension/README.md'),path.join(stage,'README.md'));
  fs.copyFileSync(path.join(root,'LICENSE'),path.join(stage,'LICENSE'));
  const manifest=require('../extension/package.json');
  const {scripts,devDependencies,...release}=manifest;
  fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify(release,null,2));
  const lock=require('../package-lock.json');
  for(const [location,info] of Object.entries(lock.packages)){
    if(location.startsWith('node_modules/') && !info.dev && !info.link){
      fs.cpSync(path.join(root,location),path.join(stage,location),{recursive:true});
    }
  }
  fs.writeFileSync(path.join(stage,'.vscodeignore'),[
    '**/*.map',
    '**/*.ts',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/example/**',
    '**/examples/**',
    '**/coverage/**',
    '**/docs/**',
    '**/.github/**',
    '**/.vscode/**',
    '**/tsconfig*.json',
    'runtime/test-runner/fixtures/seeded-defects/**',
    '',
  ].join('\n'));
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
  const packagePath=path.join(root,'artifacts',`codesense-ai-${manifest.version}.vsix`);
  await createVSIX({cwd:stage,packagePath,dependencies:true,allowMissingRepository:true});
  console.log(`Installable extension: ${packagePath}`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
