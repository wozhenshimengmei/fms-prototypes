(function(){
  const F=window.FMS,types=new Map();
  function register(def){if(!def.id||!def.name||!Array.isArray(def.fields)||!def.fields.length)throw Error('导入类型须包含标识、名称和字段。');if(new Set(def.fields.map(f=>f.key)).size!==def.fields.length)throw Error('导入类型字段不能重复。');types.set(def.id,{identity:[],...def});}
  register({id:'deduction',name:'扣除费用',templateName:'扣除费用导入模板.xlsx',identity:['store','subject'],fields:[{key:'store',label:'门店ID',kind:'store',width:220},{key:'subject',label:'主体ID',kind:'subject',width:230},{key:'amount',label:'扣除费用',kind:'amount',width:150}],description:'仅用于对应账期、门店及主体的店总费用发票备注，不改变开票金额。',sample:[['10001','102','350.00'],['10001','101','450.00'],['10003','102','200.00']],read:s=>s.deductions,preview:(s,month,data)=>F.previewImport(s,month,data),commit:(s,rows)=>F.commitImport(s,rows)});
  function get(id){return types.get(id);}
  function requireType(id){const def=get(id);if(!def)throw Error('请选择有效的导入类型。');return def;}
  function rowKey(typeId,month,row){const def=requireType(typeId);return JSON.stringify([typeId,month,...def.identity.map(k=>row[k])]);}
  function list(s,typeId){const def=requireType(typeId);return (def.read?def.read(s):s.invoiceImportData?.[typeId]||[]).map(r=>({...r,typeId,key:rowKey(typeId,r.month,r)}));}
  function preview(s,month,typeId,data){if(!/^\d{4}-\d{2}$/.test(month||''))throw Error('请先选择账期。');const def=requireType(typeId),heads=def.fields.map(f=>f.label);if(!data?.length||data[0].map(x=>String(x).trim()).join('|')!==heads.join('|'))throw Error(`${def.name}模板表头必须依次为：${heads.join('、')}。`);let rows;
    if(def.preview)rows=def.preview(s,month,data);
    else{const seen=new Set(),existing=list(s,typeId);rows=data.slice(1).filter(r=>r.some(v=>String(v).trim())).map((cells,n)=>{const r={month,line:n+2,errors:[]};if(cells.length!==heads.length)r.errors.push('列数与当前导入类型不符');def.fields.forEach((f,i)=>{const value=String(cells[i]??'').trim();try{if(!value)throw Error(`${f.label}不能为空`);r[f.key]=f.kind==='amount'?F.cents(value):value;}catch(e){r.errors.push(e.message);}});const key=rowKey(typeId,month,r);if(seen.has(key))r.errors.push('同一文件内存在重复匹配项');seen.add(key);r.old=existing.find(v=>v.key===key)||null;return r;});}
    if(!rows.length)throw Error('文件中没有数据行。');return rows.map(r=>({...r,typeId,key:rowKey(typeId,month,r)}));
  }
  function commit(s,typeId,rows,{allowOverwrite=false}={}){const def=requireType(typeId);if(!rows?.length||rows.some(r=>r.typeId!==typeId||r.errors.length))throw Error('请先按当前类型校验文件，修正异常行后重新导入。');if(rows.some(r=>r.old)&&!allowOverwrite)throw Error('存在已导入数据，请先确认覆盖。');
    if(def.commit){const before=s.imports.length;def.commit(s,rows);for(const batch of s.imports.slice(before))batch.typeId=typeId;}
    else{s.invoiceImportData??={};s.invoiceImportData[typeId]??=[];for(const row of rows){const saved={month:row.month,operator:s.operator,time:F.now()};for(const f of def.fields)saved[f.key]=row[f.key];const key=rowKey(typeId,saved.month,saved),n=s.invoiceImportData[typeId].findIndex(r=>rowKey(typeId,r.month,r)===key);if(n<0)s.invoiceImportData[typeId].push(saved);else s.invoiceImportData[typeId][n]=saved;}s.imports.push({typeId,time:F.now(),operator:s.operator,rows:F.clone(rows)});}
  }
  function migrate(s){s.deductions??=[];s.imports??=[];if(!s.invoiceImportModuleVersion){
      // 仅移除旧版本内置、且未由导入操作写入过的两条初始演示金额。
      s.deductions=s.deductions.filter(d=>{const seed=d.time==='2026-10-19 09:00:00'&&d.month==='2026-09'&&d.store==='10001'&&((d.subject==='102'&&d.amount===30000)||(d.subject==='101'&&d.amount===40000));const imported=s.imports.some(b=>b.rows?.some(r=>r.month===d.month&&r.store===d.store&&r.subject===d.subject));return !seed||imported;});s.invoiceImportModuleVersion=1;}
    for(const batch of s.imports)batch.typeId??='deduction';return s;
  }
  const oldLoad=F.load,oldInitial=F.initial;F.load=()=>migrate(oldLoad());F.initial=()=>migrate(oldInitial());
  window.FMSImportTypes={register,get,all:()=>[...types.values()],headers:id=>requireType(id).fields.map(f=>f.label),list,preview,commit,rowKey,migrate};
})();
