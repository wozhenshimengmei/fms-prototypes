// 本地模块及HTML输出检查，不启动浏览器、不连接百望。
const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),events={};
function element(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:true,open:false,classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;},addEventListener(){},append(){}});return nodes.get(id);}
const context={window:{addEventListener(){}},document:{getElementById:element,querySelectorAll:()=>[],addEventListener:(type,fn)=>events[type]=fn,createElement:()=>({remove(){}})},localStorage:{getItem:()=>null,setItem(){}},location:{hash:'#invoices'},history:{replaceState(){}},setTimeout(){},console};
vm.createContext(context);
for(const file of ['catalog.js','state.js','online-state.js','revision-state.js','import-state.js','account-ui.js','online-ui.js','import-ui.js','offline-ui.js']){vm.runInContext(readFileSync(__dirname+'/'+file,'utf8'),context);Object.assign(context,context.window);}
const F=context.window.FMS;require('./verify-ready.cjs')(F);const s=F.initial();let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
check('相同名称的不同科目、不同主体分别汇总，且不修改来源',()=>{
  const rows=[{subject:'101',amount:303,fees:[{item:'A',itemName:'同名科目',amount:101},{item:'B',itemName:'同名科目',amount:202}]},{subject:'102',amount:303,fees:[{item:'A',itemName:'同名科目',amount:303}]}],before=JSON.stringify(rows),groups=F.summarizeInvoices(rows);
  assert.equal(groups.length,3);assert.equal(groups.reduce((n,g)=>n+g.amount,0),606);assert.equal(JSON.stringify(rows),before);assert.equal(F.summarizeInvoices([]).length,0);
});
s.records=[];s.fees=[];s.stores=[];
for(let n=0;n<500;n++){const store=String(20000+n),item=['I01','I02','I03'][n%3];s.stores.push({id:store,name:'不应展示的酒店'+n,buyer:'不应展示的购方'+n,tax:'DEMO-BUYER-'+n,email:'hidden'+n+'@example.test'});s.fees.push({id:'BATCH-'+n,store,item,amount:(n+1)*101,month:n%2?'2026-09':'2026-08',bill:'BILL-'+n,source:'账单实际费用'});}
F.load=()=>s;
const source=readFileSync(__dirname+'/app.js','utf8').replace(/\}\)\(\);\s*$/,'window.testShowConfirmation=showConfirmation;\n})();');
vm.runInContext(source,context);
const rows=F.pending(s),total=rows.reduce((n,r)=>n+r.amount,0);
check('500张票跨门店、跨账期仅展示3条主体科目汇总，票数和金额准确',()=>{
  context.window.testShowConfirmation(rows.map(r=>r.key));
  const body=element('modal-body').innerHTML;
  assert.equal(element('modal-title').textContent,'确认开票');assert.equal((body.match(/<tr>/g)||[]).length,4);assert.match(body,/<b>500<\/b> 张/);assert.ok(body.includes('¥ '+F.money(total)));
  assert.doesNotMatch(body,/不应展示|hidden\d+|购方税号|收票邮箱|发票备注|<details|invoice-card/);
  for(const group of F.summarizeInvoices(rows))assert.ok(body.includes(F.money(group.amount)));
  assert.match(element('modal-footer').innerHTML,/confirm-issue/);assert.equal(s.records.length,0);
});
check('汇总后仅跳过变更记录，其余499条按确认金额提交',()=>{
  const expected=JSON.stringify(rows.map(r=>F.snapshot(s,r))),first=s.fees[0];first.amount+=1;
  const result=F.submit(s,rows.map(r=>r.key),expected);assert.equal(result.bad.length,1);assert.match(result.bad[0].issues.join('；'),/发生变化/);assert.equal(result.added.length,499);assert.equal(s.records.length,499);s.records=[];first.amount-=1;
});
async function main(){
  context.window.testShowConfirmation(rows.map(r=>r.key));
  events.click({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'confirm-issue',id:''},disabled:false}:null},preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  check('确认仍生成500笔独立申请，来源与总额保持一致',()=>{assert.equal(s.records.length,500);assert.equal(s.records.reduce((n,r)=>n+r.amount,0),total);assert.ok(s.records.every(r=>r.status==='开票中'));assert.equal(new Set(s.records.map(r=>r.id)).size,500);assert.equal(new Set(s.records.flatMap(r=>r.fees.map(f=>f.id))).size,500);assert.equal(F.pending(s).length,0);});
  console.log(`共${count}项汇总确认检查通过`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
