/* Safety cap + combined face / decoration controller */
const decorationPlanBeforeCombined=buildDecorationPlan;

function combinedFaceEnabled(){
  return getControllerMode()==="decorations"&&$("includeFaceInDecorations")?.checked===true;
}

function getCombinedFaces(){
  if(!combinedFaceEnabled())return [{label:"ปกติ",bone:"",icon:""}];
  const expressions=typeof getExpressionsAdvanced==="function"?getExpressionsAdvanced():getExpressions();
  return expressions.length?expressions:[{label:"ปกติ",bone:"",icon:""}];
}

buildDecorationPlan=function(decorations=getDecorations()){
  const base=decorationPlanBeforeCombined(decorations);
  const faces=getCombinedFaces();
  const includeFaces=combinedFaceEnabled();
  const count=base.count*(includeFaces?faces.length:1);
  if(!Number.isFinite(count)||count>MAX_DECORATION_VARIANTS){
    return {...base,faces,includeFaces,count:Number.isFinite(count)?count:Infinity,states:[]};
  }
  const faceBones=faces.map(face=>face.bone).filter(Boolean);
  const states=[];
  for(const baseState of base.states){
    const faceIndexes=includeFaces?faces.map((_,index)=>index):[0];
    for(const faceIndex of faceIndexes){
      const visibility={...baseState.visibility};
      faceBones.forEach(bone=>visibility[bone]=false);
      const selected=faces[faceIndex];
      if(includeFaces&&selected?.bone)visibility[selected.bone]=true;
      states.push({...baseState,faceIndex,visibility});
    }
  }
  return {...base,faces,includeFaces,count,states};
};

function installCombinedFaceUI(){
  const panel=$("decorationPanel");
  if(!panel||$("includeFaceInDecorations"))return;
  const row=document.createElement("label");
  row.className="switch-row combined-face-switch";
  row.innerHTML='<span><b>รวมสีหน้าในหน้าแต่งตัว</b><small>เพิ่ม Dropdown สีหน้าใน UI เดียวกับแว่น กระเป๋า และชุด • รองรับแบบ Bone</small></span><input id="includeFaceInDecorations" type="checkbox" checked><i></i>';
  const header=panel.querySelector(".decoration-header");
  header?.insertAdjacentElement("afterend",row);

  const expressionSection=$("expressionList")?.parentElement;
  const sync=()=>{
    const active=getControllerMode()==="decorations";
    const enabled=active&&row.querySelector("input").checked;
    if(enabled){
      faceMethod="bone";
      const boneRadio=document.querySelector('input[name="faceMethod"][value="bone"]');
      if(boneRadio)boneRadio.checked=true;
      expressionSection?.classList.remove("hidden");
      expressionSection?.querySelector(".expression-header h4")&&(expressionSection.querySelector(".expression-header h4").textContent="สีหน้าในหน้าแต่งตัว");
      applyFaceMethodToRows?.();
    }else if(active){
      expressionSection?.classList.add("hidden");
    }
    updateDecorationPreview();
    updateAdvancedSummary();
    runProjectValidation(false);
  };
  row.querySelector("input").addEventListener("change",sync);
  document.querySelectorAll('input[name="controllerMode"]').forEach(input=>input.addEventListener("change",()=>setTimeout(sync,10)));
  $("addExpressionBtn")?.addEventListener("click",()=>setTimeout(sync,0));
  sync();
}

const previewBeforeCombined=updateDecorationPreview;
updateDecorationPreview=function(){
  const panel=$("decorationPreview");
  if(!panel)return;
  const plan=buildDecorationPlan();
  const controls=[];
  if(plan.includeFaces){
    controls.push(`<label>สีหน้า<select disabled>${plan.faces.map((face,index)=>`<option ${index===0?"selected":""}>${face.label}</option>`).join("")}</select></label>`);
  }
  for(const item of plan.toggles)controls.push(`<label><input type="checkbox" ${item.defaultOn?"checked":""} disabled> ${item.label}</label>`);
  for(const group of plan.groups){
    const selected=group.options.findIndex(item=>item.defaultOn);
    controls.push(`<label>${group.label}<select disabled><option>ไม่ใส่</option>${group.options.map((item,index)=>`<option ${index===selected?"selected":""}>${item.label}</option>`).join("")}</select></label>`);
  }
  panel.innerHTML=`<b>ตัวอย่าง UI ในเกม</b><div>${controls.join("")||"เพิ่มของตกแต่งอย่างน้อย 1 ชิ้น"}</div><small>${plan.count} รูปแบบไอเทม${plan.count>MAX_DECORATION_VARIANTS?` • เกินขีดจำกัด ${MAX_DECORATION_VARIANTS}`:""}</small>`;
};

makeDecorationRenderControllers=function(ns,item,plan){
  const controllers={};
  const allBones=[...plan.decorations.map(x=>x.bone),...(plan.faces||[]).map(x=>x.bone)].filter(Boolean);
  plan.states.forEach((state,index)=>{
    const visibility={};
    for(const bone of allBones)visibility[bone]=state.visibility[bone]?"1.0":"0.0";
    controllers[`controller.render.${ns}.${item}.look_${index}`]={geometry:"Geometry.default",materials:[{"*":"Material.default"}],textures:["Texture.default"],part_visibility:visibility};
  });
  return {format_version:"1.8.0",render_controllers:controllers};
};

makeDecorationControllerScript=function(ns,controllerItem,modelItem,slot,title,body,plan,autoGive){
  const modelItems=plan.states.map((_,index)=>`${ns}:${modelItem}${index?`_look_${index}`:""}`);
  const states=plan.states.map(state=>({faceIndex:state.faceIndex||0,toggles:state.toggles,choices:state.choices}));
  const faces=plan.includeFaces?plan.faces.map(face=>face.label):[];
  const toggles=plan.toggles.map(item=>({label:item.label}));
  const groups=plan.groups.map(group=>({label:group.label,options:group.options.map(item=>item.label)}));
  const slotConstant=equipmentSlotConstant(slot);
  return `import { world, system, ItemStack, EquipmentSlot, EntityComponentTypes } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
const CONTROLLER_ITEM=${JSON.stringify(`${ns}:${controllerItem}`)};
const MODEL_ITEMS=${JSON.stringify(modelItems)};
const STATES=${JSON.stringify(states)};
const FACES=${JSON.stringify(faces)};
const TOGGLES=${JSON.stringify(toggles)};
const GROUPS=${JSON.stringify(groups)};
const EQUIPMENT_SLOT=EquipmentSlot.${slotConstant};
function sameState(state,faceIndex,toggles,choices){return state.faceIndex===faceIndex&&JSON.stringify(state.toggles)===JSON.stringify(toggles)&&JSON.stringify(state.choices)===JSON.stringify(choices);}
async function openMenu(player){
  const equippable=player.getComponent(EntityComponentTypes.Equippable);
  const current=equippable?.getEquipment(EQUIPMENT_SLOT);
  const currentIndex=current?MODEL_ITEMS.indexOf(current.typeId):-1;
  if(currentIndex<0){player.sendMessage("§cกรุณาสวมโมเดล ${ns}:${modelItem} ก่อนใช้ Controller");return;}
  const currentState=STATES[currentIndex]||STATES[0];
  const form=new ModalFormData().title(${JSON.stringify(title)});
  if(FACES.length)form.dropdown("สีหน้า",FACES,currentState.faceIndex||0);
  TOGGLES.forEach((control,index)=>form.toggle(control.label,currentState.toggles[index]===true));
  GROUPS.forEach((group,index)=>form.dropdown(group.label,["ไม่ใส่",...group.options],(currentState.choices[index]??-1)+1));
  form.submitButton("บันทึก");
  const response=await form.show(player);
  if(response.canceled||!response.formValues)return;
  const values=response.formValues;
  let offset=0;
  const faceIndex=FACES.length?Number(values[offset++]||0):0;
  const toggleValues=TOGGLES.map((_,index)=>values[offset+index]===true);
  offset+=TOGGLES.length;
  const choiceValues=GROUPS.map((_,index)=>Number(values[offset+index]??0)-1);
  const targetIndex=STATES.findIndex(state=>sameState(state,faceIndex,toggleValues,choiceValues));
  if(targetIndex<0){player.sendMessage("§cไม่พบรูปแบบที่เลือก");return;}
  system.run(()=>equippable.setEquipment(EQUIPMENT_SLOT,new ItemStack(MODEL_ITEMS[targetIndex],1)));
}
world.afterEvents.itemUse.subscribe(event=>{if(event.itemStack?.typeId!==CONTROLLER_ITEM)return;system.run(()=>openMenu(event.source));});
${autoGive?`world.afterEvents.playerSpawn.subscribe(event=>{if(!event.initialSpawn)return;system.runTimeout(()=>{const container=event.player.getComponent("minecraft:inventory")?.container;if(!container)return;let found=false;for(let i=0;i<container.size;i++)if(container.getItem(i)?.typeId===CONTROLLER_ITEM)found=true;if(!found)container.addItem(new ItemStack(CONTROLLER_ITEM,1));},20);});`:""}`;
};

const validationBeforeCombinedFaces=runProjectValidation;
runProjectValidation=function(showStatus=true){
  const base=validationBeforeCombinedFaces(false);
  if(!combinedFaceEnabled()){
    if(showStatus)renderCombinedValidation(base,true);
    return base;
  }
  const problems=[...base.problems];
  const faces=getCombinedFaces();
  const decorationBones=new Set(getDecorations().map(item=>item.bone).filter(Boolean));
  const used=new Set();
  faces.forEach((face,index)=>{
    if(index>0&&!face.bone)problems.push({type:"error",text:`สีหน้า “${face.label}” ยังไม่ได้เลือก Bone`});
    if(face.bone&&detectedBoneNames.length&&!detectedBoneNames.includes(face.bone))problems.push({type:"error",text:`ไม่พบ Bone สีหน้า “${face.bone}” ในโมเดล`});
    if(face.bone&&used.has(face.bone))problems.push({type:"error",text:`Bone สีหน้าถูกใช้ซ้ำ: ${face.bone}`});
    if(face.bone&&decorationBones.has(face.bone))problems.push({type:"error",text:`Bone “${face.bone}” ถูกใช้ทั้งสีหน้าและของตกแต่ง`});
    if(face.bone)used.add(face.bone);
  });
  const result={problems,errors:problems.filter(x=>x.type==="error").length,warnings:problems.filter(x=>x.type==="warning").length};
  result.ok=result.errors===0;
  renderCombinedValidation(result,showStatus);
  return result;
};

const summaryBeforeCombinedFaces=updateAdvancedSummary;
updateAdvancedSummary=function(){
  summaryBeforeCombinedFaces();
  if(!combinedFaceEnabled())return;
  const summary=$("advancedSummary");
  if(!summary)return;
  const faces=getCombinedFaces();
  const row=[...summary.children].find(child=>child.querySelector("span")?.textContent==="ระบบสีหน้า");
  if(row)row.innerHTML=`<span>ระบบสีหน้า</span><b>${faces.length} แบบ • รวมใน UI แต่งตัว</b>`;
};

const projectSettingsBeforeCombinedFaces=projectSettingsObject;
projectSettingsObject=function(){
  const data=projectSettingsBeforeCombinedFaces();
  data.includeFaceInDecorations=$("includeFaceInDecorations")?.checked===true;
  return data;
};

$("openProjectFile")?.addEventListener("change",async event=>{
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    setTimeout(()=>{
      if($("includeFaceInDecorations")&&typeof data.includeFaceInDecorations==="boolean"){
        $("includeFaceInDecorations").checked=data.includeFaceInDecorations;
        $("includeFaceInDecorations").dispatchEvent(new Event("change"));
      }
    },30);
  }catch(_error){}
});

function injectCombinedFaceStyles(){
  if($("combinedFaceStyles"))return;
  const style=document.createElement("style");
  style.id="combinedFaceStyles";
  style.textContent=`
    .combined-face-switch{margin:16px 0}
    .decoration-panel .expression-config-section{margin-top:16px}
    .decoration-preview select{font-size:12px}
    .controller-grid{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:22px!important;align-items:start!important}
    .controller-grid>*{min-width:0!important;position:relative!important;inset:auto!important;transform:none!important}
    .controller-grid>.advanced-tool-card,.controller-grid>.decoration-panel{grid-column:1/-1!important;width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important}
    .face-method-card{display:block!important;padding:20px!important;margin:0 0 20px!important;clear:both!important}
    .face-method-card>div:first-child{display:block!important;margin-bottom:16px!important}
    .face-method-card h4{margin:0 0 6px!important;line-height:1.35!important}
    .face-method-card p{margin:0!important;line-height:1.6!important}
    .face-method-options{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important}
    .face-method-options label{display:grid!important;grid-template-columns:auto 1fr!important;grid-template-rows:auto auto!important;column-gap:10px!important;row-gap:5px!important;align-content:start!important;min-width:0!important;min-height:92px!important;padding:16px!important;overflow:hidden!important}
    .face-method-options input{grid-row:1/3!important;align-self:start!important;width:auto!important;min-height:0!important;margin:3px 0 0!important}
    .face-method-options b{grid-column:2!important;display:block!important;line-height:1.35!important;white-space:normal!important}
    .face-method-options span{grid-column:2!important;display:block!important;margin:0!important;line-height:1.55!important;white-space:normal!important;overflow-wrap:anywhere!important}
    .face-method-card>small{display:block!important;margin-top:14px!important;line-height:1.45!important}
    .expression-config-section{grid-column:1/-1!important;display:block!important;width:100%!important;min-width:0!important;margin-top:4px!important;padding-top:4px!important;clear:both!important}
    .expression-header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important;margin-bottom:14px!important;min-height:0!important}
    .expression-header>div{min-width:0!important}.expression-header h4,.expression-header p{position:static!important;margin-left:0!important;margin-right:0!important;white-space:normal!important}
    .expression-list{display:grid!important;gap:10px!important;width:100%!important;min-width:0!important}
    .expression-row{display:grid!important;grid-template-columns:24px minmax(150px,.9fr) minmax(190px,1.2fr) minmax(120px,.7fr) 38px!important;gap:10px!important;align-items:center!important;width:100%!important;min-width:0!important;padding:10px!important;margin:0!important;overflow:visible!important}
    .expression-row>*{min-width:0!important;position:static!important;float:none!important}
    .expression-row input{width:100%!important;margin:0!important}
    .expression-row .drag-dot{display:flex!important;align-items:center!important;justify-content:center!important}
    .expression-row .expr-assets{grid-column:2/-1!important;width:100%!important;margin-top:2px!important}
    .controller-intro{display:flex!important;align-items:center!important;gap:18px!important;min-height:92px!important;height:auto!important;overflow:visible!important;padding:18px!important}
    .controller-intro>div:last-child{display:flex!important;flex:1!important;min-width:0!important;flex-wrap:wrap!important;align-items:center!important;gap:6px 14px!important}
    .controller-intro b,.controller-intro span{display:block!important;width:100%!important;position:static!important;white-space:normal!important;line-height:1.5!important}
    .controller-command{display:inline-block!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;margin-top:4px!important}
    @media(max-width:1000px){
      .controller-grid{grid-template-columns:1fr!important}
      .face-method-options{grid-template-columns:1fr!important}
      .expression-row{grid-template-columns:22px minmax(0,1fr) minmax(0,1fr) 38px!important}
      .expression-row .expr-icon{grid-column:2/4!important}
      .expression-row .expr-assets{grid-column:2/4!important}
    }
    @media(max-width:680px){
      .expression-header{display:grid!important;grid-template-columns:1fr!important}
      .expression-header button{width:100%!important}
      .expression-row{grid-template-columns:1fr!important;padding:12px!important}
      .expression-row .drag-dot{display:none!important}
      .expression-row .expr-icon,.expression-row .expr-assets{grid-column:1!important}
      .expression-row .remove-expression{width:100%!important}
      .controller-intro{align-items:flex-start!important}
    }
  `;
  document.head.appendChild(style);
}

installCombinedFaceUI();
injectCombinedFaceStyles();
updateDecorationPreview();
updateAdvancedSummary();
runProjectValidation(false);