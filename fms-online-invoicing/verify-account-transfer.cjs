// 主体转移的实际 UI 事件、暂存和模型边界检查；不连接外部服务。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},localStorage:{getItem:()=>null,setItem(){}},console};vm.createContext(context);
for(const file of ['catalog.js','state.js','online-state.js','revision-state.js','account-ui.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
const F=context.window.FMS;require('./verify-ready.cjs')(F);let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
function view(select2=false){
  const s=F.initial(),nodes=new Map(),ui={},v={s,ui,persisted:0,rendered:0,closed:0};
  function node(id){if(!nodes.has(id))nodes.set(id,{id,value:'',checked:false,innerHTML:'',open:false,hidden:false,listeners:{},showModal(){this.open=true;},close(){this.open=false;},addEventListener(type,fn){this.listeners[type]=fn;}});return nodes.get(id);}
  const select=node('clerk-subjects');select.options=[];
  Object.defineProperties(select,{innerHTML:{get(){return this.html||'';},set(html){this.html=html;this.options=Array.from(html.matchAll(/<option value="([^"]+)"([^>]*)>([^<]*)<\/option>/g),m=>({value:m[1],selected:/\bselected\b/.test(m[2]),disabled:/\bdisabled\b/.test(m[2])}));}},selectedOptions:{get(){return this.options.filter(o=>o.selected);}}});
  if(select2){const wrapper={select2(){return this;},on(type,fn){select.listeners[type]=fn;return this;},trigger(type){if(type==='change')select.listeners['change.fmsClerkSubjects']?.();return this;}};context.window.jQuery=()=>wrapper;context.window.jQuery.fn={select2(){}};}else delete context.window.jQuery;
  v.api=context.window.FMSAccountUI.create({F,ui,getState:()=>s,esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),$:node,btn:()=>'',link:()=>'',tag:x=>x,table:()=>'',options:()=>'',
    openModal(title,body){v.body=body;node('modal').open=true;select.innerHTML=body.match(/<select[^>]*id="clerk-subjects"[^>]*>([^]*?)<\/select>/)[1];const a=s.accounts.find(a=>a.id===ui.accountEditId);node('clerk-user').value=a?.userId||'';node('clerk-tax-account').value=F.taxAccount(a);node('clerk-active').checked=a?.active!==false;},
    closeModal(){v.closed++;node('modal').close();ui.modalKind='';},render(){v.rendered++;},persist(){v.persisted++;},toast(){}});
  v.node=node;v.edit=id=>v.api.act('clerk-account-edit',id||'A01');
  v.select=(id,selected=true)=>{select.options.find(o=>o.value===id).selected=selected;if(select2)select.listeners['change.fmsClerkSubjects']();else v.api.change(select);};
  v.confirm=()=>v.api.act('clerk-transfer-confirm');v.cancel=()=>v.api.act('clerk-transfer-cancel');v.save=()=>v.api.act('clerk-account-save',ui.accountEditId);v.selected=()=>select.selectedOptions.map(o=>o.value);return v;
}
check('选择已占用主体即提示原／新开票员，取消及 Escape 均不改关联',()=>{
  const v=view();v.edit();const before=JSON.stringify(v.s);v.select('103');assert.equal(v.node('subject-transfer-modal').open,true);assert.match(v.node('subject-transfer-body').innerHTML,/海南.*财务乙.*占旭婷/);assert.equal(JSON.stringify(v.s),before);assert.ok(!v.selected().includes('103'));v.cancel();assert.equal(v.node('subject-transfer-modal').open,false);assert.equal(JSON.stringify(v.s),before);v.select('103');let prevented=false;v.node('subject-transfer-modal').listeners.cancel({preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(v.node('subject-transfer-modal').open,false);assert.equal(JSON.stringify(v.s),before);assert.equal(v.persisted,0);
});
check('Select2 选择事件能触发确认，确认仅暂存，保存才从原开票员转入',()=>{
  const v=view(true);v.edit();const before=JSON.stringify(v.s),history=JSON.stringify(v.s.records),auth=JSON.stringify(v.s.accountSessions),rights=JSON.stringify(v.s.accounts.map(a=>a.subjects));v.select('103');assert.equal(v.node('subject-transfer-modal').open,true);v.confirm();assert.ok(v.selected().includes('103'));assert.equal(JSON.stringify(v.s),before);assert.equal(v.persisted,0);v.save();assert.equal(F.subject(v.s,'103').clerkUserId,'U01');assert.equal(F.userSubjects(v.s,'U02').length,0);assert.equal(F.userSubjects(v.s,'U01').length,3);assert.equal(v.persisted,1);assert.equal(v.rendered,1);assert.equal(JSON.stringify(v.s.records),history);assert.equal(JSON.stringify(v.s.accountSessions),auth);assert.equal(JSON.stringify(v.s.accounts.map(a=>a.subjects)),rights);
});
check('确认后取消编辑或重新打开编辑，不保留转移授权及选择',()=>{
  const v=view();v.edit();const before=JSON.stringify(v.s);v.select('103');v.confirm();v.api.act('close');assert.equal(JSON.stringify(v.s),before);v.edit();assert.ok(!v.selected().includes('103'));v.select('103');assert.equal(v.node('subject-transfer-modal').open,true);assert.equal(v.persisted,0);
});
check('确认后取消勾选不转移，重新勾选必须再次确认',()=>{
  const v=view();v.edit();v.select('103');v.confirm();v.select('103',false);v.save();assert.equal(F.subject(v.s,'103').clerkUserId,'U02');v.edit();v.select('103');assert.equal(v.node('subject-transfer-modal').open,true);
});
check('表单校验失败不解除原关联，修正后可一次保存',()=>{
  const v=view();v.edit();v.select('103');v.confirm();const before=JSON.stringify(v.s);v.node('clerk-tax-account').value='';assert.throws(v.save,/填写税局账号/);assert.equal(JSON.stringify(v.s),before);assert.equal(v.persisted,0);v.node('clerk-tax-account').value='13800138000';v.save();assert.equal(F.subject(v.s,'103').clerkUserId,'U01');
});
check('保存时原关联已改变，旧确认失效且整单不写入，重新选择提示新开票员',()=>{
  const v=view();v.edit();v.select('103');v.confirm();F.subject(v.s,'103').clerkUserId='U03';const before=JSON.stringify(v.s);assert.throws(v.save,/财务丙.*重新选择/);assert.equal(JSON.stringify(v.s),before);v.select('103',false);v.select('103');assert.match(v.node('subject-transfer-body').innerHTML,/财务丙/);v.confirm();v.save();assert.equal(F.subject(v.s,'103').clerkUserId,'U01');
});
check('确认弹窗中原开票员变化，点击确认会按新关系重新提示',()=>{
  const v=view();v.edit();v.select('103');F.subject(v.s,'103').clerkUserId='U03';v.confirm();assert.equal(v.node('subject-transfer-modal').open,true);assert.match(v.node('subject-transfer-body').innerHTML,/财务丙/);assert.ok(!v.selected().includes('103'));v.cancel();assert.equal(F.subject(v.s,'103').clerkUserId,'U03');
});
check('未处理确认弹窗时不能保存，不会丢弃原关联',()=>{
  const v=view();v.edit();v.select('103');assert.throws(v.save,/先确认或取消/);assert.equal(F.subject(v.s,'103').clerkUserId,'U02');v.cancel();v.save();assert.equal(F.subject(v.s,'103').clerkUserId,'U02');
});
check('更换目标开票员需重新确认，旧授权不能用于另一开票员',()=>{
  const s=F.initial(),before=JSON.stringify(s);assert.throws(()=>F.saveClerkAccount(s,'',{userId:'U03',taxUserName:'13600136000',active:true,subjectIds:['103'],transferConfirmations:[{subjectId:'103',fromUserId:'U02',toUserId:'U01'}]}),/重新选择/);assert.equal(JSON.stringify(s),before);
  const v=view();v.edit();v.select('103');v.confirm();v.node('clerk-user').value='U03';v.api.change(v.node('clerk-user'));assert.equal(v.node('subject-transfer-modal').open,true);assert.match(v.node('subject-transfer-body').innerHTML,/财务丙/);assert.equal(F.subject(v.s,'103').clerkUserId,'U02');
});
check('原关联无效主体仍保留，更换开票员时同样要求确认',()=>{
  const v=view();F.subject(v.s,'101').active=false;v.edit();assert.ok(!v.node('clerk-subjects').options.some(o=>o.value==='101'));v.node('clerk-user').value='U03';v.api.change(v.node('clerk-user'));while(v.node('subject-transfer-modal').open)v.confirm();v.save();assert.equal(F.subject(v.s,'101').clerkUserId,'U03');assert.equal(F.subject(v.s,'102').clerkUserId,'U03');
});
check('一份表单多个待转移主体逐项确认，保存前整单无变化',()=>{
  const v=view();F.subject(v.s,'102').clerkUserId='U02';v.edit();const before=JSON.stringify(v.s);v.node('clerk-subjects').options.forEach(o=>o.selected=true);v.api.change(v.node('clerk-subjects'));v.confirm();assert.equal(v.node('subject-transfer-modal').open,true);v.confirm();assert.equal(v.node('subject-transfer-modal').open,false);assert.equal(JSON.stringify(v.s),before);v.save();assert.ok(v.s.subjects.every(c=>c.clerkUserId==='U01'));
});
console.log(`共${count}项主体关联转移检查通过`);
