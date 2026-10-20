const test=require('node:test');const assert=require('node:assert/strict');
const {validateMessage}=require('../dist/services/messages.js');
test('rejects untrusted webview actions and malformed payloads',()=>{
  for(const value of [null,[],{}, {type:'shell',command:'anything'}, {type:'tests',id:'arbitrary'}, {type:'hint',id:'add-task',level:4}, {type:'file',file:'../.env'}, {type:'assess',id:'add-task',answers:[1]}, {type:'roadmap',idea:'tiny',difficulty:'beginner'}, {type:'explain',id:'add-task',text:'x'.repeat(3001)}]) assert.equal(validateMessage(value),undefined,JSON.stringify(value));
});
test('accepted messages are reconstructed and extra properties removed',()=>{
  assert.deepEqual(validateMessage({type:'tests',id:'add-task',shell:'bad'}),{type:'tests',id:'add-task',recovery:false});
  assert.deepEqual(validateMessage({type:'hint',id:'add-task',level:2,includeSelection:true}),{type:'hint',id:'add-task',level:2,includeSelection:true});
});
