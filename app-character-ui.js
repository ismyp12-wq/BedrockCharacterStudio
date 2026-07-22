/* Rabbit Builder: combined face + decoration Character UI extension */
const MAX_CHARACTER_UI_VARIANTS=128;

function characterUiFacesEnabled(){return $("decorationIncludeFaces")?.checked===true}

function characterUiExpressions(){
  if(!characterUiFacesEnabled())return [{label:"ปกติ",bone:"",icon:"",textureFile:null,modelFile:null}];
  return typeof getExpressionsAdvanced==="function"?getExpressionsAdvanced():getExpressions();
}

function buildCharacterUiPlan(){
  const decorationPlan=buildDecorationPlan();
  const expressions=characterUiExpressions();
  const faces=characterUiFacesEnabled()?expressions:[expressions[0]];
  const states=[];
  faces.forEach((face,faceIndex)=>{
    decorationPlan.states.forEach((decorationState,decorationIndex)=>{
      states.push({faceIndex,decorationIndex,toggles:[...decorationState.toggles],choices:[...decorationState.choices],visibility:{...decorationState.visibility}});
    });
  });
  return {...decorationPlan,faces,states,count:states.length,decorationCount:decorationPlan.count};
}

function installCombinedCharacterUi(){
  const panel=$("decorationPanel");
  if(!panel||$("decorationIncludeFaces"))return;
  const option=document.createElement("label");
  option.className="switch-row combined-face-switch";
  option.innerHTML='<span><b>รวมระบบสีหน้าใน UI เดียว</b><small>Controller ชิ้นเดียวใช้เปลี่ยนสีหน้า แว่น กระเป๋า และชุด</small></span><input id="decorationIncludeFaces" type="checkbox" checked><i></i>';
  panel.insertBefore(option,panel.firstChild.nextSibling);
  option.querySelector("input").addEventListener("change",()=>{
    syncCombinedFaceConfiguration();
    updateDecorationPreview();
    updateAdvancedSummary();
    runProjectValidation(false);
  });

  const originalModeRadios=[...document.querySelectorAll('input[name="controllerMode"]')];
  originalModeRadios.forEach(input=>input.addEventListener("change",()=>setTimeout(syncCombinedFaceConfiguration,20)));
  document.querySelectorAll('input[name="faceMethod"]').forEach(input=>input.addEventListener("change",()=>{updateDecorationPreview();runProjectValidation(false)}));
  $("addExpressionBtn")?.addEventListener("click",()=>setTimeout(()=>{updateDecorationPreview();runProjectValidation(false)},20));
  $("expressionList")?.addEventListener("input",()=>{updateDecorationPreview();runProjectValidation(false)});
  $("expressionList")?.addEventListener("change",()=>{updateDecorationPreview();runProjectValidation(false)});

  const style=document.createElement("style");
  style.id="combinedCharacterUiStyles";
  style.textContent=`
    .combined-face-switch{margin:12px 0}.decoration-preview .character-face-preview{display:flex;justify-content:space-between;align-items:center;border:1px solid #e0deeb;border-radius:8px;padding:8px;background:#faf9ff;margin-top:8px}.decoration-preview .character-face-preview span{font-size:8px}.decoration-preview .character-face-preview b{font-size:8px;color:#6550bd}.character-ui-limit{margin-top:7px;padding:7px 9px;border-radius:8px;background:#fff7e8;color:#8b6518;font-size:8px}
  `;
  document.head.appendChild(style);
  syncCombinedFaceConfiguration();
}

function syncCombinedFaceConfiguration(){
  const active=getControllerMode()==="decorations";
  const include=active&&characterUiFacesEnabled();
  document.querySelector(".face-method-card")?.classList.toggle("hidden",!include);
  document.querySelector(".expression-config-section")?.classList.toggle("hidden",!include);
  if(include)applyFaceMethodToRows();
}

const baseDecorationPreview=updateDecorationPreview;
updateDecorationPreview=function(){
  baseDecorationPreview();
  const preview=$("decorationPreview");
  if(!preview||getControllerMode()!=="decorations")return;
  const plan=buildCharacterUiPlan();
  preview.querySelector(".character-face-preview")?.remove();
  preview.querySelector(".character-ui-limit")?.remove();
  if(characterUiFacesEnabled()){
    const row=document.createElement("div");
    row.className="character-face-preview";
    row.innerHTML=`<span>สีหน้า</span><b>${plan.faces[0]?.label||"ปกติ"} ▾ (${plan.faces.length} แบบ)</b>`;
    const controls=preview.querySelector("div");
    preview.insertBefore(row,controls||preview.querySelector("small"));
  }
  const small=preview.querySelector("small");
  if(small)small.textContent=`${plan.count} รูปแบบภายใน • ${plan.faces.length} สีหน้า × ${plan.decorationCount} รูปแบบตกแต่ง`;
  if(plan.count>MAX_CHARACTER_UI_VARIANTS){
    const warning=document.createElement("div");warning.className="character-ui-limit";warning.textContent=`เกินขีดจำกัด ${MAX_CHARACTER_UI_VARIANTS} รูปแบบ กรุณาลดสีหน้าหรือของตกแต่ง`;preview.appendChild(warning);
  }
};

function validateCharacterUiFaces(problems){
  if(getControllerMode()!=="decorations"||!characterUiFacesEnabled())return;
  const expressions=characterUiExpressions();
  const method=getFaceMethod();
  if(!expressions.length){problems.push({type:"error",text:"ต้องมีสีหน้าอย่างน้อย 1 แบบ"});return;}
  const labels=new Set();
  const usedBones=new Set();
  expressions.forEach((expression,index)=>{
    const key=expression.label.toLowerCase();
    if(labels.has(key))problems.push({type:"error",text:`ชื่อสีหน้าซ้ำ: ${expression.label}`});
    labels.add(key);
    if(method==="bone"){
      if(index>0&&!expression.bone)problems.push({type:"error",text:`สีหน้า “${expression.label}” ยังไม่ได้เลือก Bone`});
      if(expression.bone&&detectedBoneNames.length&&!detectedBoneNames.includes(expression.bone))problems.push({type:"error",text:`ไม่พบ Bone สีหน้า “${expression.bone}” ในโมเดล`});
      if(expression.bone&&usedBones.has(expression.bone))problems.push({type:"error",text:`Bone สีหน้าถูกใช้ซ้ำ: ${expression.bone}`});
      if(expression.bone)usedBones.add(expression.bone);
    }
    if(method==="texture"&&index>0&&!expression.textureFile)problems.push({type:"error",text:`สีหน้า “${expression.label}” ยังไม่มี Texture PNG`});
    if(method==="model"&&index>0&&!expression.modelFile)problems.push({type:"error",text:`สีหน้า “${expression.label}” ยังไม่มีไฟล์โมเดล`});
  });
  const decorationBones=new Set(getDecorations().map(item=>item.bone).filter(Boolean));
  for(const bone of usedBones)if(decorationBones.has(bone))problems.push({type:"error",text:`Bone “${bone}” ถูกใช้ทั้งสีหน้าและของตกแต่ง`});
  const plan=buildCharacterUiPlan();
  if(plan.count>MAX_CHARACTER_UI_VARIANTS)problems.push({type:"error",text:`สีหน้าและของตกแต่งรวมกัน ${plan.count} รูปแบบ เกินขีดจำกัด ${MAX_CHARACTER_UI_VARIANTS}`});
  else if(plan.count>64)problems.push({type:"warning",text:`จะสร้างไอเทมภายใน ${plan.count} รูปแบบ แพ็กอาจมีขนาดใหญ่`});
}

const decorationValidationWithFaces=runProjectValidation;
runProjectValidation=function(showStatus=true){
  const result=decorationValidationWithFaces(false);
  if(getControllerMode()!=="decorations"||!characterUiFacesEnabled()){
    if(showStatus)renderCombinedValidation(result,true);
    return result;
  }
  const problems=[...result.problems];
  validateCharacterUiFaces(problems);
  const combined={problems,errors:problems.filter(x=>x.type==="error").length,warnings:problems.filter(x=>x.type==="warning").length};
  combined.ok=combined.errors===0;
  renderCombinedValidation(combined,showStatus);
  return combined;
};

const summaryWithCombinedFaces=updateAdvancedSummary;
updateAdvancedSummary=function(){
  summaryWithCombinedFaces();
  if(getControllerMode()!=="decorations")return;
  const summary=$("advancedSummary");if(!summary)return;
  const plan=buildCharacterUiPlan();
  const faceRow=[...summary.children].find(row=>row.querySelector("span")?.textContent==="ระบบสีหน้า");
  if(faceRow)faceRow.innerHTML=`<span>ระบบสีหน้า</span><b>${characterUiFacesEnabled()?`${plan.faces.length} แบบ • ${getFaceMethod()}`:"ไม่มี"}</b>`;
  const decorationRow=[...summary.children].find(row=>row.querySelector("span")?.textContent==="ของตกแต่ง");
  if(decorationRow)decorationRow.innerHTML=`<span>ของตกแต่ง</span><b>${plan.decorations.length} ชิ้น • รวม ${plan.count} รูปแบบ</b>`;
};

const projectSettingsWithCombinedFaces=projectSettingsObject;
projectSettingsObject=function(){
  const data=projectSettingsWithCombinedFaces();
  data.decorationIncludeFaces=characterUiFacesEnabled();
  return data;
};

$("openProjectFile")?.addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if($("decorationIncludeFaces")&&typeof data.decorationIncludeFaces==="boolean")$("decorationIncludeFaces").checked=data.decorationIncludeFaces;
    setTimeout(()=>{syncCombinedFaceConfiguration();updateDecorationPreview();updateAdvancedSummary();runProjectValidation(false)},30);
  }catch(_error){}
});

function combinedPartVisibility(expressionIndex,expressions,decorationState,decorations,method){
  const visibility={};
  if(method==="bone"){
    expressions.forEach((expression,index)=>{if(expression.bone)visibility[expression.bone]=index===expressionIndex?"1.0":"0.0"});
  }
  decorations.forEach(decoration=>{if(decoration.bone)visibility[decoration.bone]=decorationState.visibility[decoration.bone]?"1.0":"0.0"});
  return visibility;
}

function makeCombinedRenderControllers(ns,item,plan,method){
  const controllers={};
  plan.states.forEach((state,index)=>{
    const geometry=method==="model"&&state.faceIndex>0?`Geometry.face_${state.faceIndex}`:"Geometry.default";
    const texture=(method==="texture"||method==="model")&&state.faceIndex>0?`Texture.face_${state.faceIndex}`:"Texture.default";
    controllers[`controller.render.${ns}.${item}.style_${index}`]={geometry,materials:[{"*":"Material.default"}],textures:[texture],part_visibility:combinedPartVisibility(state.faceIndex,plan.faces,state,plan.decorations,method)};
  });
  return {format_version:"1.8.0",render_controllers:controllers};
}

function makeCombinedCharacterControllerScript(ns,controllerItem,modelItem,slot,title,plan,autoGive){
  const modelItems=plan.states.map((_,index)=>`${ns}:${modelItem}${index?`_style_${index}`:""}`);
  const states=plan.states.map(state=>({face:state.faceIndex,toggles:state.toggles,choices:state.choices}));
  const faces=plan.faces.map(expression=>expression.label);
  const toggles=plan.toggles.map(item=>item.label);
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
function sameState(state,face,toggles,choices){return state.face===face&&JSON.stringify(state.toggles)===JSON.stringify(toggles)&&JSON.stringify(state.choices)===JSON.stringify(choices);}
async function openMenu(player){
 const equippable=player.getComponent(EntityComponentTypes.Equippable);
 const current=equippable?.getEquipment(EQUIPMENT_SLOT);
 const currentIndex=current?MODEL_ITEMS.indexOf(current.typeId):-1;
 if(currentIndex<0){player.sendMessage("§cกรุณาสวมโมเดล ${ns}:${modelItem} ก่อนใช้ Controller");return;}
 const currentState=STATES[currentIndex]||STATES[0];
 const form=new ModalFormData().title(${JSON.stringify(title)});
 ${plan.faces.length>1?'form.dropdown("สีหน้า",FACES,currentState.face);':''}
 TOGGLES.forEach((label,index)=>form.toggle(label,currentState.toggles[index]===true));
 GROUPS.forEach((group,index)=>form.dropdown(group.label,["ไม่ใส่",...group.options],(currentState.choices[index]??-1)+1));
 form.submitButton("บันทึกตัวละคร");
 const response=await form.show(player);if(response.canceled||!response.formValues)return;
 let cursor=0;const face=${plan.faces.length>1?'Number(response.formValues[cursor++]??0)':'0'};
 const toggleValues=TOGGLES.map(()=>response.formValues[cursor++]===true);
 const choiceValues=GROUPS.map(()=>Number(response.formValues[cursor++]??0)-1);
 const target=STATES.findIndex(state=>sameState(state,face,toggleValues,choiceValues));
 if(target<0){player.sendMessage("§cไม่พบรูปแบบตัวละครนี้");return;}
 system.run(()=>equippable.setEquipment(EQUIPMENT_SLOT,new ItemStack(MODEL_ITEMS[target],1)));
}
world.afterEvents.itemUse.subscribe(event=>{if(event.itemStack?.typeId!==CONTROLLER_ITEM)return;system.run(()=>openMenu(event.source));});
${autoGive?`world.afterEvents.playerSpawn.subscribe(event=>{if(!event.initialSpawn)return;system.runTimeout(()=>{const container=event.player.getComponent("minecraft:inventory")?.container;if(!container)return;for(let i=0;i<container.size;i++)if(container.getItem(i)?.typeId===CONTROLLER_ITEM)return;container.addItem(new ItemStack(CONTROLLER_ITEM,1));},20);});`:""}`;
}

async function readCombinedFaceAssets(plan,method,item,baseGeometry,baseTexture){
  const geometries=[baseGeometry],textures=[baseTexture],sources=[];
  for(let index=1;index<plan.faces.length;index++){
    const expression=plan.faces[index];
    textures[index]=expression.textureFile||baseTexture;
    geometries[index]=baseGeometry;
    if(method==="model"&&expression.modelFile){
      const data=JSON.parse(await expression.modelFile.text());
      const geometryId=`geometry.ly.${item}.face_${index}`;
      if(expression.modelFile.name.toLowerCase().endsWith(".bbmodel"))geometries[index]=convertBBGeometry(data,geometryId);
      else{
        const copy=JSON.parse(JSON.stringify(data));
        const geos=copy["minecraft:geometry"];
        if(!Array.isArray(geos)||!geos.length)throw new Error(`โมเดลสีหน้า ${expression.label} ไม่มี minecraft:geometry`);
        geos[0].description=geos[0].description||{};geos[0].description.identifier=geometryId;geometries[index]=copy;
      }
      sources.push(expression.modelFile);
    }
    if(expression.textureFile)sources.push(expression.textureFile);
  }
  return {geometries,textures,sources};
}

async function buildCombinedCharacterAddon(){
  const button=$("buildBtn");
  try{
    const validation=runProjectValidation(true);if(!validation.ok)throw new Error("กรุณาแก้รายการตรวจสอบก่อน Build");
    button.disabled=true;setStatus("กำลังสร้าง Character UI...");
    const ns="ly",item=editableItemSuffix($("itemName")?.value),identifier=`${ns}:${item}`,geometryId=`geometry.${ns}.${item}`,animationId=`animation.${ns}.${item}.idle_motion`;
    const version=parseVersion($("version").value),packName=$("packName").value.trim()||"Customer Model",author=$("author").value.trim()||"Unknown",outputBase=lyFileBase($("customerFileName")?.value,"Customer_Model");
    const controllerItem=`${item}_controller`,controllerDisplayName=$("controllerDisplayName")?.value.trim()||`${outputBase} Controller`,menuTitle=$("controllerMenuTitle")?.value.trim()||"แต่งตัวละคร",slot=$("slot").value,plan=buildCharacterUiPlan(),method=characterUiFacesEnabled()?getFaceMethod():"bone";
    let geometry,texture,icon,animation=null,sources=[];
    if(mode==="bbmodel"){
      geometry=convertBBGeometry(bbData,geometryId);texture=extractEmbeddedTexture(bbData)||$("fallbackTexture").files[0];if(!texture)throw new Error("ไม่พบ Texture กรุณาเพิ่ม Texture สำรอง");icon=texture;
      if($("useAnimation").checked)animation=convertBBAnimations(bbData,animationId);if($("includeSource").checked&&bbSourceFile)sources.push(bbSourceFile);
    }else{
      geometry=JSON.parse(JSON.stringify(manualGeoData));const geos=geometry["minecraft:geometry"];if(!Array.isArray(geos)||!geos.length)throw new Error("ไม่พบ minecraft:geometry");geos[0].description=geos[0].description||{};geos[0].description.identifier=geometryId;
      texture=$("textureFile").files[0];icon=$("iconFile").files[0]||texture;if($("useAnimation").checked&&$("animationFile").files[0])animation=JSON.parse(await $("animationFile").files[0].text());if($("includeSource").checked)for(const id of ["geoFile","textureFile","iconFile","animationFile"])if($(id).files[0])sources.push($(id).files[0]);
    }
    const faceAssets=await readCombinedFaceAssets(plan,method,item,geometry,texture);if($("includeSource").checked)sources.push(...faceAssets.sources);
    const rpHeader=uuid(),rpModule=uuid(),bpHeader=uuid(),bpModule=uuid();
    const bpManifest={format_version:2,header:{name:`${packName} BP [${item}]`,description:`Generated by Rabbit Builder • ${author}`,uuid:bpHeader,version,min_engine_version:[1,21,0]},modules:[{type:"data",uuid:bpModule,version},{type:"script",language:"javascript",entry:"scripts/main.js",uuid:uuid(),version}],dependencies:[{uuid:rpHeader,version},{module_name:"@minecraft/server",version:"1.16.0"},{module_name:"@minecraft/server-ui",version:"1.3.0"}]};
    const rpManifest={format_version:2,header:{name:`${packName} RP [${item}]`,description:`Generated by Rabbit Builder • ${author}`,uuid:rpHeader,version,min_engine_version:[1,21,0]},modules:[{type:"resources",uuid:rpModule,version}]};
    const bp=new JSZip(),rp=new JSZip();bp.file("manifest.json",JSON.stringify(bpManifest,null,2));rp.file("manifest.json",JSON.stringify(rpManifest,null,2));
    rp.folder("models/entity").file(`${item}.geo.json`,JSON.stringify(geometry,null,2));rp.folder("textures/entity").file(`${item}.png`,texture);rp.folder("textures/items").file(`${item}.png`,icon);
    if(method==="model")for(let index=1;index<plan.faces.length;index++)rp.folder("models/entity").file(`${item}_face_${index}.geo.json`,JSON.stringify(faceAssets.geometries[index],null,2));
    if(method==="texture"||method==="model")for(let index=1;index<plan.faces.length;index++)rp.folder("textures/entity").file(`${item}_face_${index}.png`,faceAssets.textures[index]);
    rp.folder("render_controllers").file(`${item}.render_controllers.json`,JSON.stringify(makeCombinedRenderControllers(ns,item,plan,method),null,2));rp.folder("texts").file("languages.json",JSON.stringify(["en_US","th_TH"],null,2));if(animation)rp.folder("animations").file(`${item}.animation.json`,JSON.stringify(animation,null,2));
    const languageEn=[],languageTh=[],displayEn=$("displayEn").value||packName,displayTh=$("displayTh").value||packName;
    const geometryMap={default:geometryId},textureMap={default:`textures/entity/${item}`};
    if(method==="model")for(let index=1;index<plan.faces.length;index++)geometryMap[`face_${index}`]=`geometry.ly.${item}.face_${index}`;
    if(method==="texture"||method==="model")for(let index=1;index<plan.faces.length;index++)textureMap[`face_${index}`]=`textures/entity/${item}_face_${index}`;
    const makeItem=(id,visible)=>({format_version:"1.21.0","minecraft:item":{description:{identifier:id,...(visible?{menu_category:{category:"equipment"}}:{})},components:{"minecraft:display_name":{value:`item.${id}.name`},"minecraft:icon":{textures:{default:item}},"minecraft:wearable":{slot,dispensable:true},"minecraft:max_stack_size":1}}});
    const makeAttachable=(id,renderId)=>{const description={identifier:id,materials:{default:"entity_alphatest"},textures:textureMap,geometry:geometryMap,render_controllers:[renderId]};if(animation){description.animations={custom_animation:animationId};description.scripts={animate:["custom_animation"]}}if($("hideHelmet").checked){description.scripts=description.scripts||{};description.scripts.parent_setup="variable.helmet_layer_visible = 0.0;"}return {format_version:"1.10.0","minecraft:attachable":{description}}};
    plan.states.forEach((state,index)=>{const variantItem=`${item}${index?`_style_${index}`:""}`,variantId=`${ns}:${variantItem}`,renderId=`controller.render.${ns}.${item}.style_${index}`;bp.folder("items").file(`${variantItem}.json`,JSON.stringify(makeItem(variantId,index===0),null,2));rp.folder("attachables").file(`${variantItem}.json`,JSON.stringify(makeAttachable(variantId,renderId),null,2));languageEn.push(`item.${variantId}.name=${displayEn}`);languageTh.push(`item.${variantId}.name=${displayTh}`)});
    const controllerId=`${ns}:${controllerItem}`;bp.folder("items").file(`${controllerItem}.json`,JSON.stringify({format_version:"1.21.0","minecraft:item":{description:{identifier:controllerId,menu_category:{category:"items"}},components:{"minecraft:display_name":{value:`item.${controllerId}.name`},"minecraft:icon":{textures:{default:item}},"minecraft:max_stack_size":1,"minecraft:hand_equipped":true}}},null,2));
    bp.folder("scripts").file("main.js",makeCombinedCharacterControllerScript(ns,controllerItem,item,slot,menuTitle,plan,$("autoGiveController")?.checked===true));languageEn.push(`item.${controllerId}.name=${controllerDisplayName}`);languageTh.push(`item.${controllerId}.name=${controllerDisplayName}`);
    rp.folder("textures").file("item_texture.json",JSON.stringify({resource_pack_name:`${packName} RP`,texture_name:"atlas.items",texture_data:{[item]:{textures:`textures/items/${item}`}}},null,2));rp.folder("texts").file("en_US.lang",languageEn.join("\n")+"\n");rp.folder("texts").file("th_TH.lang",languageTh.join("\n")+"\n");
    const bpBlob=await bp.generateAsync({type:"blob",compression:"DEFLATE"}),rpBlob=await rp.generateAsync({type:"blob",compression:"DEFLATE"}),addon=new JSZip();addon.file(`${outputBase}_BP.mcpack`,bpBlob);addon.file(`${outputBase}_RP.mcpack`,rpBlob);if(sources.length){const folder=addon.folder("source_files");const used=new Set();for(const file of sources){let name=file.name,index=1;while(used.has(name))name=`${index++}_${file.name}`;used.add(name);folder.file(name,file)}}
    if($("includeReadme").checked)addon.file("README_TH.txt",`แพ็ก: ${packName}\nไอเทมหลัก: ${identifier}\nController: /give @s ${controllerId} 1\nสีหน้า: ${plan.faces.length} แบบ\nของตกแต่ง: ${plan.decorations.length} ชิ้น\nรูปแบบภายใน: ${plan.count}\nวิธีใช้: สวมไอเทมหลัก ถือ Controller แล้วกดใช้เพื่อเลือกสีหน้า เปิด–ปิดของตกแต่ง และเปลี่ยนชุด\n`);
    const blob=await addon.generateAsync({type:"blob",compression:"DEFLATE"});download(blob,`${outputBase}.mcaddon`);setStatus(`สร้างสำเร็จ: ${outputBase}.mcaddon • ${plan.faces.length} สีหน้า • ${plan.count} รูปแบบ`);
  }catch(error){setStatus("เกิดข้อผิดพลาด: "+error.message)}finally{refresh()}
}

buildDecorationAddon=buildCombinedCharacterAddon;

installCombinedCharacterUi();
syncCombinedFaceConfiguration();
updateDecorationPreview();
updateAdvancedSummary();
runProjectValidation(false);
