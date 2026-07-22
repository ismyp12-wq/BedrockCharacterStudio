/* Rabbit Builder decoration / outfit controller */
const MAX_DECORATION_VARIANTS=64;

function decorationCleanKey(value,fallback="option"){
  return cleanId(String(value||"").replace(/^ly\s*[:\-_ ]*/i,""),fallback);
}

function createDecorationRow(data={}){
  const row=document.createElement("div");
  row.className="decoration-row";
  row.innerHTML=`
    <span class="drag-dot">⋮⋮</span>
    <input class="deco-label" placeholder="ชื่อ เช่น แว่น" value="${String(data.label||"").replace(/"/g,"&quot;")}">
    <input class="deco-bone" list="boneNameList" placeholder="Bone เช่น Glasses" value="${String(data.bone||"").replace(/"/g,"&quot;")}">
    <select class="deco-type"><option value="toggle">เปิด / ปิด</option><option value="choice">ตัวเลือกชุด</option></select>
    <input class="deco-group" placeholder="ชื่อกลุ่ม เช่น outfit" value="${String(data.group||"").replace(/"/g,"&quot;")}">
    <label class="deco-default"><input type="checkbox" ${data.defaultOn?"checked":""}><span>ค่าเริ่มต้น</span></label>
    <button class="remove-decoration" type="button">×</button>
  `;
  row.querySelector(".deco-type").value=data.type||"toggle";
  const sync=()=>{
    const isChoice=row.querySelector(".deco-type").value==="choice";
    row.querySelector(".deco-group").classList.toggle("hidden",!isChoice);
    updateDecorationPreview();
    runProjectValidation(false);
    updateAdvancedSummary();
  };
  row.querySelectorAll("input,select").forEach(input=>input.addEventListener(input.type==="checkbox"||input.tagName==="SELECT"?"change":"input",sync));
  row.querySelector(".remove-decoration").addEventListener("click",()=>{
    row.remove();
    updateDecorationPreview();
    runProjectValidation(false);
    updateAdvancedSummary();
  });
  sync();
  return row;
}

function getDecorations(){
  return [...document.querySelectorAll(".decoration-row")].map((row,index)=>({
    id:`deco_${index}`,
    label:row.querySelector(".deco-label")?.value.trim()||`ของตกแต่ง ${index+1}`,
    bone:row.querySelector(".deco-bone")?.value.trim()||"",
    type:row.querySelector(".deco-type")?.value==="choice"?"choice":"toggle",
    group:decorationCleanKey(row.querySelector(".deco-group")?.value,"outfit"),
    defaultOn:row.querySelector(".deco-default input")?.checked===true
  }));
}

function decorationStateEquals(a,b){
  return JSON.stringify(a.toggles)===JSON.stringify(b.toggles)&&JSON.stringify(a.choices)===JSON.stringify(b.choices);
}

function buildDecorationPlan(decorations=getDecorations()){
  const toggles=decorations.filter(item=>item.type==="toggle");
  const groupMap=new Map();
  for(const item of decorations.filter(item=>item.type==="choice")){
    if(!groupMap.has(item.group))groupMap.set(item.group,[]);
    groupMap.get(item.group).push(item);
  }
  const groups=[...groupMap.entries()].map(([key,options])=>({key,label:key.replace(/_/g," "),options}));
  const count=(2**toggles.length)*groups.reduce((total,group)=>total*(group.options.length+1),1);
  const states=[];
  function addGroups(groupIndex,choices,toggleValues){
    if(groupIndex>=groups.length){
      const visibility={};
      decorations.forEach(item=>visibility[item.bone]=false);
      toggles.forEach((item,index)=>visibility[item.bone]=!!toggleValues[index]);
      groups.forEach((group,index)=>{
        const selected=choices[index];
        if(selected>=0&&group.options[selected])visibility[group.options[selected].bone]=true;
      });
      states.push({toggles:[...toggleValues],choices:[...choices],visibility});
      return;
    }
    const group=groups[groupIndex];
    for(let selected=-1;selected<group.options.length;selected++)addGroups(groupIndex+1,[...choices,selected],toggleValues);
  }
  for(let mask=0;mask<2**toggles.length;mask++){
    const values=toggles.map((_,index)=>Boolean(mask&(1<<index)));
    addGroups(0,[],values);
  }
  const defaultState={
    toggles:toggles.map(item=>item.defaultOn),
    choices:groups.map(group=>{
      const selected=group.options.findIndex(item=>item.defaultOn);
      return selected;
    })
  };
  const defaultIndex=states.findIndex(state=>decorationStateEquals(state,defaultState));
  if(defaultIndex>0){const [state]=states.splice(defaultIndex,1);states.unshift(state)}
  return {decorations,toggles,groups,count,states};
}

function updateDecorationPreview(){
  const panel=$("decorationPreview");
  if(!panel)return;
  const plan=buildDecorationPlan();
  const controls=[];
  for(const item of plan.toggles)controls.push(`<label><input type="checkbox" ${item.defaultOn?"checked":""} disabled> ${item.label}</label>`);
  for(const group of plan.groups){
    const selected=group.options.findIndex(item=>item.defaultOn);
    controls.push(`<label>${group.label}<select disabled><option>ไม่ใส่</option>${group.options.map((item,index)=>`<option ${index===selected?"selected":""}>${item.label}</option>`).join("")}</select></label>`);
  }
  panel.innerHTML=`<b>ตัวอย่าง UI ในเกม</b><div>${controls.join("")||"เพิ่มของตกแต่งอย่างน้อย 1 ชิ้น"}</div><small>${plan.count} รูปแบบไอเทม${plan.count>MAX_DECORATION_VARIANTS?` • เกินขีดจำกัด ${MAX_DECORATION_VARIANTS}`:""}</small>`;
}

function installDecorationMode(){
  const selector=document.querySelector(".controller-mode-selector");
  if(!selector||document.querySelector('input[name="controllerMode"][value="decorations"]'))return;
  const mergeCard=selector.querySelector('input[value="merge"]')?.closest("label");
  const card=document.createElement("label");
  card.className="controller-mode-card";
  card.innerHTML='<input type="radio" name="controllerMode" value="decorations"><b>UI แต่งตัว / ของตกแต่ง</b><span>เปิด–ปิดแว่น กระเป๋า และเลือกชุดผ่านเมนูในเกม</span>';
  selector.insertBefore(card,mergeCard||null);

  const expressionSection=$("expressionList")?.parentElement;
  if(expressionSection)expressionSection.classList.add("expression-config-section");
  const controllerGrid=document.querySelector(".controller-grid");
  const panel=document.createElement("div");
  panel.id="decorationPanel";
  panel.className="decoration-panel hidden";
  panel.innerHTML=`
    <div class="decoration-header"><div><h4>ของตกแต่งในโมเดล</h4><p>เลือก Bone และกำหนดว่าจะเปิด–ปิด หรืออยู่ในกลุ่มชุด</p></div><button id="addDecorationBtn" type="button">+ เพิ่มของตกแต่ง</button></div>
    <div id="decorationList" class="decoration-list"></div>
    <div class="decoration-note"><b>เปิด / ปิด</b><span>เหมาะกับแว่น กระเป๋า หมวก ผ้าคลุม</span><b>ตัวเลือกชุด</b><span>Bone ในกลุ่มเดียวกันจะแสดงได้ทีละชิ้น เช่น Outfit_A / Outfit_B</span></div>
    <div id="decorationPreview" class="decoration-preview"></div>
  `;
  controllerGrid?.appendChild(panel);
  const defaults=[
    {label:"แว่น",bone:"glasses",type:"toggle",defaultOn:false},
    {label:"กระเป๋า",bone:"backpack",type:"toggle",defaultOn:false},
    {label:"ชุดปกติ",bone:"outfit_normal",type:"choice",group:"outfit",defaultOn:true},
    {label:"ชุดพิเศษ",bone:"outfit_special",type:"choice",group:"outfit",defaultOn:false}
  ];
  defaults.forEach(item=>$("decorationList").appendChild(createDecorationRow(item)));
  $("addDecorationBtn").addEventListener("click",()=>{
    $("decorationList").appendChild(createDecorationRow({label:`ของตกแต่ง ${getDecorations().length+1}`,bone:"",type:"toggle"}));
    updateDecorationPreview();
  });

  const syncMode=()=>{
    const selected=document.querySelector('input[name="controllerMode"]:checked')?.value||"none";
    if(selected==="decorations")controllerMode="decorations";
    const active=selected==="decorations";
    const intro=document.querySelector(".controller-intro");
    const grid=document.querySelector(".controller-grid");
    const preview=document.querySelector(".controller-preview");
    if(active){
      intro?.classList.remove("hidden");grid?.classList.remove("hidden");preview?.classList.add("hidden");
      panel.classList.remove("hidden");
      document.querySelector(".face-method-card")?.classList.add("hidden");
      expressionSection?.classList.add("hidden");
      if($("enableController"))$("enableController").checked=true;
      if(intro?.querySelector("b"))intro.querySelector("b").textContent="กดใช้ Controller → เปิดหน้าแต่งตัว → เปิด–ปิดของตกแต่งหรือเปลี่ยนชุด";
      if(intro?.querySelector("span"))intro.querySelector("span").textContent="ระบบจะสลับรุ่นของไอเทมที่สวมอยู่ จึงไม่ใช้ Tag และไม่ชนกับหัวปกติ";
    }else{
      panel.classList.add("hidden");
      const expressions=selected==="expressions";
      document.querySelector(".face-method-card")?.classList.toggle("hidden",!expressions);
      expressionSection?.classList.toggle("hidden",!expressions);
      if(expressions)preview?.classList.remove("hidden");
    }
    updateDecorationPreview();
    updateAdvancedSummary();
    runProjectValidation(false);
    refresh();
  };
  document.querySelectorAll('input[name="controllerMode"]').forEach(input=>input.addEventListener("change",()=>setTimeout(syncMode,0)));
  updateDecorationPreview();
  injectDecorationStyles();
}

function validateDecorations(problems){
  if(getControllerMode()!=="decorations")return;
  const decorations=getDecorations();
  if(!decorations.length)problems.push({type:"error",text:"ต้องเพิ่มของตกแต่งอย่างน้อย 1 ชิ้น"});
  const bones=new Set();
  const defaultGroups=new Map();
  decorations.forEach(item=>{
    if(!item.bone)problems.push({type:"error",text:`“${item.label}” ยังไม่ได้เลือก Bone`});
    if(item.bone&&detectedBoneNames.length&&!detectedBoneNames.includes(item.bone))problems.push({type:"error",text:`ไม่พบ Bone “${item.bone}” ในโมเดล`});
    if(item.bone&&bones.has(item.bone))problems.push({type:"error",text:`Bone ถูกใช้ซ้ำ: ${item.bone}`});
    bones.add(item.bone);
    if(item.type==="choice"&&item.defaultOn){
      defaultGroups.set(item.group,(defaultGroups.get(item.group)||0)+1);
    }
  });
  for(const [group,count] of defaultGroups)if(count>1)problems.push({type:"error",text:`กลุ่ม ${group} มีค่าเริ่มต้นมากกว่า 1 ชุด`});
  const plan=buildDecorationPlan(decorations);
  if(plan.count>MAX_DECORATION_VARIANTS)problems.push({type:"error",text:`ของตกแต่งสร้าง ${plan.count} รูปแบบ เกินขีดจำกัด ${MAX_DECORATION_VARIANTS} รูปแบบ`});
  else if(plan.count>32)problems.push({type:"warning",text:`จะสร้างไอเทมภายใน ${plan.count} รูปแบบ แพ็กอาจมีขนาดใหญ่ขึ้น`});
}

function renderCombinedValidation(result,showStatus){
  const panel=$("validationPanel");
  if(panel)panel.innerHTML=result.problems.length?result.problems.map(x=>`<li class="${x.type}">${x.type==="error"?"✕":"!"} ${x.text}</li>`).join(""):'<li class="success">✓ พร้อมสร้าง Add-on</li>';
  const headline=$("validationHeadline");
  if(headline)headline.textContent=result.errors?`${result.errors} ข้อผิดพลาด${result.warnings?` • ${result.warnings} คำเตือน`:""}`:result.warnings?`ผ่าน • ${result.warnings} คำเตือน`:"ผ่านทั้งหมด";
  if(showStatus)setStatus(result.errors?`พบ ${result.errors} ข้อผิดพลาด`:result.warnings?`ตรวจผ่าน มี ${result.warnings} คำเตือน`:"ตรวจผ่าน พร้อม Build");
}

const baseProjectValidation=runProjectValidation;
runProjectValidation=function(showStatus=true){
  const base=baseProjectValidation(false);
  if(getControllerMode()!=="decorations"){
    if(showStatus)renderCombinedValidation(base,true);
    return base;
  }
  const problems=[...base.problems];
  validateDecorations(problems);
  const result={problems,errors:problems.filter(x=>x.type==="error").length,warnings:problems.filter(x=>x.type==="warning").length};
  result.ok=result.errors===0;
  renderCombinedValidation(result,showStatus);
  return result;
};

const baseAdvancedSummary=updateAdvancedSummary;
updateAdvancedSummary=function(){
  baseAdvancedSummary();
  if(getControllerMode()!=="decorations")return;
  const summary=$("advancedSummary");
  if(!summary)return;
  const plan=buildDecorationPlan();
  const faceRow=[...summary.children].find(row=>row.querySelector("span")?.textContent==="ระบบสีหน้า");
  if(faceRow)faceRow.innerHTML='<span>ระบบสีหน้า</span><b>ไม่มี</b>';
  const controllerRow=[...summary.children].find(row=>row.querySelector("span")?.textContent==="Controller");
  if(controllerRow)controllerRow.innerHTML=`<span>Controller</span><code>ly:${editableItemSuffix($("itemName")?.value)}_controller</code>`;
  summary.insertAdjacentHTML("beforeend",`<div><span>ของตกแต่ง</span><b>${plan.decorations.length} ชิ้น • ${plan.count} รูปแบบ</b></div>`);
};

const baseProjectSettingsObject=projectSettingsObject;
projectSettingsObject=function(){
  const data=baseProjectSettingsObject();
  data.decorations=getDecorations().map(({label,bone,type,group,defaultOn})=>({label,bone,type,group,defaultOn}));
  return data;
};

async function loadDecorationProjectSettings(event){
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data.decorations))return;
    const list=$("decorationList");
    if(!list)return;
    list.innerHTML="";
    data.decorations.forEach(item=>list.appendChild(createDecorationRow(item)));
    updateDecorationPreview();
    setTimeout(()=>{updateAdvancedSummary();runProjectValidation(false)},0);
  }catch(_error){}
}

function makeDecorationRenderControllers(ns,item,plan){
  const controllers={};
  plan.states.forEach((state,index)=>{
    const visibility={};
    for(const decoration of plan.decorations)if(decoration.bone)visibility[decoration.bone]=state.visibility[decoration.bone]?"1.0":"0.0";
    controllers[`controller.render.${ns}.${item}.look_${index}`]={geometry:"Geometry.default",materials:[{"*":"Material.default"}],textures:["Texture.default"],part_visibility:visibility};
  });
  return {format_version:"1.8.0",render_controllers:controllers};
}

function makeDecorationControllerScript(ns,controllerItem,modelItem,slot,title,body,plan,autoGive){
  const modelItems=plan.states.map((_,index)=>`${ns}:${modelItem}${index?`_look_${index}`:""}`);
  const states=plan.states.map(state=>({toggles:state.toggles,choices:state.choices}));
  const toggles=plan.toggles.map(item=>({label:item.label}));
  const groups=plan.groups.map(group=>({label:group.label,options:group.options.map(item=>item.label)}));
  const slotConstant=equipmentSlotConstant(slot);
  return `import { world, system, ItemStack, EquipmentSlot, EntityComponentTypes } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
const CONTROLLER_ITEM=${JSON.stringify(`${ns}:${controllerItem}`)};
const MODEL_ITEMS=${JSON.stringify(modelItems)};
const STATES=${JSON.stringify(states)};
const TOGGLES=${JSON.stringify(toggles)};
const GROUPS=${JSON.stringify(groups)};
const EQUIPMENT_SLOT=EquipmentSlot.${slotConstant};
function sameState(state,toggles,choices){return JSON.stringify(state.toggles)===JSON.stringify(toggles)&&JSON.stringify(state.choices)===JSON.stringify(choices);}
async function openMenu(player){
  const equippable=player.getComponent(EntityComponentTypes.Equippable);
  const current=equippable?.getEquipment(EQUIPMENT_SLOT);
  const currentIndex=current?MODEL_ITEMS.indexOf(current.typeId):-1;
  if(currentIndex<0){player.sendMessage("§cกรุณาสวมโมเดล ${ns}:${modelItem} ก่อนใช้ Controller");return;}
  const currentState=STATES[currentIndex]||STATES[0];
  const form=new ModalFormData().title(${JSON.stringify(title)});
  TOGGLES.forEach((control,index)=>form.toggle(control.label,currentState.toggles[index]===true));
  GROUPS.forEach((group,index)=>form.dropdown(group.label,["ไม่ใส่",...group.options],(currentState.choices[index]??-1)+1));
  form.submitButton("บันทึกการแต่งตัว");
  const response=await form.show(player);
  if(response.canceled||!response.formValues)return;
  const values=response.formValues;
  const toggleValues=TOGGLES.map((_,index)=>values[index]===true);
  const choiceValues=GROUPS.map((_,index)=>Number(values[TOGGLES.length+index]??0)-1);
  const targetIndex=STATES.findIndex(state=>sameState(state,toggleValues,choiceValues));
  if(targetIndex<0){player.sendMessage("§cไม่พบรูปแบบการแต่งตัวนี้");return;}
  system.run(()=>equippable.setEquipment(EQUIPMENT_SLOT,new ItemStack(MODEL_ITEMS[targetIndex],1)));
}
world.afterEvents.itemUse.subscribe(event=>{
  if(event.itemStack?.typeId!==CONTROLLER_ITEM)return;
  system.run(()=>openMenu(event.source));
});
${autoGive?`world.afterEvents.playerSpawn.subscribe(event=>{if(!event.initialSpawn)return;system.runTimeout(()=>{const container=event.player.getComponent("minecraft:inventory")?.container;if(!container)return;let found=false;for(let i=0;i<container.size;i++)if(container.getItem(i)?.typeId===CONTROLLER_ITEM)found=true;if(!found)container.addItem(new ItemStack(CONTROLLER_ITEM,1));},20);});`:""}`;
}

async function buildDecorationAddon(){
  const button=$("buildBtn");
  try{
    const validation=runProjectValidation(true);
    if(!validation.ok)throw new Error("กรุณาแก้รายการตรวจสอบก่อน Build");
    button.disabled=true;
    setStatus("กำลังสร้างโหมด UI แต่งตัว...");
    const ns="ly";
    const item=editableItemSuffix($("itemName")?.value);
    const identifier=`${ns}:${item}`;
    const geometryId=`geometry.${ns}.${item}`;
    const animationId=`animation.${ns}.${item}.idle_motion`;
    const version=parseVersion($("version").value);
    const packName=$("packName").value.trim()||"Customer Model";
    const author=$("author").value.trim()||"Unknown";
    const outputBase=lyFileBase($("customerFileName")?.value,"Customer_Model");
    const controllerItem=`${item}_controller`;
    const controllerDisplayName=$("controllerDisplayName")?.value.trim()||`${outputBase} Controller`;
    const menuTitle=$("controllerMenuTitle")?.value.trim()||"แต่งตัว";
    const menuBody=$("controllerMenuBody")?.value.trim()||"เลือกของตกแต่งที่ต้องการ";
    const slot=$("slot").value;
    const plan=buildDecorationPlan();

    let geometry,texture,icon,animation=null,sources=[];
    if(mode==="bbmodel"){
      geometry=convertBBGeometry(bbData,geometryId);
      texture=extractEmbeddedTexture(bbData)||$("fallbackTexture").files[0];
      if(!texture)throw new Error("ไม่พบ Texture กรุณาเพิ่ม Texture สำรอง");
      icon=texture;
      if($("useAnimation").checked)animation=convertBBAnimations(bbData,animationId);
      if($("includeSource").checked&&bbSourceFile)sources.push(bbSourceFile);
    }else{
      geometry=JSON.parse(JSON.stringify(manualGeoData));
      const geos=geometry["minecraft:geometry"];
      if(!Array.isArray(geos)||!geos.length)throw new Error("ไม่พบ minecraft:geometry");
      geos[0].description=geos[0].description||{};
      geos[0].description.identifier=geometryId;
      texture=$("textureFile").files[0];
      icon=$("iconFile").files[0]||texture;
      if($("useAnimation").checked&&$("animationFile").files[0])animation=JSON.parse(await $("animationFile").files[0].text());
      if($("includeSource").checked)for(const id of ["geoFile","textureFile","iconFile","animationFile"])if($(id).files[0])sources.push($(id).files[0]);
    }

    const rpHeader=uuid(),rpModule=uuid(),bpHeader=uuid(),bpModule=uuid();
    const bpManifest={format_version:2,header:{name:`${packName} BP [${item}]`,description:`Generated by Rabbit Builder • ${author}`,uuid:bpHeader,version,min_engine_version:[1,21,0]},modules:[{type:"data",uuid:bpModule,version},{type:"script",language:"javascript",entry:"scripts/main.js",uuid:uuid(),version}],dependencies:[{uuid:rpHeader,version},{module_name:"@minecraft/server",version:"1.16.0"},{module_name:"@minecraft/server-ui",version:"1.3.0"}]};
    const rpManifest={format_version:2,header:{name:`${packName} RP [${item}]`,description:`Generated by Rabbit Builder • ${author}`,uuid:rpHeader,version,min_engine_version:[1,21,0]},modules:[{type:"resources",uuid:rpModule,version}]};
    const renderFile=makeDecorationRenderControllers(ns,item,plan);
    const bp=new JSZip(),rp=new JSZip();
    bp.file("manifest.json",JSON.stringify(bpManifest,null,2));rp.file("manifest.json",JSON.stringify(rpManifest,null,2));
    rp.folder("models/entity").file(`${item}.geo.json`,JSON.stringify(geometry,null,2));
    rp.folder("textures/entity").file(`${item}.png`,texture);rp.folder("textures/items").file(`${item}.png`,icon);
    rp.folder("render_controllers").file(`${item}.render_controllers.json`,JSON.stringify(renderFile,null,2));
    rp.folder("texts").file("languages.json",JSON.stringify(["en_US","th_TH"],null,2));
    if(animation)rp.folder("animations").file(`${item}.animation.json`,JSON.stringify(animation,null,2));

    const makeItem=(id,visible)=>({format_version:"1.21.0","minecraft:item":{description:{identifier:id,...(visible?{menu_category:{category:"equipment"}}:{})},components:{"minecraft:display_name":{value:`item.${id}.name`},"minecraft:icon":{textures:{default:item}},"minecraft:wearable":{slot,dispensable:true},"minecraft:max_stack_size":1}}});
    const makeAttachable=(id,renderId)=>{
      const description={identifier:id,materials:{default:"entity_alphatest"},textures:{default:`textures/entity/${item}`},geometry:{default:geometryId},render_controllers:[renderId]};
      if(animation){description.animations={custom_animation:animationId};description.scripts={animate:["custom_animation"]}}
      if($("hideHelmet").checked){description.scripts=description.scripts||{};description.scripts.parent_setup="variable.helmet_layer_visible = 0.0;"}
      return {format_version:"1.10.0","minecraft:attachable":{description}};
    };
    const languageEn=[],languageTh=[];
    const displayEn=$("displayEn").value||packName,displayTh=$("displayTh").value||packName;
    plan.states.forEach((state,index)=>{
      const variantItem=`${item}${index?`_look_${index}`:""}`,variantId=`${ns}:${variantItem}`,renderId=`controller.render.${ns}.${item}.look_${index}`;
      bp.folder("items").file(`${variantItem}.json`,JSON.stringify(makeItem(variantId,index===0),null,2));
      rp.folder("attachables").file(`${variantItem}.json`,JSON.stringify(makeAttachable(variantId,renderId),null,2));
      languageEn.push(`item.${variantId}.name=${displayEn}`);languageTh.push(`item.${variantId}.name=${displayTh}`);
    });
    const controllerId=`${ns}:${controllerItem}`;
    bp.folder("items").file(`${controllerItem}.json`,JSON.stringify({format_version:"1.21.0","minecraft:item":{description:{identifier:controllerId,menu_category:{category:"items"}},components:{"minecraft:display_name":{value:`item.${controllerId}.name`},"minecraft:icon":{textures:{default:item}},"minecraft:max_stack_size":1,"minecraft:hand_equipped":true}}},null,2));
    bp.folder("scripts").file("main.js",makeDecorationControllerScript(ns,controllerItem,item,slot,menuTitle,menuBody,plan,$("autoGiveController")?.checked===true));
    languageEn.push(`item.${controllerId}.name=${controllerDisplayName}`);languageTh.push(`item.${controllerId}.name=${controllerDisplayName}`);
    rp.folder("textures").file("item_texture.json",JSON.stringify({resource_pack_name:`${packName} RP`,texture_name:"atlas.items",texture_data:{[item]:{textures:`textures/items/${item}`}}},null,2));
    rp.folder("texts").file("en_US.lang",languageEn.join("\n")+"\n");rp.folder("texts").file("th_TH.lang",languageTh.join("\n")+"\n");

    const bpBlob=await bp.generateAsync({type:"blob",compression:"DEFLATE"}),rpBlob=await rp.generateAsync({type:"blob",compression:"DEFLATE"});
    const addon=new JSZip();addon.file(`${outputBase}_BP.mcpack`,bpBlob);addon.file(`${outputBase}_RP.mcpack`,rpBlob);
    if(sources.length){const folder=addon.folder("source_files");for(const file of sources)folder.file(file.name,file)}
    if($("includeReadme").checked)addon.file("README_TH.txt",`แพ็ก: ${packName}\nไอเทมหลัก: ${identifier}\nController: /give @s ${controllerId} 1\nของตกแต่ง: ${plan.decorations.length} ชิ้น\nรูปแบบภายใน: ${plan.count}\nวิธีใช้: สวมไอเทมหลัก ถือ Controller แล้วกดใช้เพื่อเปิดหน้าแต่งตัว\n`);
    const blob=await addon.generateAsync({type:"blob",compression:"DEFLATE"});download(blob,`${outputBase}.mcaddon`);setStatus(`สร้างสำเร็จ: ${outputBase}.mcaddon • ${plan.count} รูปแบบ`);
  }catch(error){setStatus("เกิดข้อผิดพลาด: "+error.message)}finally{refresh()}
}

function injectDecorationStyles(){
  const style=document.createElement("style");style.id="decorationStyles";style.textContent=`
    .controller-mode-selector{grid-template-columns:repeat(4,1fr)!important}.decoration-panel{grid-column:1/-1;padding:15px;border:1px solid #dedde9;border-radius:14px;background:#faf9ff}.decoration-header{display:flex;justify-content:space-between;align-items:center;gap:10px}.decoration-header h4{margin:0;font-size:12px}.decoration-header p{margin:4px 0 0;font-size:9px;color:#898b9f}.decoration-header button{border:0;border-radius:8px;background:#27235d;color:white;padding:8px 11px;font-size:8px}.decoration-list{display:grid;gap:7px;margin-top:12px}.decoration-row{display:grid;grid-template-columns:22px 1fr 1fr 110px 1fr 100px 30px;gap:6px;align-items:center}.decoration-row input,.decoration-row select{min-width:0;border:1px solid #dedde9;border-radius:8px;padding:8px;font-size:8px;background:white}.deco-default{display:flex;align-items:center;gap:4px;font-size:8px}.deco-default input{width:auto}.remove-decoration{border:0;border-radius:7px;padding:7px;background:#fff0f0;color:#a93636}.decoration-note{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:6px 10px;margin-top:10px;padding:10px;border-radius:9px;background:#f0edff;font-size:8px}.decoration-preview{margin-top:10px;padding:12px;border:1px solid #dedde9;border-radius:10px;background:white}.decoration-preview>b{font-size:10px}.decoration-preview>div{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:8px}.decoration-preview label{font-size:8px}.decoration-preview select{width:100%;margin-top:3px}.decoration-preview small{display:block;margin-top:8px;color:#7763c8}@media(max-width:900px){.controller-mode-selector{grid-template-columns:repeat(2,1fr)!important}.decoration-row{grid-template-columns:20px 1fr 1fr}.decoration-row>*{min-width:0}.decoration-preview>div{grid-template-columns:1fr}}@media(max-width:600px){.controller-mode-selector{grid-template-columns:1fr!important}.decoration-row{grid-template-columns:1fr}.drag-dot{display:none}.decoration-note{grid-template-columns:1fr}.decoration-header{align-items:flex-start;flex-direction:column}}
  `;document.head.appendChild(style);
}

installDecorationMode();
$("openProjectFile")?.addEventListener("change",loadDecorationProjectSettings);
$("buildBtn")?.addEventListener("click",event=>{
  if(getControllerMode()!=="decorations")return;
  event.preventDefault();event.stopImmediatePropagation();buildDecorationAddon();
},true);
updateDecorationPreview();
updateAdvancedSummary();
runProjectValidation(false);
