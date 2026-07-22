/* Safety cap for decoration combinations */
const originalDecorationPlanBuilder=buildDecorationPlan;
buildDecorationPlan=function(decorations=getDecorations()){
  const toggles=decorations.filter(item=>item.type==="toggle");
  const groupMap=new Map();
  for(const item of decorations.filter(item=>item.type==="choice")){
    if(!groupMap.has(item.group))groupMap.set(item.group,[]);
    groupMap.get(item.group).push(item);
  }
  const groups=[...groupMap.entries()].map(([key,options])=>({key,label:key.replace(/_/g," "),options}));
  const count=(2**toggles.length)*groups.reduce((total,group)=>total*(group.options.length+1),1);
  if(!Number.isFinite(count)||count>MAX_DECORATION_VARIANTS){
    return {decorations,toggles,groups,count:Number.isFinite(count)?count:Infinity,states:[]};
  }
  return originalDecorationPlanBuilder(decorations);
};
updateDecorationPreview();
updateAdvancedSummary();
runProjectValidation(false);
