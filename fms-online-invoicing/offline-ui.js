/* 线下票号逐条录入、清单回填和最终汇总共用同一份本地草稿。 */
(function(){window.FMSOfflineUI={create(ctx){
  const {F,ui,$,esc,btn,tag,note,openModal,toast}=ctx,state=()=>ctx.getState();
  let draft=null,version=0;
  function open(keys,parentId=''){
    const ids=[...new Set(keys)];if(!ids.length)throw Error('请先选择需要登记的费用。');
    const s=state(),rows=parentId?F.reissueRows(s,parentId):F.rows(s).filter(r=>ids.includes(r.key));if(!rows.length)throw Error('所选费用已变化，请重新选择。');
    const owner=s.currentUserId,old=draft?.owner===owner&&draft?.parentId===parentId?draft.numbers:{};
    draft={rows:F.clone(rows),numbers:{...old},owner,parentId,page:1,preview:null,raw:null,stage:'entry',expected:JSON.stringify(rows.map(r=>F.offlineSnapshot(s,r)))};version++;dialog();
  }
  function checkOwner(){if(!draft||draft.owner!==state().currentUserId)throw Error('登记人员已变化，请重新选择费用。');}
  function errorFor(r){const current=F.rows(state()).find(x=>x.key===r.key);if(!current)return '来源或开票配置已变化';const errors=F.offlineReadiness(state(),current);if(draft.numbers[r.key])errors.push(...F.offlineNumberIssues(state(),current,draft.numbers[r.key]));return errors.join('；');}
  function dialog(){checkOwner();ui.modalKind='offline-entry';draft.stage='entry';const total=draft.rows.length,pages=Math.max(1,Math.ceil(total/10));draft.page=Math.min(pages,Math.max(1,draft.page));const rows=draft.rows.slice((draft.page-1)*10,draft.page*10);
    const body=`<div class="offline-number-tools">${btn('导出清单','offline-export')}<label class="btn secondary offline-upload-label" for="offline-number-file">导入号码</label><input id="offline-number-file" class="offline-file-input" type="file" accept=".xlsx,.csv" aria-label="导入线下发票号码清单"></div><div class="offline-number-scroll"><table class="fms-table" aria-label="线下发票号码录入"><colgroup><col style="width:180px"><col style="width:85px"><col style="width:150px"><col style="width:175px"><col style="width:200px"><col style="width:70px"><col style="width:80px"><col style="width:115px"><col style="width:260px"></colgroup><thead><tr><th>门店 / ID</th><th>账期</th><th>开票主体</th><th>科目名称</th><th>开票项目</th><th>税率</th><th>发票种类</th><th>含税金额（元）</th><th>发票号码<span class="required"> *</span></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(F.store(state(),r.store)?.name)}<span class="subtle">${esc(r.store)}</span></td><td>${esc(r.month)}</td><td>${esc(F.subject(state(),r.subject)?.short)}</td><td>${esc(r.kind==='财务费用'?'财务费用':r.fees.map(f=>f.itemName).join('、'))}</td><td>${esc(r.fees[0]?.project)}</td><td>${esc(r.rate)}%</td><td>${esc(F.store(state(),r.store)?.invoiceKind||'未维护')}</td><td class="amount">${F.money(r.amount)}</td><td><input class="form-control offline-number-input" inputmode="numeric" type="text" data-offline-number="${esc(r.key)}" aria-label="${esc(r.store+' '+r.month+' '+r.subject+' '+r.kind)}发票号码" value="${esc(draft.numbers[r.key]||'')}" placeholder="请输入实际发票号码"><span class="offline-row-error">${esc(errorFor(r))}</span></td></tr>`).join('')}</tbody></table></div><div class="pager"><span>共 ${total} 条，已填 ${draft.rows.filter(r=>String(draft.numbers[r.key]||'').trim()).length} 条</span>${btn('上一页','offline-page','prev','secondary',draft.page<=1?'disabled':'')}<span>${draft.page} / ${pages}</span>${btn('下一页','offline-page','next','secondary',draft.page>=pages?'disabled':'')}</div>`;
    openModal(draft.parentId?'线下重开发票号码':'线下发票号码录入',body,btn('取消','close')+btn('下一步','offline-next','','primary'),true);
  }
  function input(t){if(!t.dataset.offlineNumber)return false;checkOwner();draft.numbers[t.dataset.offlineNumber]=t.value;return true;}
  function capture(){for(const e of document.querySelectorAll('[data-offline-number]'))input(e);}
  function exportNumbers(){checkOwner();capture();const data=F.offlineExport(state(),draft.rows,draft.numbers);FMSFile.template({id:'offline-numbers',name:'线下发票号码',templateName:'线下发票号码回填清单.xlsx',fields:F.offlineHeaders.map(label=>({label})),rows:data.slice(1)});toast('已导出所选记录。');}
  function validatePreview(){checkOwner();draft.preview=F.previewOfflineNumbers(state(),draft.rows,draft.raw,draft.numbers,draft.parentId);return draft.preview;}
  function preview(overwrite=false){const rows=validatePreview(),invalid=rows.some(v=>v.issues.length),changed=rows.filter(v=>v.old&&v.old!==v.number).length;draft.stage=overwrite?'overwrite':'preview';ui.modalKind='offline-import';
    openModal(overwrite?'确认覆盖已填号码':'线下票号导入预览',`${overwrite?note(`本次将覆盖 ${changed} 条已填号码。确认后仅替换匹配项，是否继续？`,'warning'):''}<div class="offline-number-scroll"><table class="fms-table" aria-label="线下票号回填预览"><thead><tr><th>行号</th><th>门店 / 账期 / 主体</th><th>原号码</th><th>本次号码</th><th>校验结果</th></tr></thead><tbody>${rows.map(v=>`<tr><td>${v.line}</td><td>${esc(v.r?v.r.store+' / '+v.r.month+' / '+F.subject(state(),v.r.subject)?.short:v.key)}</td><td>${esc(v.old||'—')}</td><td>${esc(v.number||'—')}</td><td>${esc(v.issues.length?v.issues.join('；'):!v.number?'未填写，登记时将跳过':v.old&&v.old!==v.number?'确认后覆盖':'通过')}</td></tr>`).join('')}</tbody></table></div>`,btn('返回录入','offline-back')+btn(overwrite?'确认覆盖':'确认回填',overwrite?'offline-import-commit':'offline-import-save','','primary',invalid?'disabled':''),true);
  }
  async function change(t){if(t.id!=='offline-number-file')return false;checkOwner();capture();const file=t.files?.[0];if(!file)return true;const current=version;const raw=await FMSFile.read(file);if(version!==current||ui.modalKind!=='offline-entry')return true;draft.raw=raw;preview();return true;}
  function act(action,id){if(!action.startsWith('offline-')||['offline-red','offline-red-confirm','offline-red-back','offline-red-register'].includes(action))return false;
    switch(action){
      case 'offline-back':dialog();return true;
      case 'offline-page':capture();draft.page+=id==='next'?1:-1;dialog();return true;
      case 'offline-export':exportNumbers();return true;
      case 'offline-next':checkOwner();capture();if(!draft.rows.some(r=>String(draft.numbers[r.key]||'').trim()))throw Error('请先填写或导入实际发票号码。');draft.stage='confirm';ctx.confirm(draft);return true;
      case 'offline-import-save':{const v=validatePreview();if(v.some(v=>v.issues.length))throw Error('请修正清单异常后重新导入。');if(v.some(v=>v.old&&v.old!==v.number))preview(true);else applyPreview();return true;}
      case 'offline-import-commit':if(draft.stage!=='overwrite')throw Error('请重新确认覆盖。');applyPreview();return true;
      default:return false;
    }
  }
  function applyPreview(){const rows=validatePreview();if(rows.some(v=>v.issues.length))throw Error('数据已变化，请重新导出核对。');for(const v of rows)draft.numbers[v.key]=v.number;draft.preview=null;draft.raw=null;dialog();toast('已回填 '+rows.length+' 条号码，尚未登记。','success');}
  function numbers(){checkOwner();return {...draft.numbers};}
  function expected(){checkOwner();return draft.expected;}
  function retain(keys){if(!draft)return;draft.rows=draft.rows.filter(r=>keys.includes(r.key));draft.preview=null;draft.raw=null;version++;}
  function reset(){draft=null;version++;}
  return {open,dialog,input,change,act,numbers,expected,retain,reset,getDraft:()=>draft};
}};})();
