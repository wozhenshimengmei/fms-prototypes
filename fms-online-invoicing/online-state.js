/* 本地模拟：登录认证按供应商＋税局账号维护，开票主体权限独立校验。 */
(function(){
  const F=window.FMS,C=window.FMSCatalog,oldLoad=F.load,oldInitial=F.initial;
  const invoiceProviders=[{id:'',name:'无'},{id:'baiwang',name:'百望'}];
  const taxAccount=a=>a?.taxUserName||a?.name||'';
  const pairKey=(taxNo,login)=>JSON.stringify([taxNo,login]);
  const sessionKey=a=>JSON.stringify([a.invoiceProvider||'none',taxAccount(a)]);
  const subjectKey=(a,c)=>JSON.stringify([a.invoiceProvider||'none',c.tax,taxAccount(a)]);
  const providerEnabled=a=>!!a?.invoiceProvider&&invoiceProviders.some(p=>p.id===a.invoiceProvider)&&a.onlineEnabled!==false;
  const currentUser=s=>s.users?.find(u=>u.id===s.currentUserId);
  function configuredAccount(s,userId=s.currentUserId){const found=s.accounts.filter(a=>a.userId===userId&&a.active!==false);return found.length===1?found[0]:undefined;}
  function clerkAccount(s,userId=s.currentUserId){
    const selected=s.loginSelections?.[userId];
    if(selected){const matches=s.accounts.filter(a=>a.active!==false&&taxAccount(a)===selected.login),source=matches.length===1?matches[0]:undefined;return {...source,id:source?.id||'LOGIN-'+userId,userId,sourceUserId:source?.userId||'',sourceAccountId:source?.id||'',isRuntimeLogin:true,name:selected.login,taxUserName:selected.login,subjects:source?.subjects||[],active:true,invoiceProvider:selected.invoiceProvider,onlineEnabled:!!selected.invoiceProvider};}
    return configuredAccount(s,userId)||s.loginWorkspaces?.[userId];
  }
  function useClerkAccount(s){const a=clerkAccount(s);s.account=a?.id||'';return a;}
  const accountOwned=(s,a)=>!!currentUser(s)&&a?.userId===s.currentUserId&&a.active!==false;
  function ownsSubject(s,c){const a=clerkAccount(s);if(!a||!currentUser(s))return false;if(!a.isRuntimeLogin)return c?.clerkUserId===s.currentUserId;const selected=s.loginSelections?.[s.currentUserId];return !!a.sourceUserId&&c?.clerkUserId===a.sourceUserId&&(a.sourceUserId===s.currentUserId||selected?.verified===true);}
  function resolveAccount(s,id){const current=clerkAccount(s);return current?.id===id?current:s.accounts.find(a=>a.id===id)||Object.values(s.loginWorkspaces||{}).find(a=>a.id===id);}
  function selectLoginAccount(s,username){const login=String(username||'').trim();if(!login)throw Error('请填写税局账号。');const current=useClerkAccount(s);if(!accountOwned(s,current)||!providerEnabled(current))throw Error('请先启用在线开票。');if(login===taxAccount(current))return current;s.loginSelections??={};s.loginSelections[s.currentUserId]={login,invoiceProvider:current.invoiceProvider,verified:false,changedAt:F.now()};return useClerkAccount(s);}
  function verifySelectedLogin(s){const selected=s.loginSelections?.[s.currentUserId];if(selected)selected.verified=true;}
  function switchUser(s,id){const user=s.users.find(u=>u.id===id);if(!user)throw Error('FMS用户不存在。');if(id!==s.currentUserId)s.loginSelections={};s.currentUserId=id;s.operator=user.name;useClerkAccount(s);identifyAccount(s);}
  const userSubjects=(s,id=s.currentUserId)=>s.subjects.filter(c=>c.clerkUserId===id);
  const allowedSubjects=s=>s.subjects.filter(c=>c.active&&ownsSubject(s,c));
  const freshAccount=()=>({status:'未登录',registered:false,username:'',stage:'idle',sessionOnline:false,faceRequired:false,lastSyncAt:'',lastSyncResult:'尚未同步',remoteOutcome:'offline',qrVersion:1,qrExpired:false,reason:''});
  function accountConnection(s,accountId=useClerkAccount(s)?.id){const a=resolveAccount(s,accountId);if(!a)return null;s.accountSessions??={};const key=sessionKey(a);return s.accountSessions[key]??=freshAccount();}
  function accountStatus(s){const a=clerkAccount(s);if(!a)return '未配置账号';if(!providerEnabled(a))return '未启用';const x=accountConnection(s,a.id);return x.registered&&x.status==='可开票'&&x.stage==='idle'?'有效':x.status;}
  function accountContext(s){const a=useClerkAccount(s);if(!accountOwned(s,a))throw Error('当前用户未配置有效税局账号。');if(!providerEnabled(a))throw Error('请先选择开票供应商启用在线开票。');return {a,x:accountConnection(s,a.id)};}
  function registerInvoiceProvider(provider){if(!provider?.id||!provider.name||invoiceProviders.some(p=>p.id===provider.id))throw Error('开票供应商配置无效或重复。');invoiceProviders.push({...provider});}
  function identifyAccount(s){const a=useClerkAccount(s);if(!a||!providerEnabled(a))return;const x=accountConnection(s,a.id);if(!['sms','login-query','report'].includes(x.stage))syncAccount(s);return x;}
  function setInvoiceProvider(s,id){if(!invoiceProviders.some(p=>p.id===id))throw Error('请选择已接入的开票供应商。');let a=useClerkAccount(s);if(!a){const u=currentUser(s);if(!u||u.department&&u.department!=='财资管理部门')throw Error('当前用户无在线开票操作权限。');s.loginWorkspaces??={};a=s.loginWorkspaces[u.id]??={id:'LOGIN-'+u.id,userId:u.id,name:'',taxUserName:'',subjects:[],active:true,invoiceProvider:'',onlineEnabled:false};}if(a.isRuntimeLogin)s.loginSelections[s.currentUserId].invoiceProvider=id;else{a.invoiceProvider=id;a.onlineEnabled=!!id;}a=useClerkAccount(s);identifyAccount(s);return a;}
  function connection(s,accountId,subjectId){const a=resolveAccount(s,accountId),c=F.subject(s,subjectId);if(!a||!c||(!a.subjects.includes(subjectId)&&c.clerkUserId!==(a.sourceUserId||a.userId)))return null;s.taxSessions??={};const key=subjectKey(a,c);if(!s.taxSessions[key])s.taxSessions[key]={subjectId:c.id,taxNo:c.tax,taxUserName:taxAccount(a),subjectTaxNo:c.tax,status:a.subjects.includes(c.id)?'可开票':'账号无权',remoteOutcome:'online',checkedTaxNo:'',lastSyncAt:'',reason:''};return s.taxSessions[key];}
  function subjectContext(s,id){const {a,x:auth}=accountContext(s),c=F.subject(s,id);if(!c?.active)throw Error('当前主体无效，请核对集团主体资料。');if(!c.tax)throw Error('请补充当前主体纳税人识别号。');if(!ownsSubject(s,c))throw Error('当前登录税局账号未关联该主体，或尚未完成代开认证。');return {a,auth,c,x:connection(s,a.id,id)};}
  function migrate(s){
    s.users??=[{id:'U01',name:'占旭婷'},{id:'U02',name:'财务乙'},{id:'U03',name:'财务丙'}];
    if(!s.userAccountVersion){const unique=name=>{const us=s.users.filter(u=>u.name===name);return us.length===1?us[0].id:'';};s.currentUserId=unique(s.operator);for(const c of s.subjects)c.clerkUserId=unique(c.clerk);const seen=new Set();for(const a of s.accounts){a.userId=unique(a.owner);a.active=!seen.has(a.userId);seen.add(a.userId);}s.userAccountVersion=1;}
    s.accountSessions??={};s.taxSessions??={};
    if(!s.accountAuthVersion){for(const x of Object.values(s.taxSessions)){if(!['税号不符','账号无权','待校验'].includes(x.status))x.status='可开票';x.remoteOutcome=x.status==='税号不符'?'mismatch':'online';for(const field of ['registered','stage','username','sessionOnline','faceRequired','qrExpired','qrVersion'])delete x[field];}s.accountAuthVersion=1;}
    for(const i of s.items){if(i.projectId===undefined)i.projectId=C.byName(i.project)?.id||'';i.taxCode=C.find(i.projectId)?.code??null;}
    for(const a of s.accounts){if(a.invoiceProvider===undefined){a.invoiceProvider='';a.onlineEnabled=false;}const demo=a.id==='A01'?'13800138000':a.id==='A03'?'13900139000':'';if(demo&&[a.name,a.taxUserName].some(v=>['DEMO-雅才联合账号','DEMO-其他主体账号'].includes(v))){a.name=demo;a.taxUserName=demo;}a.taxUserName??=a.name;a.active??=true;a.onlineEnabled??=!!a.invoiceProvider;const x=accountConnection(s,a.id);a.lastSyncAt=x.lastSyncAt;a.lastSyncResult=x.lastSyncResult;}
    useClerkAccount(s);return s;
  }
  F.load=()=>migrate(oldLoad());F.initial=()=>migrate(oldInitial());
  function syncAccount(s,outcome){const {a,x}=accountContext(s);outcome=outcome||x.remoteOutcome;x.remoteOutcome=outcome;x.lastSyncAt=F.now();
    if(outcome==='error'){x.status='状态待确认';x.lastSyncResult='同步失败';x.reason='账号状态同步失败，请重新同步。';}
    else if(!x.registered){x.status='未登录';x.lastSyncResult='未登录';x.reason='请登录并保存当前税局账号。';}
    else if(outcome==='offline'){x.status='认证失效';x.sessionOnline=false;x.faceRequired=false;x.stage='idle';x.lastSyncResult='账号离线';x.reason='税局账号连接已断开，请重新登录。';}
    else{x.sessionOnline=true;x.faceRequired=outcome==='face';x.stage=x.faceRequired?'face':'idle';x.status=x.faceRequired?'待认证':'可开票';x.lastSyncResult=x.faceRequired?'需实人认证':'账号有效';x.reason=x.faceRequired?'当前税局账号需要实人认证。':'当前税局账号有效。';}
    a.lastSyncAt=x.lastSyncAt;a.lastSyncResult=x.lastSyncResult;return x;
  }
  function probe(s,id,outcome){const {a,auth,c,x}=subjectContext(s,id);if(outcome&&['offline','face','error'].includes(outcome)){syncAccount(s,outcome);return x;}if(!auth.registered||auth.status!=='可开票')return x;outcome=outcome||x.remoteOutcome;x.remoteOutcome=outcome;x.lastSyncAt=F.now();
    x.lastStatusRequest={online:{taxNo:c.tax,username:taxAccount(a)},face:{taxNo:c.tax,taxUserName:taxAccount(a)}};
    if(!a.subjects.includes(id)){x.status='账号无权';x.reason='当前税局账号无该主体权限';x.checkedTaxNo='';}
    else if(outcome==='mismatch'){x.status='税号不符';x.reason='开票主体税号校验不符，请检查集团主体资料及税局授权。';x.checkedTaxNo='DEMO-OTHER-TAXNO';}
    else{x.status='可开票';x.subjectTaxNo=c.tax;x.checkedTaxNo=c.tax;x.reason='';}return x;
  }
  function preflight(s,rs){const a=useClerkAccount(s);if(!accountOwned(s,a)||!providerEnabled(a))return;const auth=accountConnection(s,a.id);if(!auth.registered||auth.stage!=='idle')return;syncAccount(s);if(accountStatus(s)!=='有效')return;const seen=new Set();for(const r of rs){const c=F.subject(s,r.subject),key=pairKey(c?.tax,taxAccount(a));if(!seen.has(key)&&c?.active&&c.tax&&ownsSubject(s,c)){probe(s,r.subject);seen.add(key);}}}
  function startLogin(s,username){selectLoginAccount(s,username);const {x}=accountContext(s);x.pendingUsername=username.trim();x.stage='login-query';x.status='登录中';x.sessionOnline=false;x.remoteOutcome='offline';x.reason='等待税局返回最终登录结果。';return x;}
  function loginResult(s,result){const {x}=accountContext(s);if(x.stage!=='login-query')throw Error('请先发起登录，再查询登录结果。');if(result==='pending'){x.reason='税局仍在处理中，请稍后继续查询。';return x;}if(result==='failed'){x.stage='idle';x.status=x.registered?'认证失效':'未登录';x.reason='演示登录失败，请重新登录。';return x;}if(x.pendingUsername&&x.pendingUsername!==x.username)x.registered=false;x.sessionOnline=true;x.faceRequired=result==='face';x.remoteOutcome=x.faceRequired?'face':'online';x.stage=x.registered?(x.faceRequired?'face':'idle'):'report';x.status=x.stage==='report'?'账号待保存':x.faceRequired?'待认证':'可开票';x.reason=x.stage==='report'?'登录已成功，请完成账号上报保存。':x.faceRequired?'请完成当前税局账号的实人认证。':'登录成功。';if(x.stage==='idle')verifySelectedLogin(s);return x;}
  function reportAccount(s,username,success){const {x}=accountContext(s);if(x.stage!=='report')throw Error('当前没有待保存的登录账号。');if(!success){x.reason='账号上报保存失败，请重试；当前不能提交开票。';return x;}x.registered=true;x.username=x.pendingUsername||username;delete x.pendingUsername;x.stage=x.faceRequired?'face':'idle';x.status=x.faceRequired?'待认证':'可开票';x.reason=x.faceRequired?'账号已保存，待实人认证。':'账号已保存。';if(x.stage==='idle')verifySelectedLogin(s);return x;}
  function faceResult(s,result){const {x}=accountContext(s);if(!x.sessionOnline||x.stage!=='face')throw Error('请先登录税局账号并发起实人认证。');if(x.qrExpired)throw Error('认证二维码已失效，请刷新后重试。');if(result!=='success'){x.reason=result==='pending'?'尚未完成扫码，请继续查询认证结果。':'认证未通过，请重新扫码。';return x;}x.faceRequired=false;x.remoteOutcome='online';x.stage='idle';x.status='可开票';x.reason='当前税局账号认证成功。';verifySelectedLogin(s);return x;}
  function invalidate(s,id){const c=F.subject(s,id);for(const a of s.accounts)if(a.subjects.includes(id)||c.clerkUserId===a.userId){const x=connection(s,a.id,id);x.status='待校验';x.reason='主体税号已变更，提交前重新校验；无需重新登录税局账号。';}}
  function saveClerkAccount(s,id,data){
    const u=s.users.find(u=>u.id===data.userId),login=String(data.taxUserName||'').trim(),existing=s.accounts.find(a=>a.id===id);
    if(!u||!login)throw Error('请选择开票员并填写税局账号。');
    if(s.accounts.some(a=>a.id!==id&&a.userId===u.id))throw Error('该开票员已有账号配置，请编辑原记录。');
    const oldUserId=existing?.userId,selected=data.subjectIds===undefined?userSubjects(s,oldUserId||u.id).map(c=>c.id):data.subjectIds;
    if(!Array.isArray(selected))throw Error('请选择有效的关联主体。');
    const subjectIds=[...new Set(selected.map(String))];
    for(const subjectId of subjectIds){const c=F.subject(s,subjectId);if(!c||(!c.active&&!(existing&&c.clerkUserId===oldUserId)))throw Error('关联主体不存在或已无效，请重新选择。');if(c.clerkUserId&&c.clerkUserId!==u.id){const owner=s.users.find(v=>v.id===c.clerkUserId)?.name||'其他开票员',confirmed=data.transferConfirmations?.find(v=>v.subjectId===subjectId&&v.fromUserId===c.clerkUserId&&v.toUserId===u.id);if(!confirmed)throw Error(`${c.name}已关联开票员${owner}，请重新选择该主体并确认变更关联。`);}}
    let a=existing;if(!a){a={id:'AC-'+(s.accounts.length+1)+'-'+Date.now(),subjects:[],invoiceProvider:'',onlineEnabled:false};s.accounts.push(a);}
    const changed=taxAccount(a)!==login||a.userId!==u.id;
    for(const c of s.subjects){if(subjectIds.includes(c.id)){c.clerkUserId=u.id;c.clerk=u.name;}else if(c.clerkUserId===(oldUserId||u.id)){c.clerkUserId='';c.clerk='';}}
    Object.assign(a,{userId:u.id,owner:u.name,name:login,taxUserName:login,active:!!data.active,updatedAt:F.now()});
    if(changed){a.subjects=[];delete s.accountSessions?.[sessionKey(a)];a.lastSyncAt='';a.lastSyncResult='';}
    accountConnection(s,a.id);useClerkAccount(s);return a;
  }
  Object.assign(F,{invoiceProviders,registerInvoiceProvider,setInvoiceProvider,providerEnabled,accountStatus,accountConnection,pairKey,taxAccount,currentUser,ownsSubject,accountOwned,configuredAccount,clerkAccount,useClerkAccount,selectLoginAccount,switchUser,userSubjects,allowedSubjects,connection,onlineContext:accountContext,probe,probeAll:syncAccount,syncAccount,preflight,startLogin,loginResult,reportAccount,faceResult,invalidateSubjectTax:invalidate,saveClerkAccount,identifyAccount});
})();
