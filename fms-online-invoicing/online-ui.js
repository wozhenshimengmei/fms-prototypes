(function(){
  window.FMSOnlineUI={create(ctx){
    const {F,ui,esc,$,btn,link,tag,note,kv,options,openModal,closeModal,render,navigate,toast,persist,showConfirmation}=ctx;
    const state=()=>ctx.getState(),account=()=>F.useClerkAccount(state());
    const connection=()=>F.accountConnection(state(),account()?.id);
    const authKey=()=>JSON.stringify([state().currentUserId,account()?.invoiceProvider,F.taxAccount(account())]);
    const statusColor=value=>value==='可开票'?'success':['未启用','未登录'].includes(value)?'neutral':['税号不符','同步失败'].includes(value)?'error':'warning';
    function route(){const from=ui.modalKind==='confirm'||ui.modalKind==='validation';ui.settingsReturnSelection=from;ui.settingsFromInvoices=ui.page==='invoices';ui.authAccountKey='';if($('modal').open)closeModal();navigate('invoices');$('online-invoice-settings')?.scrollIntoView?.({block:'start'});}
    function page(){const a=account(),enabled=F.providerEnabled(a),x=connection(),busy=x&&['sms','login-query','report'].includes(x.stage),status=F.accountStatus(state());
      const title=`<div class="section-toolbar"><h2>在线开票设置</h2>${ui.settingsReturnSelection?btn('返回开票核对','settings-return'):''}</div>`;
      const provider=`<div class="online-setting-row"><label for="settings-provider">开票供应商</label><select id="settings-provider" class="form-control" ${!F.currentUser(state())?'disabled':''}>${options(F.invoiceProviders.map(p=>[p.id,p.name]),a?.invoiceProvider||'',false)}</select></div>`;
      const details=enabled?`<div class="online-setting-row"><label for="settings-account">税局账号</label><input id="settings-account" class="form-control" value="${esc(F.taxAccount(a))}" readonly></div><div class="online-setting-row online-settings-status"><span class="online-setting-label">账号状态</span>${tag(status,status==='有效'?'success':['未启用','未登录'].includes(status)?'neutral':'warning')}<div class="online-settings-inline-actions">${btn(busy?'继续登录认证':x.stage==='face'?'实人认证':status==='有效'?'重新登录':'登录','settings-auth','','primary')}${btn('同步账号状态','settings-probe','','secondary',busy?'disabled':'')}</div><span class="online-settings-sync">最后同步时间：${esc(x.lastSyncAt||'尚未同步')}</span></div><details class="settings-demo"><summary>账号状态模拟</summary><label for="probe-demo">本次同步模拟结果</label><select id="probe-demo" class="form-control">${options([['online','账号在线，无需扫码'],['face','账号在线，需实人认证'],['offline','账号离线 / 认证失效'],['error','同步失败，状态未知']],x.remoteOutcome||'online',false)}</select>${link('模拟首次登录','settings-first')}</details>`:'';
      return `<section id="online-invoice-settings" class="fms-panel settings-panel invoice-online-settings">${title}<div class="online-settings-fields">${provider}${details}</div></section>`;
    }
    function auth(){const {a,x}=F.onlineContext(state());if(ui.modalKind==='auth'&&ui.authAccountKey&&ui.authAccountKey!==authKey())throw Error('当前税局账号或供应商已变化，请重新进入登录认证。');ui.modalKind='auth';ui.authAccountKey=authKey();const stage=ui.authEdit?'login':x.stage;let body='',actions='';
      if(stage==='sms'){body=`<div class="fms-form"><div class="fms-field full"><label for="auth-code">手机验证码</label><input class="form-control" id="auth-code" maxlength="6" placeholder="请输入验证码" autocomplete="off"></div></div>`;actions=btn('登录','auth-sms','','primary')+btn('重新获取验证码','auth-resend');}
      else if(stage==='login-query'){body=note(esc(x.reason));actions=btn('查询登录结果','auth-query','','primary');body+=`<details class="demo-tools" open><summary>模拟登录返回</summary>${btn('模拟登录成功','auth-query-result','success')}${btn('模拟需扫码认证','auth-query-result','face')}${btn('模拟登录处理中','auth-query-result','pending')}${btn('模拟登录失败','auth-query-result','failed')}</details>`;}
      else if(stage==='report'){body=note(esc(x.reason),x.reason.includes('失败')?'warning':'');actions=btn('上报并保存账号','auth-report','','primary');body+=`<details class="demo-tools"><summary>模拟账号保存失败</summary>${btn('模拟上报失败','auth-report-fail')}</details>`;}
      else if(stage==='face'){actions=btn('更换登录账号','auth-change');body=note(esc(x.reason||'账号在线，请完成当前税局账号的实人认证。'),'warning')+`<div class="auth-center"><div class="auth-qr"><span>${x.qrExpired?'二维码已失效':'二维码'}</span></div><p>请由对应办税人员完成扫码</p>${btn('查询认证结果','auth-face-query','','primary')}${btn('刷新二维码','auth-qr-refresh')}</div><details class="demo-tools" open><summary>模拟认证返回</summary>${btn('模拟认证通过','auth-success')}${btn('模拟认证未通过','auth-fail')}${btn('模拟二维码失效','auth-qr-expire')}</details>`;}
      else if(x.registered&&!ui.authEdit){body=note(esc(x.status==='可开票'?'账号已保存。':x.reason||'请使用已保存账号重新登录认证。'),x.status==='可开票'?'success':'warning');actions=btn('使用已保存账号重新认证','auth-resume','','primary')+btn('更换登录账号','auth-change');}
      else{body=`<div class="login-modes">${btn('账号密码登录','auth-mode','password',ui.loginMode==='password'?'primary':'secondary')}${btn('手机验证码登录','auth-mode','phone',ui.loginMode==='phone'?'primary':'secondary')}</div><div class="fms-form"><div class="fms-field"><label for="auth-user">${ui.loginMode==='phone'?'手机号':'税局账号'}</label><input class="form-control" id="auth-user" value="${esc(ui.loginDraft??F.taxAccount(a))}" autocomplete="off"></div>${ui.loginMode==='password'?'<div class="fms-field"><label for="auth-password">密码</label><input class="form-control" id="auth-password" type="password" autocomplete="off" placeholder="请输入密码"></div>':''}</div>`;actions=btn(ui.loginMode==='phone'?'获取验证码':'登录','auth-login','','primary');}
      openModal('税局登录与认证',`<div class="auth-identity">税局账号：${esc(F.taxAccount(a))}<br>账号保存：${x.registered?'已保存':'待保存'}　${tag(x.status,statusColor(x.status))}</div>${body}${actions?`<div class="auth-action-row">${actions}</div>`:''}`,btn('关闭','auth-back'));
    }
    const actions=new Set(['auth','auth-return','settings-auth','settings-probe','settings-first','settings-return','auth-mode','auth-change','auth-login','auth-sms','auth-resend','auth-query','auth-query-result','auth-report','auth-report-fail','auth-success','auth-fail','auth-face-query','auth-qr-refresh','auth-qr-expire','auth-expire','auth-resume','auth-back']);
    async function act(action,id){if(!actions.has(action))return false;const s=state();
      if(action==='auth'||action==='auth-return'){route();return true;}
      if(action==='settings-return'){const confirm=ui.settingsReturnSelection;ui.settingsReturnSelection=false;ui.settingsFromInvoices=false;navigate('invoices');if(confirm)showConfirmation(ui.confirmKeys);return true;}
      const a=account();
      if(action==='auth-back'){ui.authEdit=false;ui.authAccountKey='';ui.loginDraft=undefined;closeModal();render();return true;}
      if(action==='settings-probe'){F.syncAccount(s);persist();render();toast('账号状态已同步。');return true;}
      if(action==='settings-first'){const x=connection();Object.assign(x,{registered:false,username:'',stage:'idle',status:'未登录',sessionOnline:false,faceRequired:false,remoteOutcome:'offline',reason:''});persist();render();return true;}
      if(ui.modalKind==='auth'&&ui.authAccountKey!==authKey())throw Error('当前税局账号或供应商已变化，请重新进入登录认证。');
      const {x}=F.onlineContext(s);
      switch(action){
        case 'settings-auth':ui.authAccountKey='';ui.loginDraft=F.taxAccount(a);ui.authEdit=x.stage==='idle';auth();break;
        case 'auth-change':ui.authEdit=true;ui.loginDraft=F.taxAccount(a);auth();break;
        case 'auth-mode':ui.loginDraft=$('auth-user')?.value?.trim()||ui.loginDraft||F.taxAccount(a);ui.loginMode=id;auth();break;
        case 'auth-login':{ui.loginDraft=$('auth-user').value.trim();if(!ui.loginDraft||(ui.loginMode==='password'&&!$('auth-password').value))throw Error('请填写账号及密码。');if(ui.loginMode==='phone'&&!/^1\d{10}$/.test(ui.loginDraft))throw Error('请输入11位手机号。');ui.authEdit=false;if(ui.loginMode==='phone'){F.selectLoginAccount(s,ui.loginDraft);const target=connection();target.stage='sms';target.status='登录中';target.sessionOnline=false;target.pendingUsername=ui.loginDraft;target.remoteOutcome='offline';}else F.startLogin(s,ui.loginDraft);ui.authAccountKey=authKey();persist();render();auth();break;}
        case 'auth-sms':if($('auth-code').value!=='123456')throw Error('验证码错误，请重新输入。');F.startLogin(s,ui.loginDraft);persist();render();auth();break;
        case 'auth-resend':toast('验证码请求已提交。');break;
        case 'auth-resume':ui.authEdit=false;ui.loginDraft=F.taxAccount(account());F.startLogin(s,ui.loginDraft);persist();render();auth();break;
        case 'auth-query':F.loginResult(s,'pending');persist();render();auth();break;
        case 'auth-query-result':F.loginResult(s,id);persist();render();auth();break;
        case 'auth-report':case 'auth-report-fail':F.reportAccount(s,ui.loginDraft||x.username||F.taxAccount(account()),action==='auth-report');persist();render();auth();break;
        case 'auth-success':F.faceResult(s,'success');persist();render();auth();toast('认证成功。','success');break;
        case 'auth-fail':case 'auth-face-query':F.faceResult(s,action==='auth-fail'?'failed':'pending');persist();auth();break;
        case 'auth-qr-expire':x.qrExpired=true;x.reason='认证二维码已失效，请刷新二维码。';persist();auth();break;
        case 'auth-qr-refresh':x.qrExpired=false;x.qrVersion++;x.reason='已刷新演示二维码，请重新扫码认证。';persist();auth();break;
        case 'auth-expire':F.syncAccount(s,'offline');persist();render();auth();break;
      }
      return true;
    }
    function change(t){if(t.id==='settings-provider'){try{F.setInvoiceProvider(state(),t.value);ui.authAccountKey='';persist();render();}catch(e){toast(e.message,'error');render();}return true;}if(t.id!=='probe-demo')return false;connection().remoteOutcome=t.value;persist();return true;}

    return {page,auth,act,change,route};
  }};
})();
