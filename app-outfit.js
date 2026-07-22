/* Full-body outfit mode: bind model parts to player skeleton */
let outfitModeEnabled=false;
let originalManualGeometryForOutfit=null;

function outfitKey(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"")}

const OUTFIT_BONE_MAP={
  head:"head",headwear:"head",hat:"head",
  body:"body",torso:"body",chest:"body",waist:"body",root:"body",
  rightarm:"rightArm",rarm:"rightArm",rightshoulder:"rightArm",
  leftarm:"leftArm",larm:"leftArm",leftshoulder:"leftArm",
  rightleg:"rightLeg",rleg:"rightLeg",
  leftleg:"leftLeg",lleg:"leftLeg"
};

function outfitTargetBone(name){return OUTFIT_BONE_MAP[outfitKey(name)]||null}

function normalizeOutfitGeometry(data,identifier){
  const copy=JSON.parse(JSON.stringify(data));
  const geometries=copy?.["minecraft:geometry"]||[];
  for(const geometry of geometries){
    geometry.description=geometry.description||{};
    if(identifier)geometry.description.identifier=identifier;
    geometry.description.visible_bounds_width=Math.max(Number(geometry.description.visible_bounds_width||0),3);
    geometry.description.visible_bounds_height=Math.max(Number(geometry.description.visible_bounds_height||0),3.5);
    geometry.description.visible_bounds_offset=geometry.description.visible_bounds_offset||[0,1.25,0];
    const bones=geometry.bones||[];
    const rename=new Map();
    for(const bone of bones){
      const target=outfitTargetBone(bone.name);
      if(target)rename.set(String(bone.name),target);
    }
    for(const bone of bones){
      const oldName=String(bone.name||"");
      const target=outfitTargetBone(oldName);
      if(target){
        bone.name=target;
        bone.binding=`'${target}'`;
        delete bone.parent;
      }else if(bone.parent&&rename.has(String(bone.parent))){
        bone.parent=rename.get(String(bone.parent));
      }
    }
    const seen=new Set();
    for(const bone of bones){
      if(!seen.has(bone.name)){seen.add(bone.name);continue}
      const base=bone.name;let number=2;
      while(seen.has(`${base}_${number}`))number++;
      bone.name=`${base}_${number}`;seen.add(bone.name);
    }
  }
  return copy;
}

function outfitBoneReport(){
  const source=mode==="bbmodel"?bbData:manualGeoData;
  if(!source)return {found:[],missing:["head","body","rightArm","leftArm","rightLeg","leftLeg"]};
  let names=[];
  if(mode==="bbmodel"){
    const walk=nodes=>{for(const node of nodes||[]){if(node&&typeof node==="object"&&Array.isArray(node.children)){names.push(node.name);walk(node.children.filter(x=>x&&typeof x==="object"))}}};
    walk(source.outliner||[]);
  }else{
    for(const geometry of source?.["minecraft:geometry"]||[])for(const bone of geometry.bones||[])names.push(bone.name);
  }
  const found=[...new Set(names.map(outfitTargetBone).filter(Boolean))];
  return {found,missing:["head","body","rightArm","leftArm","rightLeg","leftLeg"].filter(name=>!found.includes(name))};
}

function installOutfitMode(){
  const selector=document.querySelector(".controller-mode-selector");
  if(!selector||document.querySelector('input[name="controllerMode"][value="outfit"]'))return;
  const noneCard=selector.querySelector('input[value="none"]')?.closest("label");
  const card=document.createElement("label");
  card.className="controller-mode-card outfit-mode-card";
  card.innerHTML='<input type="radio" name="controllerMode" value="outfit"><b>ชุดเต็มตัว / Skin Outfit</b><span>สวมชุดชิ้นเดียว แล้วหัว ลำตัว แขน และขาขยับตามผู้เล่นเหมือนสกิน</span>';
  noneCard?.insertAdjacentElement("afterend",card);

  const info=document.createElement("div");
  info.id="outfitModeInfo";
  info.className="outfit-mode-info hidden";
  info.innerHTML=`
    <div class="outfit-info-icon">衣</div>
    <div><b>โหมดชุดขยับตามผู้เล่น</b><span>แยก Bone ใน Blockbench เป็น Head, Body, Right Arm, Left Arm, Right Leg และ Left Leg เว็บจะผูกแต่ละส่วนกับกระดูกผู้เล่นอัตโนมัติ</span><small id="outfitBoneStatus">ยังไม่ได้ตรวจ Bone</small></div>
  `;
  selector.insertAdjacentElement("afterend",info);

  const apply=()=>{
    const selected=document.querySelector('input[name="controllerMode"]:checked')?.value||"none";
    outfitModeEnabled=selected==="outfit";
    if(outfitModeEnabled){
      controllerMode="outfit";
      const slot=$("slot");if(slot){slot.value="slot.armor.chest";slot.dispatchEvent(new Event("change",{bubbles:true}))}
      document.querySelector(".controller-intro")?.classList.add("hidden");
      document.querySelector(".controller-grid")?.classList.add("hidden");
      document.querySelector(".controller-preview")?.classList.add("hidden");
      info.classList.remove("hidden");
      updateOutfitBoneStatus();
      setStatus("โหมดชุดเต็มตัว: จะผูกโมเดลกับกระดูกผู้เล่น");
    }else info.classList.add("hidden");
    refresh();
  };
  document.querySelectorAll('input[name="controllerMode"]').forEach(input=>input.addEventListener("change",()=>setTimeout(apply,0)));
  card.querySelector("input").addEventListener("change",apply);

  const style=document.createElement("style");
  style.id="outfitModeStyles";
  style.textContent=`
    .controller-mode-selector{grid-template-columns:repeat(5,minmax(0,1fr))!important}.outfit-mode-info{display:grid;grid-template-columns:58px minmax(0,1fr);gap:15px;align-items:center;margin:0 0 16px;padding:17px;border:1px solid #4f4381;border-radius:14px;background:linear-gradient(135deg,#251f43,#1c1d31)}.outfit-info-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:16px;background:linear-gradient(145deg,#8065ff,#b76fff);font-size:22px;font-weight:900}.outfit-mode-info b{display:block;font-size:14px}.outfit-mode-info span{display:block;margin-top:5px;font-size:12px;line-height:1.6;color:#c1bdd3}.outfit-mode-info small{display:block;margin-top:7px;font-size:11px;color:#a998ff}.outfit-mode-card:has(input:checked){border-color:#56c9ff!important;box-shadow:0 0 0 3px rgba(86,201,255,.1)!important}
    @media(max-width:1100px){.controller-mode-selector{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:640px){.controller-mode-selector{grid-template-columns:1fr!important}.outfit-mode-info{grid-template-columns:1fr}.outfit-info-icon{width:48px;height:48px}}
  `;
  document.head.appendChild(style);
}

function updateOutfitBoneStatus(){
  const target=$("outfitBoneStatus");if(!target)return;
  const report=outfitBoneReport();
  target.textContent=report.missing.length?`พบ ${report.found.length}/6 ส่วน • ยังขาด ${report.missing.join(", ")}`:"พบ Bone หลักครบ 6 ส่วน พร้อมสร้างชุดขยับตามตัว";
}

const originalInspectGeometryForOutfit=inspectGeometry;
inspectGeometry=function(data,fromBB=false){originalInspectGeometryForOutfit(data,fromBB);setTimeout(updateOutfitBoneStatus,0)};

const originalConvertBBGeometryForOutfit=convertBBGeometry;
convertBBGeometry=function(bb,id){
  const geometry=originalConvertBBGeometryForOutfit(bb,id);
  return outfitModeEnabled?normalizeOutfitGeometry(geometry,id):geometry;
};

$("buildBtn")?.addEventListener("click",()=>{
  if(!outfitModeEnabled||mode!=="manual"||!manualGeoData)return;
  if(!originalManualGeometryForOutfit)originalManualGeometryForOutfit=JSON.parse(JSON.stringify(manualGeoData));
  manualGeoData=normalizeOutfitGeometry(originalManualGeometryForOutfit,$("geometryId")?.value);
},true);

installOutfitMode();
updateOutfitBoneStatus();
