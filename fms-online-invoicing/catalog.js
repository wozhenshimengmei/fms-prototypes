/* 原型检索摘录；正式编号来源见README。未核实的对应关系保留空值。 */
(function(){
  const projects=[
    {id:'DEMO-P01',name:'生产生活服务*劳务派遣',classification:'劳务派遣服务',keywords:'店总 人力资源 员工 派遣',code:'3040803010000000000'},
    {id:'DEMO-P02',name:'生产生活服务*服务费',classification:'服务费',keywords:'财务 服务 管理',code:null},
    {id:'DEMO-P03',name:'生产生活服务*企业管理服务',classification:'其他企业管理服务',keywords:'咨询 企业 管理',code:'3040801990000000000'},
    {id:'DEMO-P04',name:'生产生活服务*信息系统服务',classification:'信息系统服务',keywords:'软件 系统 信息 技术 维护',code:'3040203000000000000'},
    {id:'DEMO-P05',name:'生产生活服务*广告服务',classification:'广告服务',keywords:'广告 品牌 推广',code:null},
    {id:'DEMO-P06',name:'生产生活服务*住宿服务',classification:'住宿服务',keywords:'酒店 住宿 房费',code:null}
  ];
  // 常用税率/征收率选项；不将零税率、免税和不征税混为同一含义。
  const rates=[1,3,5,6,9,13];
  const matches=(p,query)=>[p.code,p.name,p.classification,p.keywords].filter(Boolean).join(' ').toLowerCase().includes(String(query||'').trim().toLowerCase());
  window.FMSCatalog={projects,rates,matches,find:id=>projects.find(p=>p.id===id),byName:name=>projects.find(p=>p.name===name)};
})();
