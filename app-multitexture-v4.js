/* LY Studio v4 — Geo JSON multi-texture mapping and builder */
(function(){
  if(window.__lyMultiTextureV4)return;
  window.__lyMultiTextureV4=true;

  const $id=id=>document.getElementById(id);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const norm=value=>String(value||"").toLowerCase().replace(/\.(png|tga|jpg|jpeg)$/i,"").replace(/texture|textures|diffuse|skin|model|geo|geometry/g,"").replace(/[^a-z0-9]/g,"");
  const safe=value=>String(value||"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"").toLowerCase()||"texture";
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  const multi={enabled:false,entries:[],geometryToken:"",building:false};

  function textureInput(){return $id("textureFile")}
  function selectedFiles(){return [...(textureInput()?.files||[])].filter(file=>file.type==="image/png"||/\.png$/i.test(file.name))}
  function manualGeometry(){return typeof manualGeoData!=="undefined"&&manualGeoData?manualGeoData:null}
  function geometryBones(){
    const geometry=manualGeometry()?.["minecraft:geometry"]?.[0];
    return Array.isArray(geometry?.bones)?geometry.bones:[];
  }
  function visualBones(){return geometryBones().filter(bone=>(Array.isArray(bone.cubes)&&bone.cubes.length)||bone.poly_mesh).map(bone=>String(bone.name||"")).filter(Boolean)}
  function allBoneNames(){return geometryBones().map(bone=>String(bone.name||"")).filter(Boolean)}

  function roleMatches(base,names){
    const key=norm(base);const result=[];
    const add=patterns=>names.forEach(name=>{const n=norm(name);if(patterns.some(pattern=>pattern.test(n))&&!result.includes(name))result.push(name)});
    if(/rightarm|rarm|armright/.test(key))add([/right.*arm/,/arm.*right/,/^rarm/]);
    else if(/leftarm|larm|armleft/.test(key))add([/left.*arm/,/arm.*left/,/^larm/]);
    else if(/arms|botharm/.test(key))add([/arm/]);
    else if(/rightleg|rleg|legright/.test(key))add([/right.*leg/,/leg.*right/,/^rleg/]);
    else if(/leftleg|lleg|legleft/.test(key))add([/left.*leg/,/leg.*left/,/^lleg/]);
    else if(/legs|bothleg/.test(key))add([/leg/]);
    else if(/head|face|hair|hat/.test(key))add([/head/,/face/,/hair/,/hat/]);
    else if(/body|torso|chest|waist/.test(key))add([/body/,/torso/,/chest/,/waist/]);
    else if(/wing/.test(key))add([/wing/]);
    else if(/cape|cloak/.test(key))add([/cape/,/cloak/]);
    else if(/tail/.test(key))add([/tail/]);
    return result;
  }

  function autoBonesForFile(file,index){
    const names=visualBones();const base=file.name.replace(/\.[^.]+$/,"");const key=norm(base);if(!key)return [];
    const role=roleMatches(base,names);if(role.length)return role;
    const scored=names.map(name=>{
      const bone=norm(name);let score=0;
      if(key===bone)score=120;
      else if(key.includes(bone)&&bone.length>=3)score=Math.max(score,95+Math.min(15,bone.length));
      else if(bone.includes(key)&&key.length>=3)score=Math.max(score,85+Math.min(15,key.length));
      const tokens=base.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>1);
      for(const token of tokens){const t=norm(token);if(t&&bone.includes(t))score+=18;}
      return {name,score};
    }).sort((a,b)=>b.score-a.score);
    if(scored[0]?.score>=70)return scored.filter(item=>item.score>=Math.max(70,scored[0].score-12)).map(item=>item.name);
    return index===0?[]:[];
  }

  function imageInfo(file){
    return new Promise(resolve=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{resolve({width:img.naturalWidth||64,height:img.naturalHeight||64});URL.revokeObjectURL(url)};img.onerror=()=>{resolve({width:64,height:64});URL.revokeObjectURL(url)};img.src=url;});
  }

  async function refreshEntries(forceAuto=false){
    const files=selectedFiles();const old=new Map(multi.entries.map(entry=>[`${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`,entry]));
    multi.entries=[];
    for(let index=0;index<files.length;index++){
      const file=files[index],key=`${file.name}:${file.size}:${file.lastModified}`,previous=old.get(key),info=previous?.info||await imageInfo(file);
      multi.entries.push({file,info,bones:forceAuto||!previous?autoBonesForFile(file,index):[...(previous.bones||[])]});
    }
    multi.enabled=files.length>1;
    renderPanel();
    updateTextureLabel();
    if(typeof runProjectValidation==="function")runProjectValidation(false);
  }

  function updateTextureLabel(){
    const files=selectedFiles(),label=$id("textureName");
    if(label)label.textContent=files.length>1?`${files.length} PNG • Multi-Texture`:files[0]?.name||"ยังไม่ได้เลือก";
  }

  function createUi(){
    const input=textureInput();if(!input||$id("multiTexturePanel"))return;
    input.multiple=true;
    const box=input.closest(".upload-box");
    const title=box?.querySelector("b"),small=box?.querySelector("small");
    if(title)title.textContent="Texture / หลาย Texture";
    if(small)small.textContent=".png • เลือกหลายไฟล์พร้อมกันได้";
    const panel=document.createElement("div");panel.id="multiTexturePanel";panel.className="multi-texture-panel hidden";
    panel.innerHTML=`
      <div class="mt-head"><div><h4>Multi-Texture Mapping</h4><p>จับคู่ PNG แต่ละไฟล์กับ Bone ของโมเดล แล้วสร้าง Geometry/Render Controller แยกให้ Minecraft</p></div><button id="mtAuto" type="button">ตรวจจับใหม่</button></div>
      <div class="mt-note"><b>หลักการตรวจจับ</b><span>ชื่อไฟล์ควรคล้าย Bone เช่น Head.png, Body.png, Arms.png หรือ Wings.png • Bone ที่ไม่ถูกเลือกจะใช้ PNG ไฟล์แรก</span></div>
      <div id="mtList" class="mt-list"></div>
      <div id="mtSummary" class="mt-summary"></div>`;
    const grid=$id("manualMode")?.querySelector(".upload-grid");grid?.insertAdjacentElement("afterend",panel);
    $id("mtAuto")?.addEventListener("click",()=>refreshEntries(true));
    input.addEventListener("change",()=>setTimeout(()=>refreshEntries(true),0));
    $id("geoFile")?.addEventListener("change",()=>setTimeout(()=>refreshEntries(true),30));
  }

  function renderPanel(){
    const panel=$id("multiTexturePanel"),list=$id("mtList"),summary=$id("mtSummary");if(!panel||!list||!summary)return;
    const files=selectedFiles();panel.classList.toggle("hidden",files.length<2);
    if(files.length<2){list.innerHTML="";summary.innerHTML="";return;}
    const names=allBoneNames();
    list.innerHTML=multi.entries.map((entry,index)=>`
      <div class="mt-row" data-index="${index}">
        <div class="mt-file"><span>${index===0?"หลัก":"PNG"}</span><div><b>${esc(entry.file.name)}</b><small>${entry.info.width}×${entry.info.height}px • ${(entry.file.size/1024).toFixed(1)} KB</small></div></div>
        <label><span>ใช้กับ Bone</span><select class="mt-bones" multiple size="${Math.min(6,Math.max(3,names.length))}">${names.map(name=>`<option value="${esc(name)}" ${entry.bones.includes(name)?"selected":""}>${esc(name)}</option>`).join("")}</select><small>${index===0?"Bone ที่ไม่จับคู่จะกลับมาใช้ไฟล์นี้":"กด Ctrl เพื่อเลือกหลาย Bone"}</small></label>
      </div>`).join("");
    list.querySelectorAll(".mt-bones").forEach(select=>select.addEventListener("change",()=>{
      const index=Number(select.closest(".mt-row").dataset.index);multi.entries[index].bones=[...select.selectedOptions].map(option=>option.value);renderSummary();
    }));
    renderSummary();
  }

  function assignmentReport(){
    const visual=visualBones(),owners=new Map(),duplicates=[];
    multi.entries.forEach((entry,index)=>entry.bones.forEach(name=>{if(owners.has(name))duplicates.push(name);else owners.set(name,index)}));
    const fallback=[];for(const name of visual)if(!owners.has(name)){owners.set(name,0);fallback.push(name)}
    return {visual,owners,duplicates:[...new Set(duplicates)],fallback};
  }

  function renderSummary(){
    const target=$id("mtSummary");if(!target)return;const report=assignmentReport();
    target.innerHTML=`<div><b>${multi.entries.length}</b><span>Texture</span></div><div><b>${report.owners.size}/${report.visual.length}</b><span>Bone มีภาพ</span></div><div class="${report.duplicates.length?"bad":""}"><b>${report.duplicates.length}</b><span>Bone ซ้ำ</span></div><p>${report.fallback.length?`ใช้ PNG หลักกับ Bone ที่เหลือ: ${esc(report.fallback.join(", "))}`:"จับคู่ Bone ที่มีภาพครบแล้ว"}</p>`;
  }

  function descendants(){
    const children=new Map();geometryBones().forEach(bone=>{if(!bone.parent)return;const parent=String(bone.parent);if(!children.has(parent))children.set(parent,[]);children.get(parent).push(String(bone.name))});
    const collect=name=>{const out=[name];for(const child of children.get(name)||[])out.push(...collect(child));return out};
    return {children,collect};
  }

  function resolvedOwners(){
    const report=assignmentReport(),explicit=new Map();multi.entries.forEach((entry,index)=>entry.bones.forEach(name=>{if(!explicit.has(name))explicit.set(name,index)}));
    const {collect}=descendants(),owners=new Map();
    for(const [name,index] of explicit)for(const child of collect(name))if(!owners.has(child))owners.set(child,index);
    for(const name of allBoneNames())if(!owners.has(name))owners.set(name,explicit.get(name)??0);
    return owners;
  }

  function buildPartGeometries(base,geometryBaseId){
    const owners=resolvedOwners();
    return multi.entries.map((entry,index)=>{
      const data=clone(base),geometry=data?.["minecraft:geometry"]?.[0];if(!geometry)throw new Error("ไม่พบ minecraft:geometry");
      geometry.description=geometry.description||{};geometry.description.identifier=`${geometryBaseId}.part_${index}`;geometry.description.texture_width=entry.info.width;geometry.description.texture_height=entry.info.height;
      for(const bone of geometry.bones||[]){if((owners.get(String(bone.name))??0)!==index){delete bone.cubes;delete bone.poly_mesh;}}
      return {index,entry,geometry:data,geometryId:geometry.description.identifier,key:`part_${index}`};
    });
  }

  function makeRenderControllers(ns,item,parts,states){
    const controllers={};
    states.forEach((state,stateIndex)=>parts.forEach(part=>{
      const id=`controller.render.${ns}.${item}.${state.key}_${stateIndex}.part_${part.index}`;
      const controller={geometry:`Geometry.${part.key}`,materials:[{"*":"Material.default"}],textures:[`Texture.${part.key}`]};
      if(state.visibility&&Object.keys(state.visibility).length)controller.part_visibility=Object.fromEntries(Object.entries(state.visibility).map(([name,value])=>[name,value===true||value==="1.0"?"1.0":"0.0"]));
      controllers[id]=controller;state.controllers.push(id);
    }));
    return {format_version:"1.8.0",render_controllers:controllers};
  }

  function makeAttachable(identifier,geometryMap,textureMap,controllers,animation,animationId){
    const description={identifier,materials:{default:"entity_alphatest"},textures:textureMap,geometry:geometryMap,render_controllers:controllers};
    if(animation){description.animations={custom_animation:animationId};description.scripts={animate:["custom_animation"]};}
    if($id("hideHelmet")?.checked){description.scripts=description.scripts||{};description.scripts.parent_setup="variable.helmet_layer_visible = 0.0;";}
    return {format_version:"1.10.0","minecraft:attachable":{description}};
  }

  function makeWearableItem(identifier,item,slot,visible=true){
    return {format_version:"1.21.0","minecraft:item":{description:{identifier,...(visible?{menu_category:{category:"equipment"}}:{})},components:{"minecraft:display_name":{value:`item.${identifier}.name`},"minecraft:icon":{textures:{default:item}},"minecraft:wearable":{slot,dispensable:true},"minecraft:max_stack_size":1}}};
  }

  function controllerItemJson(identifier,item){
    return {format_version:"1.21.0","minecraft:item":{description:{identifier,menu_category:{category:"items"}},components:{"minecraft:display_name":{value:`item.${identifier}.name`},"minecraft:icon":{textures:{default:item}},"minecraft:max_stack_size":1,"minecraft:hand_equipped":true}}};
  }

  function statesForMode(controllerMode,item){
    if(controllerMode==="expressions"){
      const method=typeof getFaceMethod==="function"?getFaceMethod():"bone";
      if(method!=="bone")throw new Error("Multi-Texture หลายส่วนรองรับสีหน้าแบบ Bone ก่อน กรุณาเลือกวิธี Bone");
      const expressions=typeof getExpressions==="function"?getExpressions():[];const faceBones=expressions.map(x=>x.bone).filter(Boolean);
      return {kind:"expr",states:expressions.map((expression,index)=>{const visibility={};faceBones.forEach(name=>visibility[name]=name===expression.bone);return {key:"expr",index,label:expression.label,visibility,controllers:[]}}),expressions};
    }
    if(controllerMode==="decorations"){
      const plan=buildDecorationPlan();
      return {kind:"look",states:plan.states.map((state,index)=>({key:"look",index,label:`รูปแบบ ${index+1}`,visibility:state.visibility||{},controllers:[]})),plan};
    }
    return {kind:"base",states:[{key:"base",index:0,label:"ปกติ",visibility:null,controllers:[]}]};
  }

  async function buildMultiTextureAddon(){
    if(multi.building)return;multi.building=true;const button=$id("buildBtn");
    try{
      const validation=typeof runProjectValidation==="function"?runProjectValidation(true):{ok:true};if(validation&&!validation.ok)throw new Error("กรุณาแก้รายการตรวจสอบก่อน Build");
      const report=assignmentReport();if(report.duplicates.length)throw new Error(`Bone ถูกเลือกซ้ำหลาย Texture: ${report.duplicates.join(", ")}`);
      if(!manualGeometry())throw new Error("ต้องเลือก Geometry .geo.json ก่อน");if(multi.entries.length<2)throw new Error("เลือก PNG อย่างน้อย 2 ไฟล์");
      button.disabled=true;setStatus("กำลังสร้าง Multi-Texture Add-on...");
      const ns="ly",item=typeof editableItemSuffix==="function"?editableItemSuffix($id("itemName")?.value):customerItemId($id("itemName")?.value),identifier=`${ns}:${item}`,geometryBaseId=`geometry.${ns}.${item}`,animationId=`animation.${ns}.${item}.idle_motion`;
      const version=parseVersion($id("version")?.value||"1.0.0"),packName=$id("packName")?.value.trim()||"Customer Model",author=$id("author")?.value.trim()||"Unknown",outputBase=lyFileBase($id("customerFileName")?.value,"Customer_Model"),slot=$id("slot")?.value||"slot.armor.head",controllerMode=getControllerMode();
      const modeState=statesForMode(controllerMode,item),parts=buildPartGeometries(manualGeometry(),geometryBaseId),renderFile=makeRenderControllers(ns,item,parts,modeState.states);
      const animation=$id("useAnimation")?.checked&&$id("animationFile")?.files?.[0]?JSON.parse(await $id("animationFile").files[0].text()):null;
      const icon=$id("iconFile")?.files?.[0]||multi.entries[0].file;
      const rpHeader=uuid(),rpModule=uuid(),bpHeader=uuid(),bpModule=uuid(),scripted=controllerMode==="expressions"||controllerMode==="decorations";
      const bpModules=[{type:"data",uuid:bpModule,version}],dependencies=[{uuid:rpHeader,version}];if(scripted){bpModules.push({type:"script",language:"javascript",entry:"scripts/main.js",uuid:uuid(),version});dependencies.push({module_name:"@minecraft/server",version:"1.16.0"},{module_name:"@minecraft/server-ui",version:"1.3.0"});}
      const bpManifest={format_version:2,header:{name:`${packName} BP [${item}]`,description:`Generated by LY Studio Multi-Texture • ${author}`,uuid:bpHeader,version,min_engine_version:[1,21,0]},modules:bpModules,dependencies};
      const rpManifest={format_version:2,header:{name:`${packName} RP [${item}]`,description:`Generated by LY Studio Multi-Texture • ${author}`,uuid:rpHeader,version,min_engine_version:[1,21,0]},modules:[{type:"resources",uuid:rpModule,version}]};
      const bp=new JSZip(),rp=new JSZip();bp.file("manifest.json",JSON.stringify(bpManifest,null,2));rp.file("manifest.json",JSON.stringify(rpManifest,null,2));
      const geometryMap={},textureMap={};
      for(const part of parts){geometryMap[part.key]=part.geometryId;textureMap[part.key]=`textures/entity/${item}_${part.key}`;rp.folder("models/entity").file(`${item}_${part.key}.geo.json`,JSON.stringify(part.geometry,null,2));rp.folder("textures/entity").file(`${item}_${part.key}.png`,part.entry.file);}
      rp.folder("textures/items").file(`${item}.png`,icon);rp.folder("render_controllers").file(`${item}.render_controllers.json`,JSON.stringify(renderFile,null,2));rp.folder("texts").file("languages.json",JSON.stringify(["en_US","th_TH"],null,2));if(animation)rp.folder("animations").file(`${item}.animation.json`,JSON.stringify(animation,null,2));
      const displayEn=$id("displayEn")?.value||packName,displayTh=$id("displayTh")?.value||packName,langEn=[],langTh=[];
      const writeVariant=(variantItem,variantId,state,visible)=>{bp.folder("items").file(`${variantItem}.json`,JSON.stringify(makeWearableItem(variantId,item,slot,visible),null,2));rp.folder("attachables").file(`${variantItem}.json`,JSON.stringify(makeAttachable(variantId,geometryMap,textureMap,state.controllers,animation,animationId),null,2));langEn.push(`item.${variantId}.name=${displayEn}`);langTh.push(`item.${variantId}.name=${displayTh}`);};
      if(controllerMode==="expressions"){
        modeState.states.forEach((state,index)=>{const variantItem=`${item}${index?`_expr_${index}`:""}`;writeVariant(variantItem,`${ns}:${variantItem}`,state,index===0)});
        const controllerItem=`${item}_controller`,controllerId=`${ns}:${controllerItem}`;bp.folder("items").file(`${controllerItem}.json`,JSON.stringify(controllerItemJson(controllerId,item),null,2));bp.folder("scripts").file("main.js",makeControllerScript(ns,controllerItem,item,slot,$id("controllerMenuTitle")?.value||"เลือกสีหน้า",$id("controllerMenuBody")?.value||"เลือกสีหน้า",modeState.expressions,$id("autoGiveController")?.checked===true));langEn.push(`item.${controllerId}.name=${$id("controllerDisplayName")?.value||"Character Controller"}`);langTh.push(`item.${controllerId}.name=${$id("controllerDisplayName")?.value||"Character Controller"}`);
      }else if(controllerMode==="decorations"){
        modeState.states.forEach((state,index)=>{const variantItem=`${item}${index?`_look_${index}`:""}`;writeVariant(variantItem,`${ns}:${variantItem}`,state,index===0)});
        const controllerItem=`${item}_controller`,controllerId=`${ns}:${controllerItem}`;bp.folder("items").file(`${controllerItem}.json`,JSON.stringify(controllerItemJson(controllerId,item),null,2));bp.folder("scripts").file("main.js",makeDecorationControllerScript(ns,controllerItem,item,slot,$id("controllerMenuTitle")?.value||"แต่งตัว",$id("controllerMenuBody")?.value||"เลือกของตกแต่ง",modeState.plan,$id("autoGiveController")?.checked===true));langEn.push(`item.${controllerId}.name=${$id("controllerDisplayName")?.value||"Character Controller"}`);langTh.push(`item.${controllerId}.name=${$id("controllerDisplayName")?.value||"Character Controller"}`);
      }else writeVariant(item,identifier,modeState.states[0],true);
      rp.folder("textures").file("item_texture.json",JSON.stringify({resource_pack_name:`${packName} RP`,texture_name:"atlas.items",texture_data:{[item]:{textures:`textures/items/${item}`}}},null,2));rp.folder("texts").file("en_US.lang",langEn.join("\n")+"\n");rp.folder("texts").file("th_TH.lang",langTh.join("\n")+"\n");
      const bpBlob=await bp.generateAsync({type:"blob",compression:"DEFLATE"}),rpBlob=await rp.generateAsync({type:"blob",compression:"DEFLATE"}),addon=new JSZip();addon.file(`${outputBase}_BP.mcpack`,bpBlob);addon.file(`${outputBase}_RP.mcpack`,rpBlob);
      if($id("includeSource")?.checked){const source=addon.folder("source_files");const geo=$id("geoFile")?.files?.[0];if(geo)source.file(geo.name,geo);for(const entry of multi.entries)source.file(entry.file.name,entry.file);const anim=$id("animationFile")?.files?.[0];if(anim)source.file(anim.name,anim);}
      if($id("includeReadme")?.checked){const lines=multi.entries.map((entry,index)=>`${entry.file.name} → ${entry.bones.length?entry.bones.join(", "):index===0?"Bone ที่เหลือ":"ยังไม่จับคู่"}`).join("\n");addon.file("README_TH.txt",`แพ็ก: ${packName}\nไอเทม: ${identifier}\nระบบ: Multi-Texture Mapping\nTexture: ${multi.entries.length} ไฟล์\n\n${lines}\n`);}
      const blob=await addon.generateAsync({type:"blob",compression:"DEFLATE"});download(blob,`${outputBase}.mcaddon`);setStatus(`สร้างสำเร็จ: ${outputBase}.mcaddon • ${multi.entries.length} Texture`);
    }catch(error){setStatus(`เกิดข้อผิดพลาด: ${error.message}`);}finally{multi.building=false;if(typeof refresh==="function")refresh();}
  }

  function isActive(){return typeof mode!=="undefined"&&mode==="manual"&&multi.enabled&&selectedFiles().length>1}
  function patchBuild(){
    const button=$id("buildBtn");if(!button)return;
    const originalDecoration=typeof buildDecorationAddon==="function"?buildDecorationAddon:null;
    if(originalDecoration)buildDecorationAddon=async function(){return isActive()?buildMultiTextureAddon():originalDecoration()};
    button.addEventListener("click",event=>{if(getControllerMode()==="decorations"||!isActive())return;event.preventDefault();event.stopImmediatePropagation();buildMultiTextureAddon();},true);
  }

  function patchValidation(){
    if(typeof runProjectValidation!=="function")return;const original=runProjectValidation;
    runProjectValidation=function(showStatus=true){const result=original(false);if(isActive()){
      const report=assignmentReport();if(report.duplicates.length)result.problems.push({type:"error",text:`Multi-Texture: Bone ซ้ำ ${report.duplicates.join(", ")}`});
      if(multi.entries.some(entry=>entry.info.width<1||entry.info.height<1))result.problems.push({type:"error",text:"Multi-Texture: อ่านขนาด PNG ไม่สำเร็จ"});
      result.errors=result.problems.filter(x=>x.type==="error").length;result.warnings=result.problems.filter(x=>x.type==="warning").length;result.ok=result.errors===0;
      if(typeof renderCombinedValidation==="function")renderCombinedValidation(result,showStatus);else if(showStatus)setStatus(result.ok?"ตรวจผ่าน พร้อม Build":`พบ ${result.errors} ข้อผิดพลาด`);
    }else if(showStatus&&typeof renderCombinedValidation==="function")renderCombinedValidation(result,true);return result;};
  }

  function loadCss(){if(document.querySelector('link[data-multi-texture-v4]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href="multi-texture-v4.css?v=1.0.0";link.dataset.multiTextureV4="1";document.head.appendChild(link)}
  function start(){loadCss();createUi();refreshEntries(true);patchBuild();patchValidation();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
