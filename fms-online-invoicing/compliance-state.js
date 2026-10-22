/* 2026-10-22确认规则：审核来源、最新取值、按项目税率分票、红蓝独立记录、单主体省份会话。仅本地模拟。 */
(function(){
  const F=window.FMS,clone=F.clone,now=F.now,oldInitial=F.initial,oldLoad=F.load;
  const legacyReadiness=F.readiness,legacyOfflineReadiness=F.offlineReadiness,legacyStartLogin=F.startLogin,legacySaveHotel=F.saveHotel;
  const bill=(s,id)=>s.bills.find(b=>b.id===id);
  const isBlue=r=>r.ticketColor!=='红票';
  const sourceIds=r=>new Set(r.fees.map(f=>f.id));
  const intersects=(a,b)=>a.fees.some(f=>b.fees.some(g=>g.id===f.id));
  function migrate(s,demo=false){
    if(!s.consistencyVersion){
      for(const h of s.stores)h.invoiceKind=h.invoiceKind===undefined?(demo?'普票':''):h.invoiceKind;
      for(const c of s.subjects)c.province=c.id==='101'?'广东':c.id==='102'?'广西':'海南';
      s.bills=[...new Map(s.fees.map(f=>[f.bill,{id:f.bill,store:f.store,month:f.month,generated:true,reviewStatus:'已审核',voided:false,history:[]}])).values()];
      for(const r of s.records){r.ticketColor='蓝票';r.invoiceKind=r.buyer.invoiceKind||(/普/.test(r.type||'')?'普票':/专/.test(r.type||'')?'专票':'');r.buyer.invoiceKind=r.invoiceKind;r.type=r.invoiceKind;r.projectId=r.fees[0]?.projectId||F.item(s,r.fees[0]?.item)?.projectId||'';r.rate=r.fees[0]?.rate;r.key=key(r);r.redStatus??='未红冲';r.attempts??=[];}
      // 演示旧版数据的红冲历史转成独立红票，原蓝票快照不覆盖。
      for(const r of [...s.records])if(r.redStatus!=='未红冲'){
        const rr=redRecord(s,r,r.redReason||'开票有误',r.invoiceChannel==='线下开票');
        rr.status=['已红冲','红冲失败'].includes(r.redStatus)?r.redStatus:'红冲中';rr.reason=r.redResultReason||'';
        if(rr.status==='已红冲')rr.number=r.redNumber||'';r.redRecordId=rr.id;s.records.push(rr);
      }
      s.consistencyVersion=34;
    }
    s.bills??=[];return s;
  }
  F.initial=()=>migrate(oldInitial(),true);F.load=()=>{let saved=false;try{saved=!!JSON.parse(localStorage.getItem(F.KEY));}catch{}return migrate(oldLoad(),!saved);};
  function key(r){return [r.month,r.store,r.subject,r.kind,r.projectId||'',r.rate??''].join('|');}
  function allRows(s,approvedOnly=false){const groups=new Map();for(const f of s.fees){const i=F.item(s,f.item);if(approvedOnly){const b=bill(s,f.bill);if(!b?.generated||b.voided||b.reviewStatus!=='已审核')continue;}if(!i?.phase||i.invoiceParticipation===false||!((i.subject==='101'&&i.kind==='店总费用')||(i.subject==='102'&&['店总费用','财务费用'].includes(i.kind))))continue;
    const r={month:f.month,store:f.store,subject:i.subject,kind:i.kind,projectId:i.projectId||'',rate:i.rate},k=key(r);
    if(!groups.has(k))groups.set(k,{...r,key:k,amount:0,fees:[],bill:f.bill});
    const g=groups.get(k);g.amount+=f.amount;g.fees.push({...f,itemName:i.name,project:i.project,projectId:i.projectId,taxCode:i.taxCode??null,rate:i.rate});
  }return [...groups.values()];}
  function sourceIssues(s,r){const issues=[];if(!r?.fees?.length)return ['来源费用已变化，请重新核对。'];
    for(const f of r.fees){const b=bill(s,f.bill);if(!b?.generated||b.voided)issues.push('来源账单未生成或已作废');else if(b.reviewStatus!=='已审核')issues.push('来源账单未审核，请先审核账单。');}
    return [...new Set(issues)];
  }
  const rows=s=>allRows(s,true);
  function occupied(s,r,exclude=[]){return s.records.some(x=>isBlue(x)&&!exclude.includes(x.id)&&!x.sourceReleased&&!(x.status==='开票失败'&&x.retryIds?.length)&&intersects(x,r));}
  const pending=s=>rows(s).filter(r=>!occupied(s,r));
  function scopeSubjects(s){const a=F.clerkAccount(s);if(!a||!F.accountOwned(s,a))return [];const login=F.taxAccount(a);if(!login||s.accounts.filter(x=>x.active!==false&&F.taxAccount(x)===login).length!==1)return [];return F.allowedSubjects(s);}
  const visiblePending=s=>{const ids=new Set(scopeSubjects(s).map(x=>x.id));return pending(s).filter(r=>ids.has(r.subject));};
  const visibleRecords=s=>{const ids=new Set(scopeSubjects(s).map(x=>x.id));return s.records.filter(r=>ids.has(r.subject));};
  const visibleRecord=(s,id)=>visibleRecords(s).find(r=>r.id===id);
  const visibleRow=(s,k)=>{const ids=new Set(scopeSubjects(s).map(x=>x.id));return rows(s).find(r=>r.key===k&&ids.has(r.subject));};
  const invoiceKindIssue='当前门店未维护发票种类，请先到酒店信息管理维护后再开票。';
  const kindIssues=(s,r)=>['专票','普票'].includes(F.store(s,r.store)?.invoiceKind)?[]:[invoiceKindIssue];
  function remark(s,r){const d=r.kind==='店总费用'?F.deduction(s,r):null;return d?'扣除额：'+(d.amount/100).toFixed(2)+'元':'';}
  function snapshot(s,r){const a=F.clerkAccount(s),b=F.store(s,r.store);return {...clone(r),seller:clone(F.subject(s,r.subject)||{}),buyer:clone(b||{}),invoiceKind:b?.invoiceKind||'',type:b?.invoiceKind||'',ticketColor:'蓝票',remark:remark(s,r),operator:s.operator,operatorUserId:s.currentUserId,invoiceChannel:'线上开票',redStatus:'未红冲',account:a?.id||'',accountUserName:F.taxAccount(a),invoiceProvider:a?.invoiceProvider||'',history:[]};}
  const offlineSnapshot=(s,r)=>({...snapshot(s,r),invoiceChannel:'线下开票',invoiceProvider:'',account:'',accountUserName:''});
  function readiness(s,r){return [...new Set([...sourceIssues(s,r),...kindIssues(s,r),...legacyReadiness(s,r)])];}
  function offlineReadiness(s,r){const problems=[...sourceIssues(s,r),...kindIssues(s,r),...legacyOfflineReadiness(s,r)];for(const f of r.fees)if(!F.item(s,f.item)?.projectId||!Number.isFinite(F.item(s,f.item)?.rate))problems.push('科目开票项目或税率未维护');return [...new Set(problems)];}
  function assertSingle(rs){if(new Set(rs.map(r=>r.subject)).size>1)throw Error('每次仅允许办理单个主体，请切换主体后分别开票。');}
  function assertVisible(s,r){if(!scopeSubjects(s).some(c=>c.id===r.subject))throw Error('当前账号无该主体开票权限。');}
  function provinceContext(s,id){const c=F.subject(s,id);if(!c?.province)throw Error('目标税号省份待百望确认，当前不能开票。');const x=F.accountConnection(s);return {province:c.province,current:x?.province||'',needsLogin:!!x?.province&&x.province!==c.province};}
  function checkProvince(s,r,stamp=false){const p=provinceContext(s,r.subject);if(p.needsLogin)throw Error('当前主体涉及跨省开票，请重新登录认证后继续。');if(stamp)F.accountConnection(s).province=p.province;}
  function beginProvinceLogin(s,id){const c=F.subject(s,id);assertVisible(s,{subject:id});const {a,x}=F.onlineContext(s);F.preflight(s,[{subject:id}]);const permission=F.connection(s,a.id,id);if(!a.subjects.includes(id)||permission?.status!=='可开票'||permission?.subjectTaxNo!==c.tax)throw Error('当前税局账号无该主体税号权限，或税号校验不符。');x.provinceLoginAttempts=(x.provinceLoginAttempts||0)+1;if(x.provinceLoginAttempts>3)throw Error('本次跨省登录已达到重试上限，请稍后重新办理。');x.targetProvince=c.province;F.startLogin(s,F.taxAccount(a));return x;}
  function completeProvinceLogin(s,id){const x=F.accountConnection(s);if(F.accountStatus(s)!=='有效')throw Error('跨省登录认证尚未成功，当前未提交发票。');assertVisible(s,{subject:id});x.province=F.subject(s,id)?.province;delete x.targetProvince;x.provinceLoginAttempts=0;return x;}
  F.startLogin=(s,username)=>{const x=legacyStartLogin(s,username);delete x.province;return x;};
  function recById(s,id){const r=visibleRecord(s,id);if(!r)throw Error('记录不存在或当前账号无访问权限。');return r;}
  function addBlue(s,r,channel,number,extra={}){const offline=channel==='线下开票',rec=offline?offlineSnapshot(s,r):snapshot(s,r),t=now();Object.assign(rec,{id:(offline?'XX-':'KP-')+'DEMO-'+(++s.sequence),created:t,status:offline?'已开票':'开票中',number:offline?F.normalizeInvoiceNumber(number):'',issued:'',registeredAt:offline?t:'',reason:'',attempts:[],history:[{time:t,actor:s.operator,text:offline?'登记线下已开票':'提交百望开票申请（本地模拟）'}],...extra});s.records.push(rec);return rec;}
  function batch(s,chosen,expected,channel,numbers={},exclude=[],extra={},planRows=null){const ids=[...new Set(chosen)];if(!ids.length)throw Error('请先选择费用。');const live=new Map((planRows||rows(s)).map(r=>[r.key,r]));const rs=ids.map(k=>live.get(k)).filter(Boolean);assertSingle(rs);
    const expectedMap=expected?new Map(JSON.parse(expected).map(r=>[r.key,r])):null,added=[],bad=[];if(channel==='线上开票')F.preflight(s,rs);
    const counts=new Map();if(channel==='线下开票')for(const r of rs){const n=String(numbers[r.key]||'').trim(),k=F.subject(s,r.subject)?.tax+'|'+n;if(n)counts.set(k,(counts.get(k)||0)+1);}
    for(const k of ids){const r=live.get(k),issues=[];if(!r){const old=allRows(s).find(x=>x.key===k);issues.push(...(old?sourceIssues(s,old):[]));if(!issues.length)issues.push('来源、项目或税率已变化，请重新核对。');}else{
      try{assertVisible(s,r);}catch(e){issues.push(e.message);}issues.push(...(channel==='线下开票'?offlineReadiness(s,r):readiness(s,r)));
      if(occupied(s,r,exclude))issues.push('该来源已有开票申请，不能重复开票。');
      const snap=channel==='线下开票'?offlineSnapshot(s,r):snapshot(s,r);if(expectedMap&&JSON.stringify(snap)!==JSON.stringify(expectedMap.get(k)))issues.push('费用、资料、发票种类或配置已变化，请重新确认。');
      if(channel==='线上开票'&&!issues.length)try{checkProvince(s,r);}catch(e){issues.push(e.message);}
      if(channel==='线下开票'){issues.push(...F.offlineNumberIssues(s,r,numbers[k]));if(counts.get(F.subject(s,r.subject)?.tax+'|'+String(numbers[k]||'').trim())>1)issues.push('本次所选记录存在相同销方及发票号码。');}
    }
    if(issues.length){const parts=k.split('|');bad.push({r:r||expectedMap?.get(k)||{key:k,month:parts[0],store:parts[1],subject:parts[2],kind:parts[3],amount:0,fees:[]},issues:[...new Set(issues)]});continue;}
    if(channel==='线上开票')checkProvince(s,r,true);added.push(addBlue(s,r,channel,numbers[k],extra));
    }return {added,bad};
  }
  const submit=(s,ids,expected)=>batch(s,ids,expected,'线上开票');
  const submitOffline=(s,ids,expected,numbers)=>batch(s,ids,expected,'线下开票',numbers);
  function result(s,id,outcome){const r=recById(s,id);if(r.ticketColor==='红票')return onlineRedResult(s,id,outcome);if(r.status!=='开票中'){if(r.status==='已开票'&&outcome==='success')return r;throw Error('该记录不在开票处理中。');}if(outcome==='success'){r.status='已开票';r.number='20261022'+String(s.sequence).padStart(12,'0');r.issued=now();r.reason='';}else if(outcome==='failed'){r.status='开票失败';r.reason='百望明确返回开票失败，请核对资料后重试。';}else r.reason='结果未知，请查询原申请，不重复开票。';r.history.push({time:now(),actor:'模拟接口',text:r.status+'；'+r.reason});return r;}
  function currentPlan(s,parent){const ids=sourceIds(parent),rs=allRows(s).map(r=>{const fees=r.fees.filter(f=>ids.has(f.id));return {...r,fees,amount:fees.reduce((n,f)=>n+f.amount,0)};}).filter(r=>r.fees.length);if(!rs.length)throw Error('来源费用已排除或不存在，请核对账单及科目配置。');if(rs.some(r=>r.subject!==parent.subject))throw Error('来源所属主体已变化，请先核对原票关联。');return rs;}
  function retryLatest(s,id,expected){const parent=recById(s,id);if(!isBlue(parent)||parent.status!=='开票失败'||F.invoiceChannel(parent)!=='线上开票'||parent.retryIds?.length)throw Error('仅明确失败且未生成后续申请的线上记录可重试。');if(parent.number)throw Error('原申请已返回发票号码，请先查询核实，不可重试开票。');const rs=currentPlan(s,parent);assertSingle(rs);F.preflight(s,rs);for(const r of rs){const e=readiness(s,r);if(e.length)throw Error(e.join('；'));checkProvince(s,r);}
    if(expected&&JSON.stringify(rs.map(r=>snapshot(s,r)))!==expected)throw Error('重试资料已变化，请重新确认。');
    parent.attempts??=[];parent.attempts.push({time:now(),status:parent.status,reason:parent.reason,snapshot:clone({...parent,attempts:undefined,history:undefined}),operator:s.operator,operatorUserId:s.currentUserId,accountUserName:F.taxAccount(F.clerkAccount(s))});
    const excluded=s.records.filter(x=>x.id===id||x.retryOf===id).map(x=>x.id);
    if(rs.some(r=>occupied(s,r,excluded)))throw Error('来源已有其他有效开票申请，请查询原申请。');
    if(rs.length===1){const oldHistory=parent.history,attempts=parent.attempts,meta={id:parent.id,created:parent.created,parentInvoiceId:parent.parentInvoiceId,rootInvoiceId:parent.rootInvoiceId};Object.assign(parent,snapshot(s,rs[0]),meta,{status:'开票中',reason:'',number:'',sourceReleased:false,lastOperationAt:now(),attempts,history:[...oldHistory,{time:now(),actor:s.operator,text:'按最新资料重新校验并重试原申请'}]});checkProvince(s,rs[0],true);return{added:[parent],bad:[]};}
    const out=batch(s,rs.map(r=>r.key),null,'线上开票',{},excluded,{retryOf:parent.id,parentInvoiceId:parent.parentInvoiceId,rootInvoiceId:parent.rootInvoiceId},rs);parent.retryIds=out.added.map(x=>x.id);return out;
  }
  function retry(s,id,expected){return retryLatest(s,id,expected).added[0];}
  function redRecord(s,parent,reason,offline){const r=clone(parent),t=now();Object.assign(r,{id:'HC-DEMO-'+(++s.sequence),ticketColor:'红票',originalBlueId:parent.id,amount:-Math.abs(parent.amount),fees:parent.fees.map(f=>({...clone(f),amount:-f.amount})),created:t,operator:s.operator,operatorUserId:s.currentUserId,status:offline?'已红冲':'红冲中',redStatus:undefined,number:'',issued:'',registeredAt:offline?t:'',redReason:reason,reason:'',history:[{time:t,actor:s.operator,text:offline?'登记线下整票红冲':'提交整票红冲申请（本地模拟）'}],accountUserName:offline?'':F.taxAccount(F.clerkAccount(s))});delete r.reissueId;delete r.reissueIds;delete r.redRecordId;delete r.attempts;return r;}
  function redEligible(r){return !!r&&isBlue(r)&&r.status==='已开票'&&(r.redStatus||'未红冲')==='未红冲';}
  function redContext(s,id,reason,online){const parent=recById(s,id);if(!F.redReasons.includes(reason))throw Error('请选择红冲原因。');if(!redEligible(parent)||parent.redRecordId)throw Error('该蓝票已发起有效红冲申请，请查询或重试原红票，不重复登记。');if((F.invoiceChannel(parent)==='线上开票')!==online)throw Error('红冲方式必须跟随原票开票方式。');if(online){F.preflight(s,[parent]);if(F.accountStatus(s)!=='有效'||!F.clerkAccount(s)?.subjects.includes(parent.subject))throw Error('请完成当前有权税局账号登录认证。');const permission=F.connection(s,F.clerkAccount(s).id,parent.subject);if(permission?.status!=='可开票'||permission?.subjectTaxNo!==F.subject(s,parent.subject)?.tax)throw Error('当前账号目标税号权限校验失败。');checkProvince(s,parent);if(parent.seller.tax!==F.subject(s,parent.subject)?.tax)throw Error('原票销方税号与当前配置不一致，请核对。');}return parent;}
  function submitOnlineRed(s,id,reason){const parent=redContext(s,id,reason,true),r=redRecord(s,parent,reason,false);checkProvince(s,parent,true);s.records.push(r);parent.redRecordId=r.id;parent.redStatus='红冲处理中';return r;}
  function registerOfflineRed(s,id,reason,number){const parent=redContext(s,id,reason,false);const errors=F.offlineNumberIssues(s,parent,number);if(errors.length)throw Error(errors.join('；'));const r=redRecord(s,parent,reason,true);r.number=F.normalizeInvoiceNumber(number);s.records.push(r);parent.redRecordId=r.id;parent.redStatus='已红冲';return r;}
  function onlineRedResult(s,id,outcome){let r=recById(s,id);if(isBlue(r))r=recById(s,r.redRecordId);if(r.ticketColor!=='红票')throw Error('无对应红冲申请。');if(r.status==='已红冲'&&outcome==='success')return r;if(r.status!=='红冲中')throw Error('当前红票不在处理中。');const parent=s.records.find(x=>x.id===r.originalBlueId);r.status=outcome==='success'?'已红冲':outcome==='failed'?'红冲失败':'红冲中';r.reason=outcome==='waiting'?'待对方确认':outcome==='failed'?'百望返回红冲失败：原票状态不允许红冲':outcome==='unknown'?'红冲结果未知，请查询原申请。':'';if(outcome==='success'){r.number='20261022'+String(s.sequence).padStart(12,'0');r.issued=now();parent.redStatus='已红冲';}else parent.redStatus=outcome==='failed'?'红冲失败':'红冲处理中';r.history.push({time:now(),actor:'模拟接口',text:r.status+'；'+r.reason});return r;}
  function retryRed(s,id){const r=recById(s,id);if(r.ticketColor!=='红票'||r.status!=='红冲失败')throw Error('仅明确失败的红票可重试。');F.preflight(s,[r]);if(F.accountStatus(s)!=='有效')throw Error('请先登录认证。');const permission=F.connection(s,F.clerkAccount(s).id,r.subject);if(permission?.status!=='可开票'||permission?.subjectTaxNo!==r.seller.tax)throw Error('当前账号目标税号权限校验失败。');checkProvince(s,r,true);r.attempts??=[];r.attempts.push({time:now(),reason:r.reason,operator:s.operator,accountUserName:F.taxAccount(F.clerkAccount(s))});r.status='红冲中';r.reason='';s.records.find(x=>x.id===r.originalBlueId).redStatus='红冲处理中';return r;}
  function reissueRows(s,id){const parent=recById(s,id);if(!isBlue(parent)||parent.status!=='已开票'||parent.redStatus!=='已红冲')throw Error('仅整票红冲成功后的蓝票可重开。');const children=s.records.filter(x=>x.parentInvoiceId===id&&isBlue(x)),used=new Set(children.flatMap(x=>x.fees.map(f=>f.id)));const rs=currentPlan(s,parent).map(r=>{const fees=r.fees.filter(f=>!used.has(f.id));return{...r,fees,amount:fees.reduce((n,f)=>n+f.amount,0)};}).filter(r=>r.fees.length);if(!rs.length)throw Error('该原票已有完整重开记录，请跟进新申请。');for(const r of rs){const errors=sourceIssues(s,r);if(errors.length)throw Error(errors.join('；'));const blockers=s.records.filter(x=>isBlue(x)&&x.id!==id&&x.redStatus!=='已红冲'&&!x.sourceReleased&&x.status!=='开票失败'&&intersects(x,r));if(blockers.length)throw Error('来源已有其他有效蓝票或开票申请。');}return rs;}
  const reissueRow=(s,id)=>reissueRows(s,id)[0];
  function reissueMany(s,id,channel,expected,numbers={}){if(!['线上开票','线下开票'].includes(channel))throw Error('请选择开票方式。');const parent=recById(s,id),rs=reissueRows(s,id);const excluded=s.records.filter(x=>isBlue(x)&&x.redStatus==='已红冲').map(x=>x.id);const out=batch(s,rs.map(r=>r.key),expected,channel,numbers,excluded,{parentInvoiceId:id,rootInvoiceId:parent.rootInvoiceId||id},rs);parent.reissueIds=[...new Set([...(parent.reissueIds||[]),...out.added.map(x=>x.id)])];if(out.added.length)parent.reissueId??=out.added[0].id;return out;}
  function canReissue(s,id){try{return reissueRows(s,id).length>0;}catch{return false;}}
  function reissue(s,id,channel,expected,number){const r=reissueRow(s,id),sig=expected?JSON.stringify([JSON.parse(expected)]):null,out=reissueMany(s,id,channel,sig,{[r.key]:number});if(out.bad.length)throw Error(out.bad.flatMap(x=>x.issues).join('；'));return out.added[0];}
  function reverseReview(s,id){const b=bill(s,id);if(!b||b.reviewStatus!=='已审核')throw Error('仅已审核账单可反审核。');const linked=s.records.filter(r=>isBlue(r)&&r.fees.some(f=>f.bill===id));if(linked.some(r=>r.status==='开票失败'&&r.number))throw Error('原申请已有发票号码，请先核实实际开票结果并红冲后再反审核。');if(linked.some(r=>r.status==='开票中'))throw Error('当前账单处于开票中状态，请先等待开票结果后再执行操作。');if(linked.some(r=>r.status==='已开票'&&r.redStatus!=='已红冲'))throw Error('当前账单处于已开票状态，请先联系开票员红冲发票再执行操作。');b.reviewStatus='待审核';b.history.push({time:now(),actor:s.operator,text:'反审核：已审核变为待审核'});for(const r of linked)if(r.status==='开票失败')r.sourceReleased=true;return b;}
  function approveBill(s,id){const b=bill(s,id);if(!b?.generated||b.voided)throw Error('账单未生成或已作废。');b.reviewStatus='已审核';b.history.push({time:now(),actor:s.operator,text:'审核通过'});return b;}
  function updateBillFee(s,billId,feeId,amount){const b=bill(s,billId);if(b?.reviewStatus!=='待审核')throw Error('仅待审核账单可调整费用。');const f=s.fees.find(f=>f.bill===billId&&f.id===feeId);if(!f||!Number.isSafeInteger(amount))throw Error('费用金额无效。');f.amount=amount;b.history.push({time:now(),actor:s.operator,text:'调整来源费用 '+feeId});}
  function displayStatus(r){return r.ticketColor==='红票'?r.status:r.status;}
  function recordMessage(r){return r.status==='已开票'?'开票成功':r.status==='已红冲'?'红冲成功':r.reason||(['开票失败','红冲失败'].includes(r.status)?'百望未返回具体失败原因':'—');}
  const signedCents=v=>String(v).trim().startsWith('-')?-F.cents(String(v).trim().slice(1)):F.cents(v);
  const sourceAuditSummary=(s,r)=>[...new Set(r.fees.map(f=>bill(s,f.bill)?.reviewStatus||'账单不存在'))].join('、');
  const netInvoiceAmount=(s,rs=visibleRecords(s))=>rs.filter(r=>r.status==='已开票'&&isBlue(r)||r.status==='已红冲'&&!isBlue(r)).reduce((n,r)=>n+r.amount,0);
  F.saveHotel=(s,id,data)=>{if(data.invoiceKind&&!['专票','普票'].includes(data.invoiceKind))throw Error('请选择专票或普票。');const h=legacySaveHotel(s,id,data);h.invoiceKind=data.invoiceKind||'';return h;};
  const offlineHeaders=['系统匹配标识','门店ID','账期','主体ID','科目名称','开票项目','税率','发票种类','含税金额','发票号码'];
  function exportLine(s,r,number=''){return[r.key,r.store,r.month,r.subject,r.kind==='财务费用'?'财务费用':[...new Set(r.fees.map(f=>f.itemName))].join('、'),r.fees[0]?.project||'',r.rate+'%',F.store(s,r.store)?.invoiceKind||'',F.money(r.amount),String(number||'')];}
  function offlineExport(s,rs,numbers={}){return[offlineHeaders,...rs.map(r=>exportLine(s,r,numbers[r.key]))];}
  function previewOfflineNumbers(s,rs,data,numbers,parentId=''){if(data.length<2||data[0].join('|')!==offlineHeaders.join('|'))throw Error('请使用最新导出的线下票号清单，保持表头不变。');const seen=new Set(),counts=new Map();return data.slice(1).map((line,i)=>{const r=rs.find(r=>r.key===line[0]),issues=[],number=String(line[9]||'').trim(),key=line[0];if(!r)issues.push('无法匹配本次所选记录');if(seen.has(key))issues.push('文件内匹配标识重复');seen.add(key);if(r){const current=allRows(s).find(x=>x.key===key);if(!current||JSON.stringify(line.slice(1,9))!==JSON.stringify(exportLine(s,current).slice(1,9)))issues.push('归集数据或核对列已变化，请重新导出');if(sourceIssues(s,r).length)issues.push(...sourceIssues(s,r));if(!parentId&&occupied(s,r))issues.push('来源已存在开票记录');if(number)issues.push(...F.offlineNumberIssues(s,r,number));}const numberKey=F.subject(s,r?.subject)?.tax+'|'+number;if(number)counts.set(numberKey,(counts.get(numberKey)||0)+1);return{key,r,line:i+2,number,old:String(numbers[key]||''),issues,numberKey};}).map(v=>{if(v.number&&counts.get(v.numberKey)>1)v.issues.push('文件内同销方发票号码重复');return v;});}
  Object.assign(F,{key,bill,allRows,rows,pending,occupied,sourceIssues,scopeSubjects,visiblePending,visibleRecords,visibleRecord,visibleRow,snapshot,offlineSnapshot,remark,readiness,offlineReadiness,submit,submitOffline,result,retry,retryLatest,currentPlan,redEligible,submitOnlineRed,registerOfflineRed,onlineRedResult,retryRed,reissueRows,reissueRow,reissueMany,reissue,canReissue,reverseReview,approveBill,updateBillFee,displayStatus,recordMessage,sourceAuditSummary,signedCents,netInvoiceAmount,provinceContext,beginProvinceLogin,completeProvinceLogin,offlineHeaders,offlineExport,previewOfflineNumbers});
})();
