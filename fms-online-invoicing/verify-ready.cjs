// 既有业务用例显式准备“已选择供应商且已认证”的测试环境；产品默认仍为“无”。
module.exports=function readyFixtures(F){
  const defaultInitial=F.initial;
  F.initial=()=>{const s=defaultInitial(),userId=s.currentUserId;
    for(const user of s.users){F.switchUser(s,user.id);const a=F.clerkAccount(s);if(!a)continue;F.setInvoiceProvider(s,'baiwang');
      const auth=F.accountConnection(s,a.id);Object.assign(auth,{registered:true,username:F.taxAccount(a),status:'可开票',stage:'idle',sessionOnline:true,faceRequired:false,remoteOutcome:'online',reason:''});
      for(const c of F.allowedSubjects(s)){const x=F.connection(s,a.id,c.id);Object.assign(x,{status:'可开票',remoteOutcome:'online',checkedTaxNo:c.tax,subjectTaxNo:c.tax,reason:''});}
    }for(const b of s.bills||[])b.invoicePushed=true;F.switchUser(s,userId);return s;
  };return defaultInitial;
};
