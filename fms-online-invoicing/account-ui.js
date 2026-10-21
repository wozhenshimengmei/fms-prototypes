(function(){
  window.FMSAccountUI={create(ctx){
    const {F,ui,esc,$,btn,link,tag,options,table,openModal,closeModal,render,persist,toast}=ctx,state=()=>ctx.getState();
    let confirmations=new Map(),queue=[],pending=null,retainedInactive=new Set();
    const selectedIds=()=>Array.from($('clerk-subjects')?.selectedOptions||[]).map(o=>o.value);
    const originalUser=()=>state().accounts.find(a=>a.id===ui.accountEditId)?.userId;
    const draftIds=()=>[...selectedIds(),...retainedInactive];
    const eligible=c=>c&&(c.active||c.clerkUserId===originalUser());
    const ownerName=id=>state().users.find(u=>u.id===id)?.name||'其他开票员';
    function page(){const s=state();return `<section class="fms-panel grow config"><div class="section-toolbar"><h2>开票员账号配置</h2>${btn('新增配置','clerk-account-add','','primary')}</div>${table(['开票员','税局账号','关联主体','状态','修改时间','操作'],[100,210,300,90,170,90],s.accounts.filter(a=>a.userId).map(a=>`<tr><td>${esc(s.users.find(u=>u.id===a.userId)?.name||'用户不存在')}</td><td>${esc(F.taxAccount(a))}</td><td>${esc(F.userSubjects(s,a.userId).map(c=>c.name).join('、')||'暂无关联主体')}</td><td>${tag(a.active?'有效':'停用',a.active?'success':'neutral')}</td><td>${esc(a.updatedAt||'—')}</td><td class="fixed-action">${link('编辑','clerk-account-edit',a.id)}</td></tr>`).join(''),'开票员账号配置列表')}</section>`;}
    function subjectOptions(userId,chosen){return state().subjects.filter(c=>c.active).map(c=>{const occupied=!!c.clerkUserId&&c.clerkUserId!==userId;return `<option value="${esc(c.id)}" ${chosen.includes(c.id)?'selected':''}>${esc(c.name)}${occupied?'（已关联'+esc(ownerName(c.clerkUserId))+'）':''}</option>`;}).join('');}
    function setSelected(id,selected){const c=F.subject(state(),id);if(c&&!c.active){if(selected)retainedInactive.add(id);else retainedInactive.delete(id);const row=$('inactive-subject-'+id);if(row)row.hidden=!selected;}const select=$('clerk-subjects');for(const option of Array.from(select?.options||[]))if(option.value===id)option.selected=selected;const jq=window.jQuery;if(jq?.fn?.select2)jq('#clerk-subjects').trigger('change.select2');}
    function resetTransfers(){confirmations.clear();queue=[];pending=null;const dialog=$('subject-transfer-modal');if(dialog?.open)dialog.close();}
    function nextTransfer(){
      if(pending||!queue.length)return;
      const subjectId=queue.shift(),c=F.subject(state(),subjectId),target=$('clerk-user').value;
      if(!eligible(c)||!target){nextTransfer();return;}
      if(!c.clerkUserId||c.clerkUserId===target){setSelected(subjectId,true);nextTransfer();return;}
      pending={subjectId,fromUserId:c.clerkUserId,toUserId:target};
      $('subject-transfer-body').innerHTML=`<p>主体“${esc(c.name)}”当前已关联开票员“${esc(ownerName(c.clerkUserId))}”。是否解除原关联，并将该主体关联至开票员“${esc(ownerName(target))}”？</p><p>点击保存后生效。</p>`;
      const jq=window.jQuery;if(jq?.fn?.select2)jq('#clerk-subjects').select2('close');
      $('subject-transfer-modal').showModal();
    }
    function finishTransfer(confirmed){
      const choice=pending;if(!choice)return;
      $('subject-transfer-modal').close();pending=null;
      if(confirmed){const c=F.subject(state(),choice.subjectId),target=$('clerk-user').value;
        if(c?.clerkUserId===choice.fromUserId&&target===choice.toUserId&&eligible(c)){confirmations.set(choice.subjectId,choice);setSelected(choice.subjectId,true);}
        else{queue.unshift(choice.subjectId);toast('主体关联或开票员已变化，请重新确认。','error');}
      }
      nextTransfer();
    }
    function reviewSelection(){
      const target=$('clerk-user').value,chosen=draftIds();
      for(const [id,choice] of confirmations)if(!chosen.includes(id)||choice.toUserId!==target)confirmations.delete(id);
      for(const id of chosen){const c=F.subject(state(),id),choice=confirmations.get(id);
        if(!c?.clerkUserId||c.clerkUserId===target)continue;
        if(choice?.fromUserId===c.clerkUserId&&choice.toUserId===target)continue;
        setSelected(id,false);
        if(!target){toast('请先选择开票员。','error');continue;}
        if(pending?.subjectId!==id&&!queue.includes(id))queue.push(id);
      }
      nextTransfer();
    }
    $('subject-transfer-modal')?.addEventListener('cancel',e=>{e.preventDefault();finishTransfer(false);});
    function edit(id=''){
      resetTransfers();const s=state(),a=s.accounts.find(a=>a.id===id),assigned=a?F.userSubjects(s,a.userId):[];ui.modalKind='clerk-account';ui.accountEditId=id;retainedInactive=new Set(assigned.filter(c=>!c.active).map(c=>c.id));
      openModal(a?'修改开票员账号':'新增开票员账号',`<div class="fms-form"><div class="fms-field full"><label for="clerk-user">开票员<span class="required"> *</span></label><select class="form-control" id="clerk-user"><option value="">请选择开票员</option>${options(F.clerkCandidates(s,a?.userId).map(u=>[u.id,u.name+(u.department!=='财资管理部门'?'（原已配置）':'')]),a?.userId,false)}</select></div><div class="fms-field full"><label for="clerk-tax-account">税局账号<span class="required"> *</span></label><input class="form-control" id="clerk-tax-account" value="${esc(F.taxAccount(a))}" placeholder="请输入税局登录账号" autocomplete="off"></div><div class="fms-field full clerk-subject-field"><label for="clerk-subjects">关联主体</label><select class="form-control" id="clerk-subjects" multiple size="4">${subjectOptions(a?.userId||'',assigned.map(c=>c.id))}</select></div>${assigned.filter(c=>!c.active).map(c=>`<div class="fms-field full" id="inactive-subject-${esc(c.id)}"><label></label>${tag(c.name+'（无效）','neutral')}</div>`).join('')}<div class="fms-field full"><label>状态</label><label class="checkbox-label"><input type="checkbox" id="clerk-active" ${a?.active!==false?'checked':''}>有效</label></div></div>`,btn('取消','close')+btn('保存','clerk-account-save',id,'primary'));
      const jq=window.jQuery;if(jq?.fn?.select2)jq('#clerk-subjects').select2({width:'100%',dropdownParent:jq('#modal'),placeholder:'请选择关联主体',closeOnSelect:false,allowClear:true}).on('change.fmsClerkSubjects',reviewSelection);
    }
    function change(t){
      if(t.id==='clerk-subjects'){reviewSelection();return true;}
      if(t.id!=='clerk-user')return false;
      const select=$('clerk-subjects'),chosen=selectedIds();resetTransfers();
      if(select){select.innerHTML=subjectOptions(t.value,chosen);const jq=window.jQuery;if(jq?.fn?.select2)jq('#clerk-subjects').trigger('change.select2');reviewSelection();}
      return true;
    }
    function act(action,id){
      if(action==='clerk-accounts'){ctx.navigate('accounts');return true;}
      if(action==='clerk-account-add'){edit();return true;}
      if(action==='clerk-account-edit'){edit(id);return true;}
      if(action==='clerk-transfer-confirm'){finishTransfer(true);return true;}
      if(action==='clerk-transfer-cancel'){finishTransfer(false);return true;}
      if(action==='close'&&ui.modalKind==='clerk-account'){resetTransfers();closeModal();return true;}
      if(action!=='clerk-account-save')return false;
      if(pending||queue.length)throw Error('请先确认或取消主体关联变更。');
      F.saveClerkAccount(state(),id,{userId:$('clerk-user').value,taxUserName:$('clerk-tax-account').value,active:$('clerk-active').checked,subjectIds:draftIds(),transferConfirmations:Array.from(confirmations.values())});
      persist();ui.authSubject='';ui.settingsSubject='';resetTransfers();closeModal();render();toast('开票员账号配置已保存。','success');return true;
    }
    return {page,act,change};
  }};
})();
