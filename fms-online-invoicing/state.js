(function(){
  const KEY='fms-invoice-prototype-v1';
  const clone=o=>JSON.parse(JSON.stringify(o));
  const now=()=>new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'});
  const storeNames=['北京三里屯太古里野家楼地铁站店','南宁东站雅斯特酒店','深圳南山科技园雅斯特酒店','广州番禺雅斯特酒店','桂林两江四湖雅斯特酒店','长沙五一广场雅斯特酒店','柳州五星步行街雅斯特酒店','武汉光谷雅斯特酒店','海口国贸雅斯特酒店','佛山祖庙雅斯特酒店','东莞松山湖雅斯特酒店','南宁会展中心雅斯特酒店','深圳宝安中心雅斯特酒店','广州天河雅斯特酒店','桂林北站雅斯特酒店'];
  function initial(){
    const subjects=[{id:'101',short:'深圳雅才',name:'深圳市雅才云聚人力资源有限公司',tax:'91440300MA5F6T2N79',clerk:'占旭婷',active:true,bank:'',bankNo:'',address:'',phone:''},{id:'102',short:'广西雅才',name:'广西雅才云聚人力资源有限公司',tax:'91450100MA7Q8K6D4P',clerk:'占旭婷',active:true,bank:'',bankNo:'',address:'',phone:''},{id:'103',short:'海南雅布里',name:'海南雅布里文旅投资有限公司',tax:'91460100MA5T3H8P2Y',clerk:'财务乙',active:true,bank:'',bankNo:'',address:'',phone:''}];
    const items=[{id:'I01',name:'深圳店总费用调整项',kind:'店总费用',subject:'101',project:'生产生活服务*劳务派遣',rate:6,active:true,phase:true,note:'按合同约定每月15日前支付本月费用'},{id:'I02',name:'广西店总费用调整项',kind:'店总费用',subject:'102',project:'生产生活服务*劳务派遣',rate:6,active:true,phase:true,note:'按合同约定每月15日前支付本月费用'},{id:'I03',name:'财务费用',kind:'财务费用',subject:'102',project:'生产生活服务*服务费',rate:6,active:true,phase:true,note:'按合同约定收取财务服务费'},{id:'I05',name:'财务调整项',kind:'财务费用',subject:'102',project:'生产生活服务*服务费',rate:6,active:true,phase:true,note:'与同门店、账期、主体的财务费用合计开票'},{id:'I04',name:'会员维护成本',kind:'会员维护成本',subject:'103',project:'',rate:null,active:true,phase:false,note:'后续接入；当前继续按原有方式开票'}];
    const stores=storeNames.map((name,i)=>({id:String(10001+i),name,buyer:name+'投资管理有限公司',tax:i===3?'':'DEMO-BUYER-'+String(10001+i),email:'finance'+String(10001+i)+'@example.test'}));
    let seq=0;const fees=[];
    function fee(store,item,amount,month='2026-09'){fees.push({id:'F'+(++seq),store:String(store),item,amount,month,bill:'FB'+month.replace('-','')+'-'+String(store),source:'账单实际费用'});}
    fee(10001,'I02',500000);fee(10001,'I01',600000);fee(10001,'I03',70000);fee(10001,'I05',10000);
    for(let i=1;i<12;i++){fee(10001+i,i%2?'I01':'I02',(8400+i*137)*100);if(i%3===0)fee(10001+i,'I03',(600+i*50)*100);}
    fee(10013,'I01',680000);fee(10014,'I02',85000);fee(10015,'I01',900000);
    fee(10001,'I02',460000,'2026-08');fee(10002,'I01',780000,'2026-08');
    const state={version:1,subjects,items,stores,fees,operator:'占旭婷',account:'A01',accounts:[{id:'A01',name:'DEMO-雅才联合账号',owner:'占旭婷',subjects:['101','102'],status:'可开票'},{id:'A03',name:'DEMO-其他主体账号',owner:'财务乙',subjects:['103'],status:'未登录'}],deductions:[],imports:[],records:[],sequence:100};
    const rows=pending(state);for(const [store,status] of [['10013','已开票'],['10014','开票失败'],['10015','开票中']]){const row=rows.find(r=>r.store===store);const r=snapshot(state,row);r.id='KP-DEMO-'+(++state.sequence);r.status=status;r.created='2026-10-19 09:30:00';r.number=status==='已开票'?'DEMO-202610190001':'';r.reason=status==='开票失败'?'演示：供应商明确返回开票失败，请核对后重试':'';r.history=[{time:r.created,actor:'占旭婷',text:'提交开票（模拟）'}];if(status==='已开票')r.history.push({time:'2026-10-19 09:31:00',actor:'系统',text:'模拟开票成功'});state.records.push(r);}
    return state;
  }
  const subject=(s,id)=>s.subjects.find(x=>x.id===id),item=(s,id)=>s.items.find(x=>x.id===id),store=(s,id)=>s.stores.find(x=>x.id===id);
  const deduction=(s,r)=>s.deductions.find(d=>d.month===r.month&&d.store===r.store&&d.subject===r.subject);
  const key=r=>[r.month,r.store,r.subject,r.kind].join('|');
  function rows(s){const groups=new Map();for(const f of s.fees){const i=item(s,f.item);if(!i?.phase||i.invoiceParticipation===false||!((i.subject==='101'&&i.kind==='店总费用')||(i.subject==='102'&&['店总费用','财务费用'].includes(i.kind))))continue;const row={month:f.month,store:f.store,subject:i.subject,kind:i.kind},k=key(row);if(!groups.has(k))groups.set(k,{...row,key:k,amount:0,fees:[],bill:f.bill});const g=groups.get(k);g.amount+=f.amount;g.fees.push({...f,itemName:i.name,project:i.project,projectId:i.projectId,taxCode:i.taxCode??null,rate:i.rate});}return [...groups.values()];}
  const occupied=(s,r)=>s.records.some(i=>i.fees.some(f=>r.fees.some(x=>x.id===f.id)));
  function pending(s){return rows(s).filter(r=>!occupied(s,r));}
  function remark(s,r){const d=r.kind==='店总费用'?deduction(s,r):null;return d?`${r.month.slice(0,4)}年${Number(r.month.slice(5))}月扣除费用：${money(d.amount)}元`:'';}
  function summarizeInvoices(rs){const groups=new Map();for(const r of rs)for(const f of r.fees){const financial=r.kind==='财务费用',k=JSON.stringify([r.subject,financial?'kind':'item',financial?r.kind:f.item]);if(!groups.has(k))groups.set(k,{subject:r.subject,item:financial?(r.fees.find(x=>x.itemName==='财务费用')?.item||f.item):f.item,itemName:financial?'财务费用':f.itemName,amount:0});groups.get(k).amount+=f.amount;}return [...groups.values()].sort((a,b)=>String(a.subject).localeCompare(String(b.subject),'zh-CN',{numeric:true})||String(a.item).localeCompare(String(b.item),'zh-CN',{numeric:true}));}
  function snapshot(s,r){return {...clone(r),seller:clone(subject(s,r.subject)||{}),buyer:clone(store(s,r.store)||{}),remark:remark(s,r),operator:s.operator,operatorUserId:s.currentUserId,type:'数电普通发票',invoiceChannel:'线上开票',redStatus:'未红冲',account:s.account,accountUserName:window.FMS?.taxAccount?.(window.FMS?.clerkAccount?.(s))||'',invoiceProvider:window.FMS?.clerkAccount?.(s)?.invoiceProvider||'',history:[]};}
  function readiness(s,r){
    const c=subject(s,r.subject),b=store(s,r.store),a=window.FMS?.clerkAccount?window.FMS.clerkAccount(s):s.accounts.find(a=>a.id===s.account),x=window.FMS?.connection?.(s,s.account,r.subject),issues=[];
    if(!c?.active)issues.push('开票主体无效');
    if(window.FMS?.providerEnabled?!window.FMS.providerEnabled(a):a?.onlineEnabled===false)issues.push('当前账号未启用在线开票');
    if(!c?.tax)issues.push('销方税号缺失');
    if(!b?.tax||!b?.buyer)issues.push('购方开票资料缺失');
    for(const f of r.fees){const i=item(s,f.item),catalog=window.FMSCatalog;
      if(!i?.active||!i.project||!Number.isFinite(i.rate))issues.push('科目开票配置不完整');
      if(catalog&&(!catalog.find(i?.projectId)||catalog.find(i.projectId).name!==i.project))issues.push('科目开票项目需从百望分类中选择');
      if(catalog&&!catalog.rates.includes(i?.rate))issues.push('科目开票税率不在可选范围内');
    }
    if(!(window.FMS?.ownsSubject?.(s,c)??(c?.clerk===s.operator)))issues.push('不属于当前登录税局账号关联主体，或尚未完成代开认证');
    if(!a||!window.FMS?.accountOwned?.(s,a)||!a.subjects.includes(r.subject))issues.push('当前税局账号不支持该主体');
    else if(window.FMS?.accountStatus){
      const status=window.FMS.accountStatus(s);if(status!=='有效')issues.push(status==='状态待确认'?'账号状态同步失败，当前状态无法确认':status==='待认证'?'当前税局账号需要实人认证':'当前税局账号需登录认证');
      if(x?.status!=='可开票')issues.push(x?.reason||'当前账号的开票主体权限待校验');
      if(x?.subjectTaxNo!==c?.tax)issues.push('主体税号已变更，请重新校验开票主体');
    }else if(a?.status!=='可开票')issues.push('税局账号需登录认证');
    if(!Number.isSafeInteger(r.amount)||r.amount<=0)issues.push('金额需核对');return [...new Set(issues)];
  }
  function submit(s,chosen,expected){
    const keys=[...new Set(chosen)];if(!keys.length)throw Error('请先选择费用。');
    const current=new Map(rows(s).map(r=>[r.key,r])),confirmed=expected?new Map(JSON.parse(expected).map(r=>[r.key,r])):null;
    const fallback=k=>{const [month,store,subject,kind]=k.split('|');return {key:k,month,store,subject,kind,fees:[],amount:0};};
    const picked=keys.map(k=>current.get(k));
    window.FMS?.preflight?.(s,picked.filter(r=>r&&!occupied(s,r)));
    const ready=[],bad=[];
    for(const k of keys){
      const r=current.get(k),issues=!r?['来源费用已变化，请重新核对。']:occupied(s,r)?['该费用已提交开票，未重复发送。']:readiness(s,r);
      if(r&&!issues.length&&confirmed&&JSON.stringify(snapshot(s,r))!==JSON.stringify(confirmed.get(k)))issues.push('费用、备注或配置已发生变化，请重新打开确认窗口核对。');
      if(issues.length)bad.push({r:r||confirmed?.get(k)||fallback(k),issues});else ready.push(r);
    }
    const added=ready.map(r=>{const rec=snapshot(s,r);rec.id='KP-DEMO-'+(++s.sequence);rec.created=now();rec.status='开票中';rec.number='';rec.reason='';rec.history=[{time:rec.created,actor:s.operator,text:'确认提交百望（本地模拟）'}];s.records.push(rec);return rec;});
    return {added,bad};
  }
  function result(s,id,res){const r=s.records.find(x=>x.id===id);if(!r||r.status!=='开票中')throw Error('该记录不在开票处理中。');if(res==='success'){r.status='已开票';r.number='DEMO-'+r.id.replace('KP-DEMO-','')+'-001';r.issued=now();r.reason='';}else if(res==='failed'){r.status='开票失败';r.reason='演示：百望明确返回开票失败，来源仍关联本申请。';}else r.reason='结果暂未返回，继续查询原申请，不能重复开票。';r.history.push({time:now(),actor:'模拟接口',text:res==='success'?'开票成功':res==='failed'?'明确开票失败':'结果未知，保持开票中'});}
  function retry(s,id){
    const r=s.records.find(x=>x.id===id);if(!r||r.status!=='开票失败')throw Error('仅明确失败的申请可重试。');
    window.FMS?.preflight?.(s,[r]);const c=subject(s,r.subject),a=window.FMS?.clerkAccount?.(s)||s.accounts.find(x=>x.id===s.account),x=window.FMS?.connection?.(s,s.account,r.subject);
    if(!window.FMS?.providerEnabled?.(a)||!window.FMS?.ownsSubject?.(s,c)||!window.FMS?.accountOwned?.(s,a)||!a?.subjects.includes(r.subject)||(window.FMS?.accountStatus?window.FMS.accountStatus(s)!=='有效'||x?.status!=='可开票':a.status!=='可开票'))throw Error('请先选择开票供应商，并完成有权税局账号的登录认证和状态同步。');
    r.status='开票中';r.reason='';r.attempts??=[];r.attempts.push({time:now(),operator:s.operator,operatorUserId:s.currentUserId,accountUserName:window.FMS.taxAccount(a),invoiceProvider:a.invoiceProvider});r.history.push({time:now(),actor:s.operator,text:'在原申请重试开票（本地模拟）；税局账号：'+window.FMS.taxAccount(a)+'；原票面金额及备注保持不变'});
  }
  const invoiceChannel=r=>r.invoiceChannel||'线上开票';
  function offlineReadiness(s,r){
    const F=window.FMS,c=subject(s,r.subject),b=store(s,r.store),issues=[];
    if(!c?.active)issues.push('开票主体无效');
    if(!F.clerkAccount?.(s)||!F.ownsSubject?.(s,c))issues.push('不属于当前有效开票员负责主体');
    if(!c?.tax)issues.push('销方税号缺失');
    if(!b?.buyer||!b.tax)issues.push('购方开票资料缺失');
    if(!r.fees.length||r.fees.some(f=>!item(s,f.item)?.active))issues.push('来源科目不存在或无效');
    if(!Number.isSafeInteger(r.amount)||r.amount<=0)issues.push('金额需核对');
    return [...new Set(issues)];
  }
  function offlineSnapshot(s,r){return {...snapshot(s,r),invoiceChannel:'线下开票',redStatus:'未红冲',invoiceProvider:'',account:'',accountUserName:''};}
  function normalizeInvoiceNumber(number){const n=String(number??'').trim();if(!n)throw Error('请填写实际发票号码。');if(!/^\d+$/.test(n))throw Error('发票号码须为数字，请核对原票。');return n;}
  function offlineNumberIssues(s,r,number){let n;try{n=normalizeInvoiceNumber(number);}catch(e){return [e.message];}const tax=r.seller?.tax||subject(s,r.subject)?.tax;return s.records.some(x=>x.number===n&&(x.seller?.tax||subject(s,x.subject)?.tax)===tax)?['当前销方及发票号码已登记，不能重复使用。']:[];}
  function offlineRecord(s,r,number){
    const rec=offlineSnapshot(s,r),time=now();Object.assign(rec,{id:'XX-DEMO-'+(++s.sequence),status:'已开票',created:time,registeredAt:time,number:normalizeInvoiceNumber(number),issued:'',reason:'',history:[{time,actor:s.operator,text:'确认已在线下开具，登记为已开票'}]});return rec;
  }
  function submitOffline(s,chosen,expected,numbers={}){
    const keys=[...new Set(chosen)];if(!keys.length)throw Error('请先选择费用。');
    const current=new Map(rows(s).map(r=>[r.key,r])),confirmed=expected?new Map(JSON.parse(expected).map(r=>[r.key,r])):null,ready=[],bad=[];
    for(const k of keys){const r=current.get(k),issues=!r?['来源费用已变化，请重新核对。']:occupied(s,r)?['该费用已存在开票记录，未重复登记。']:offlineReadiness(s,r);
      if(r&&!issues.length&&confirmed&&JSON.stringify(offlineSnapshot(s,r))!==JSON.stringify(confirmed.get(k)))issues.push('费用、备注或配置已发生变化，请重新确认。');
      if(issues.length){const [month,st,sub,kind]=k.split('|');bad.push({r:r||confirmed?.get(k)||{key:k,month,store:st,subject:sub,kind,amount:0,fees:[]},issues});}else ready.push(r);
    }
    const numberCounts=new Map();for(const r of ready){const n=String(numbers[r.key]||'').trim();if(n){const k=JSON.stringify([subject(s,r.subject)?.tax,n]);numberCounts.set(k,(numberCounts.get(k)||0)+1);}}
    const added=[];for(const r of ready){const issues=offlineNumberIssues(s,r,numbers[r.key]),k=JSON.stringify([subject(s,r.subject)?.tax,String(numbers[r.key]||'').trim()]);if(numberCounts.get(k)>1)issues.push('本次所选记录存在相同销方及发票号码。');if(issues.length)bad.push({r,issues});else{const rec=offlineRecord(s,r,numbers[r.key]);s.records.push(rec);added.push(rec);}}return {added,bad};
  }
  const redReasons=['开票有误','销货退回','服务中止','销售折让'];
  function validateRedReason(reason){if(!redReasons.includes(reason))throw Error('请选择红冲原因。');return reason;}
  function redEligible(r){return !!r&&r.status==='已开票'&&['未红冲','红冲失败'].includes(r.redStatus||'未红冲');}
  function onlineRedContext(s,r){
    if(!redEligible(r)||invoiceChannel(r)!=='线上开票')throw Error('仅未红冲或红冲失败的线上已开票记录可申请红冲。');
    const F=window.FMS,c=subject(s,r.subject),a=F.clerkAccount?.(s);
    if(!c?.active||!a||!F.ownsSubject?.(s,c))throw Error('当前开票员无权办理该主体。');
    F.preflight?.(s,[r]);
    if(!F.providerEnabled?.(a)||F.accountStatus?.(s)!=='有效')throw Error('请启用在线开票并完成当前税局账号登录认证。');
    const x=F.connection?.(s,a.id,c.id);
    if(!a.subjects.includes(c.id)||x?.status!=='可开票'||x?.subjectTaxNo!==c.tax)throw Error('当前税局账号无该主体开票权限。');
    if(!r.seller?.tax||r.seller.tax!==c.tax)throw Error('原票销方税号与当前主体不一致，请核对。');
    return {a,c};
  }
  function submitOnlineRed(s,id,reason){
    const r=s.records.find(x=>x.id===id);validateRedReason(reason);const {a,c}=onlineRedContext(s,r),time=now();
    Object.assign(r,{redStatus:'红冲处理中',redMode:'线上红冲',redReason:reason,redSubmittedAt:time,redOperator:s.operator,redOperatorUserId:s.currentUserId,redRequestId:'HC-DEMO-'+(++s.sequence),redResultReason:'',redRequestAccount:window.FMS.taxAccount(a),redRequestTax:c.tax});
    r.history.push({time,actor:s.operator,text:'提交整票红冲申请（本地模拟）；原因：'+reason});return r;
  }
  function onlineRedResult(s,id,outcome){
    const r=s.records.find(x=>x.id===id);if(!r||invoiceChannel(r)!=='线上开票'||!['红冲处理中','待对方确认'].includes(r.redStatus))throw Error('当前没有待查询的线上红冲申请。');
    if(!['success','waiting','failed','unknown'].includes(outcome))throw Error('请选择有效的模拟结果。');
    const c=subject(s,r.subject);if(!c?.active||!window.FMS.ownsSubject?.(s,c))throw Error('当前开票员无权办理该主体。');
    const time=now();r.redStatus=outcome==='success'?'已红冲':outcome==='waiting'?'待对方确认':outcome==='failed'?'红冲失败':r.redStatus;
    r.redResultReason=outcome==='failed'?'百望返回红冲失败：原票状态不允许红冲':outcome==='unknown'?'红冲结果暂未确认，请稍后查询。':'';
    if(outcome==='success')r.redCompletedAt=time;
    r.history.push({time,actor:s.operator,text:'模拟红冲结果：'+r.redStatus+(r.redResultReason?'；'+r.redResultReason:'')});return r;
  }
  function offlineRedIssues(s,r){
    if(!r||invoiceChannel(r)!=='线下开票'||r.status!=='已开票')throw Error('仅已开具的线下发票可登记线下红冲。');
    if(!redEligible(r))throw Error('该发票已登记红冲或正在处理中，不可重复登记。');
    const F=window.FMS,c=subject(s,r.subject);if(!c?.active||!F.clerkAccount?.(s)||!F.ownsSubject?.(s,c))throw Error('当前开票员无权办理该主体。');
  }
  function registerOfflineRed(s,id,reason){
    const r=s.records.find(x=>x.id===id);offlineRedIssues(s,r);reason=validateRedReason(String(reason||'').trim());
    const time=now();Object.assign(r,{redStatus:'已红冲',redMode:'线下红冲',redRegisteredAt:time,redOperator:s.operator,redReason:reason,redRegistrationId:'HC-DJ-'+(++s.sequence)});
    r.history.push({time,actor:s.operator,text:'登记线下已完成红冲；原因：'+reason});return r;
  }
  function reissueRow(s,id){
    const parent=s.records.find(x=>x.id===id);if(!parent||parent.status!=='已开票'||parent.redStatus!=='已红冲')throw Error('仅整票红冲完成后可重新开票。');
    if(parent.reissueId||s.records.some(x=>x.parentInvoiceId===id))throw Error('该原票已有重开记录，请跟进已有申请。');
    const r=rows(s).find(x=>x.key===parent.key);if(!r)throw Error('原票对应费用来源或主体已变化，请先核对来源账单。');
    if(s.records.some(x=>x.id!==id&&x.redStatus!=='已红冲'&&x.fees.some(f=>r.fees.some(v=>v.id===f.id))))throw Error('对应费用已有其他有效开票申请，不能重复重开。');
    return r;
  }
  function reissue(s,id,channel,expected,number){
    if(!['线上开票','线下开票'].includes(channel))throw Error('请选择开票类型。');
    const parent=s.records.find(x=>x.id===id),r=reissueRow(s,id),F=window.FMS;
    if(channel==='线上开票')F.preflight?.(s,[r]);
    const issues=channel==='线下开票'?offlineReadiness(s,r):readiness(s,r);if(issues.length)throw Error(issues.join('；'));
    const snap=channel==='线下开票'?offlineSnapshot(s,r):snapshot(s,r);if(expected&&JSON.stringify(snap)!==expected)throw Error('费用、备注或配置已发生变化，请重新确认重开。');
    if(channel==='线下开票'){const errors=offlineNumberIssues(s,r,number);if(errors.length)throw Error(errors.join('；'));}
    let rec;if(channel==='线下开票')rec=offlineRecord(s,r,number);else{rec=snap;const time=now();Object.assign(rec,{id:'KP-DEMO-'+(++s.sequence),invoiceChannel:'线上开票',redStatus:'未红冲',created:time,status:'开票中',number:'',reason:'',history:[{time,actor:s.operator,text:'确认重开并提交百望（本地模拟）'}]});}
    rec.parentInvoiceId=id;rec.rootInvoiceId=parent.rootInvoiceId||id;rec.history.push({time:now(),actor:s.operator,text:'关联原票：'+id});s.records.push(rec);parent.reissueId=rec.id;parent.history.push({time:now(),actor:s.operator,text:'已新建'+channel+'重开记录：'+rec.id});return rec;
  }
  function money(c){return (c/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function cents(v){const t=String(v).trim();if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(t))throw Error('金额须为非负数字，最多两位小数');const [a,b='']=t.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>99999999999)throw Error('金额超出范围');return n;}
  function previewImport(s,month,data){const heads=['门店ID','主体ID','扣除费用'];if(!month)throw Error('请选择费用所属账期。');if(data.length<2||data[0].map(x=>String(x).trim()).join('|')!==heads.join('|'))throw Error('表头必须依次为：门店ID、主体ID、扣除费用。');const seen=new Set();const result=data.slice(1).filter(r=>r.some(x=>String(x).trim())).map((line,index)=>{const [st,sub,amt]=line.map(x=>String(x).trim()),k=[month,st,sub].join('|'),errors=[];if(line.length!==3)errors.push('必须为三列');if(!store(s,st))errors.push('门店ID不存在');const c=subject(s,sub);if(!c||!c.active)errors.push('主体ID不存在或无效');if(c&&!window.FMS?.ownsSubject?.(s,c))errors.push('主体不属于当前开票员');if(!rows(s).some(r=>r.month===month&&r.store===st&&r.subject===sub&&r.kind==='店总费用'))errors.push('找不到该主体店总费用');if(seen.has(k))errors.push('文件内门店与主体重复');seen.add(k);let amount;try{amount=cents(amt);}catch(e){errors.push(e.message);}const old=s.deductions.find(x=>x.month===month&&x.store===st&&x.subject===sub);return {month,store:st,subject:sub,amount,rawAmount:amt,line:index+2,errors,old:old?clone(old):null};});if(!result.length)throw Error('文件中没有有效数据行。');return result;}
  function commitImport(s,preview){if(preview.some(r=>r.errors.length))throw Error('请先修正异常行，当前未保存任何数据。');for(const r of preview){const d={month:r.month,store:r.store,subject:r.subject,amount:r.amount,operator:s.operator,time:now()},n=s.deductions.findIndex(x=>x.month===r.month&&x.store===r.store&&x.subject===r.subject);if(n<0)s.deductions.push(d);else s.deductions[n]=d;}s.imports.push({time:now(),operator:s.operator,rows:clone(preview)});}
  function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.version!==1)return initial();for(const r of s.records){r.invoiceChannel??='线上开票';r.redStatus??='未红冲';}for(const c of s.subjects){const replacements={"DEMO-SZ-TAXNO": "91440300MA5F6T2N79", "DEMO-GX-TAXNO": "91450100MA7Q8K6D4P", "DEMO-HN-TAXNO": "91460100MA5T3H8P2Y"};if(replacements[c.tax])c.tax=replacements[c.tax];}for(const i of s.items){if(i.id==='I01'&&i.name==='深圳店总费用')i.name='深圳店总费用调整项';if(i.id==='I02'&&i.name==='广西店总费用')i.name='广西店总费用调整项';}const finance=item(s,'I03');if(finance&&!item(s,'I05'))s.items.push({...clone(finance),id:'I05',name:'财务调整项',note:'与同门店、账期、主体的财务费用合计开票'});return s;}catch{return initial();}}
  function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch{/* 禁用存储环境仍可在当前页面演示。 */}}
  window.FMS={KEY,clone,now,initial,subject,item,store,deduction,key,rows,pending,remark,summarizeInvoices,snapshot,readiness,submit,result,retry,money,cents,previewImport,commitImport,load,save,invoiceChannel,offlineReadiness,offlineSnapshot,submitOffline,registerOfflineRed,reissueRow,reissue,redReasons,redEligible,submitOnlineRed,onlineRedResult,normalizeInvoiceNumber,offlineNumberIssues};
})();
