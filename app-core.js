const $=id=>document.getElementById(id);
let mode="bbmodel",bbData=null,bbSourceFile=null,manualGeoData=null,controllerMode="none";

function cleanId(v,f){const x=String(v||"").toLowerCase().trim().replace(/[^a-z0-9_]/g,"_").replace(/_+/g,"_");return x||f}
function parseVersion(v){const a=String(v).split(".").map(Number);return [0,1,2].map(i=>Number.isFinite(a[i])?a[i]:0)}
function uuid(){return crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==="x"?r:(r&3|8);return v.toString(16)})}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function cleanCustomerFileName(value,fallback="Customer_Head"){
  const cleaned=String(value||"").trim().replace(/\.(mcaddon|mcpack|zip)$/i,"").replace(/^LY[-_ ]*/i,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/_+/g,"_").replace(/^[-_]+|[-_]+$/g,"");
  return cleaned||fallback;
}
function lyFileBase(value,fallback="Customer_Head"){return `LY-${cleanCustomerFileName(value,fallback)}`}
function customerItemId(value){return cleanId(cleanCustomerFileName(value,"customer_head"),"customer_head")}
function getControllerMode(){return controllerMode}

function updateIds(){
  const ns="ly";
  const item=customerItemId($("customerFileName")?.value||$("itemName").value);
  $("namespace").value=ns;
  $("namespace").readOnly=true;
  $("itemName").value=item;
  $("itemName").readOnly=true;
  $("geometryId").value=`geometry.${ns}.${item}`;
  $("animationId").value=`animation.${ns}.${item}.idle_motion`;
  $("giveCommand").textContent=`/give @s ${ns}:${item} 1`;
  const controllerItem=$("controllerItemName");
  if(controllerItem){
    controllerItem.value=`${item}_controller`;
    controllerItem.readOnly=true;
  }
  const controllerCommand=$("controllerGiveCommand");
  if(controllerCommand)controllerCommand.textContent=`/give @s ${ns}:${item}_controller 1`;
  refresh();
}
$("customerFileName")?.addEventListener("input",updateIds);

document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x===b));document.getElementById(b.dataset.target)?.scrollIntoView({behavior:"smooth"})}));
document.querySelectorAll(".mode-tab").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.mode;document.querySelectorAll(".mode-tab").forEach(x=>x.classList.toggle("active",x===b));$("bbMode").classList.toggle("hidden",mode!=="bbmodel");$("manualMode").classList.toggle("hidden",mode!=="manual");refresh()}));

function installControllerModeSelector(){
  const card=document.querySelector(".controller-card");
  const intro=document.querySelector(".controller-intro");
  if(!card||!intro)return;
  const style=document.createElement("style");
  style.textContent=`
    .controller-mode-title{margin:0 0 10px;font-size:12px}.controller-mode-selector{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px}
    .controller-mode-card{position:relative;display:block;padding:14px;border:1.5px solid #dedde9;border-radius:14px;background:#fbfbfe;cursor:pointer}
    .controller-mode-card input{position:absolute;opacity:0}.controller-mode-card b{display:block;font-size:11px}.controller-mode-card span{display:block;margin-top:4px;font-size:9px;line-height:1.5;color:#898b9f}
    .controller-mode-card:has(input:checked){border-color:#7862d7;background:#f5f1ff;box-shadow:0 0 0 3px rgba(120,98,215,.08)}
    .controller-command{display:block;margin-top:10px;padding:9px 10px;border-radius:9px;background:#1d1b46;color:#dfdcf4;font-size:9px}
    @media(max-width:760px){.controller-mode-selector{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  const selector=document.createElement("div");
  selector.innerHTML=`
    <h4 class="controller-mode-title">เลือกรูปแบบงาน</h4>
    <div class="controller-mode-selector">
      <label class="controller-mode-card"><input type="radio" name="controllerMode" value="none" checked><b>โมเดลปกติ ไม่มีสีหน้า</b><span>สร้าง Add-on สวมใส่ทั่วไป ไม่มี Script และไม่มีไอเทม Controller</span></label>
      <label class="controller-mode-card"><input type="radio" name="controllerMode" value="expressions"><b>โมเดลพร้อมเมนูสีหน้า</b><span>สร้าง Controller เฉพาะของโมเดล และสลับหัวที่กำลังสวมโดยไม่ถอดหัว</span></label>
      <label class="controller-mode-card"><input type="radio" name="controllerMode" value="merge"><b>รวมไฟล์อย่างเดียว</b><span>ไม่สร้างโมเดลใหม่ ใช้หน้า “รวม Add-on” เพื่อรวม .mcaddon/.mcpack</span></label>
    </div>
  `;
  card.insertBefore(selector,intro);
  const settings=[intro,document.querySelector(".controller-grid"),document.querySelector(".controller-preview")].filter(Boolean);
  const enable=$("enableController");
  if(enable){
    enable.checked=false;
    const enableRow=enable.closest(".switch-row");
    if(enableRow)enableRow.style.display="none";
  }
  const command=document.createElement("code");
  command.id="controllerGiveCommand";
  command.className="controller-command";
  command.textContent="/give @s ly:customer_head_controller 1";
  intro.appendChild(command);
  intro.querySelector("b").textContent="Controller จะสลับไอเทมที่สวมอยู่ในช่องเกราะ ไม่ใช้ Tag ซ่อน Bone แบบเดิม";
  intro.querySelector("span").textContent="หัวจะยังสวมอยู่ตลอด และ Controller แต่ละงานใช้ Item ID ไม่ซ้ำกัน";
  const apply=()=>{
    controllerMode=document.querySelector('input[name="controllerMode"]:checked')?.value||"none";
    const showExpressions=controllerMode==="expressions";
    settings.forEach(el=>el.classList.toggle("hidden",!showExpressions));
    if(enable)enable.checked=showExpressions;
    if(controllerMode==="merge")setTimeout(()=>$("merge")?.scrollIntoView({behavior:"smooth"}),80);
    refresh();
  };
  document.querySelectorAll('input[name="controllerMode"]').forEach(r=>r.addEventListener("change",apply));
  apply();
}

function setStatus(text){$("status").textContent=text;$("globalStatus").textContent=text||"พร้อมใช้งาน"}
function inspectGeometry(data,fromBB=false){
  let bones=0,cubes=0,meshes=0,animations=0;
  if(fromBB){
    const elements=Array.isArray(data.elements)?data.elements:[];
    cubes=elements.filter(e=>e.type==="cube"||("from"in e&&"to"in e)).length;
    meshes=elements.filter(e=>e.type==="mesh"||e.vertices||e.faces).length;
    const countGroups=items=>(items||[]).reduce((n,x)=>n+(x&&typeof x==="object"&&Array.isArray(x.children)?1+countGroups(x.children):0),0);
    bones=countGroups(data.outliner||[]);
    animations=Array.isArray(data.animations)?data.animations.length:0;
  }else{
    const geos=data?.["minecraft:geometry"]||[];
    for(const g of geos){
      for(const b of g.bones||[]){
        bones++;
        cubes+=(b.cubes||[]).length;
        if(b.poly_mesh)meshes++;
      }
    }
  }
  $("statBones").textContent=bones;$("statCubes").textContent=cubes;$("statMeshes").textContent=meshes;$("statAnimations").textContent=animations;
  const d=$("detector"),icon=d.querySelector(".detector-icon"),title=d.querySelector("b"),sub=d.querySelector("span");
  d.className="detector";
  if(meshes>0&&cubes>0){d.classList.add("mixed");icon.textContent="M";title.textContent="ตรวจพบ Cube + Poly Mesh";sub.textContent="โหมดไฟล์เองจะเก็บ poly_mesh ไว้โดยไม่แก้ไข"}
  else if(meshes>0){d.classList.add("mesh");icon.textContent="P";title.textContent="ตรวจพบ Poly Mesh";sub.textContent="ไฟล์ Geometry จะถูกส่งผ่านตรงเข้า Resource Pack"}
  else if(cubes>0){d.classList.add("cube");icon.textContent="C";title.textContent="ตรวจพบ Cube Geometry";sub.textContent="รองรับการสร้าง Add-on แบบมาตรฐาน"}
  else{icon.textContent="?";title.textContent="ไม่พบ Cube หรือ Poly Mesh";sub.textContent="ตรวจสอบไฟล์โมเดลอีกครั้ง"}
}

const bbDrop=$("bbDrop");
["dragenter","dragover"].forEach(e=>bbDrop.addEventListener(e,x=>{x.preventDefault();bbDrop.classList.add("drag")}));
["dragleave","drop"].forEach(e=>bbDrop.addEventListener(e,x=>{x.preventDefault();bbDrop.classList.remove("drag")}));
bbDrop.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);$("bbFile").files=dt.files;$("bbFile").dispatchEvent(new Event("change"))});
$("bbFile").addEventListener("change",async()=>{const f=$("bbFile").files[0];if(!f)return;try{bbData=JSON.parse(await f.text());bbSourceFile=f;$("bbFileName").textContent=f.name;inspectGeometry(bbData,true);setStatus("อ่าน .bbmodel สำเร็จ")}catch(e){bbData=null;setStatus("อ่าน .bbmodel ไม่ได้: "+e.message)}refresh()});
$("fallbackTexture").addEventListener("change",()=>{$("fallbackName").textContent=$("fallbackTexture").files[0]?.name||"เลือก PNG";refresh()});

const manualPairs=[["geoFile","geoName"],["textureFile","textureName"],["iconFile","iconName"],["animationFile","animationName"]];
for(const [id,name] of manualPairs){$(id).addEventListener("change",async()=>{$(name).textContent=$(id).files[0]?.name||(id==="iconFile"?"ใช้ Texture แทน":"ยังไม่ได้เลือก");if(id==="geoFile"&&$(id).files[0]){try{manualGeoData=JSON.parse(await $(id).files[0].text());inspectGeometry(manualGeoData,false);setStatus("ตรวจ Geometry สำเร็จ")}catch(e){manualGeoData=null;setStatus("Geometry JSON ไม่ถูกต้อง")}}refresh()})}

function refresh(){
  const sourceReady=mode==="bbmodel"?!!bbData:!!manualGeoData&&!!$("textureFile").files[0];
  const mergeOnly=getControllerMode()==="merge";
  $("buildBtn").disabled=!sourceReady||mergeOnly;
  $("summary").textContent=mergeOnly?"โหมดรวม Add-on อย่างเดียว":sourceReady?(mode==="bbmodel"?"พร้อมสร้างจาก .bbmodel":"พร้อมสร้างจาก Geometry"):"ยังไม่พร้อมสร้าง";
}
function extractEmbeddedTexture(bb){for(const t of bb.textures||[]){const s=t?.source||t?.data_url||t?.data;if(typeof s==="string"&&s.startsWith("data:image/png;base64,")){const bin=atob(s.split(",")[1]),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:"image/png"})}}return null}
function vec3(v,d=[0,0,0]){return Array.isArray(v)?[Number(v[0]||0),Number(v[1]||0),Number(v[2]||0)]:d}
function convertBBGeometry(bb,id){
  const elements=Array.isArray(bb.elements)?bb.elements:[],byId=new Map(elements.map(e=>[e.uuid,e])),bones=[];
  function walk(nodes,parent=null){
    for(const node of nodes||[]){
      if(node&&typeof node==="object"&&Array.isArray(node.children)){
        const bone={name:cleanId(node.name,"bone"),pivot:vec3(node.origin,[0,24,0])};if(parent)bone.parent=parent;else bone.binding="q.item_slot_to_bone_name(context.item_slot)";
        const cubes=[];
        for(const c of node.children){if(typeof c==="string"){const e=byId.get(c);if(e&&(e.type==="cube"||("from"in e&&"to"in e)))cubes.push({origin:vec3(e.from),size:[(e.to?.[0]||0)-(e.from?.[0]||0),(e.to?.[1]||0)-(e.from?.[1]||0),(e.to?.[2]||0)-(e.from?.[2]||0)],uv:Array.isArray(e.uv_offset)?e.uv_offset:[0,0]})}}
        if(cubes.length)bone.cubes=cubes;bones.push(bone);walk(node.children.filter(x=>x&&typeof x==="object"),bone.name)
      }
    }
  }
  walk(bb.outliner||[]);
  if(!bones.length)bones.push({name:"root",pivot:[0,24,0],binding:"q.item_slot_to_bone_name(context.item_slot)"});
  const w=bb.resolution?.width||64,h=bb.resolution?.height||64;
  return {format_version:"1.16.0","minecraft:geometry":[{description:{identifier:id,texture_width:w,texture_height:h,visible_bounds_width:5,visible_bounds_height:5,visible_bounds_offset:[0,1.5,0]},bones}]}
}
function convertBBAnimations(bb,id){const arr=bb.animations||[];if(!arr.length)return null;return {format_version:"1.8.0",animations:{[id]:{loop:true,bones:{}}}}}

function controllerCleanId(v,f){const x=String(v||"").toLowerCase().trim().replace(/[^a-z0-9_]/g,"_").replace(/_+/g,"_");return x||f}
function getExpressions(){return [...document.querySelectorAll(".expression-row")].map((r,i)=>({label:r.querySelector(".expr-label").value.trim()||`Expression ${i+1}`,bone:r.querySelector(".expr-bone").value.trim(),icon:r.querySelector(".expr-icon").value.trim()}))}
function refreshControllerPreview(){$("controllerPreviewTitle").textContent=$("controllerMenuTitle").value||"เลือกสีหน้า";$("controllerPreviewBody").textContent=$("controllerMenuBody").value||"เลือกสีหน้าที่ต้องการใช้";$("controllerPreviewButtons").innerHTML=getExpressions().map((e,i)=>`<button type="button">${i+1}. ${e.label}<br><small>${e.bone||"ใช้หน้าปกติจากโมเดลหลัก"}</small></button>`).join("")}
function bindExpressionRow(row){row.querySelectorAll("input").forEach(i=>i.addEventListener("input",refreshControllerPreview));row.querySelector(".remove-expression").addEventListener("click",()=>{if(document.querySelectorAll(".expression-row").length<=1)return;row.remove();refreshControllerPreview()})}
document.querySelectorAll(".expression-row").forEach(bindExpressionRow);
$("addExpressionBtn")?.addEventListener("click",()=>{const n=document.querySelectorAll(".expression-row").length,row=document.createElement("div");row.className="expression-row";row.innerHTML=`<span class="drag-dot">⋮⋮</span><input class="expr-label" value="สีหน้า ${n+1}"><input class="expr-bone" value="Face_${n+1}"><input class="expr-icon" value=""><button class="remove-expression" type="button">×</button>`;$("expressionList").appendChild(row);bindExpressionRow(row);refreshControllerPreview()});
["controllerMenuTitle","controllerMenuBody"].forEach(id=>$(id)?.addEventListener("input",refreshControllerPreview));

function equipmentSlotConstant(slot){
  return {"slot.armor.head":"Head","slot.armor.chest":"Chest","slot.armor.legs":"Legs","slot.armor.feet":"Feet"}[slot]||"Head";
}
function makeControllerScript(ns,controllerItem,modelItem,slot,title,body,expr,autoGive){
  const modelItems=expr.map((_,i)=>`${ns}:${modelItem}${i?`_expr_${i}`:""}`);
  const buttons=expr.map(e=>`  form.button(${JSON.stringify(e.label)}${e.icon?`, ${JSON.stringify(e.icon)}`:""});`).join("\n");
  const slotConstant=equipmentSlotConstant(slot);
  return `import { world, system, ItemStack, EquipmentSlot, EntityComponentTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
const CONTROLLER_ITEM=${JSON.stringify(`${ns}:${controllerItem}`)};
const MODEL_ITEMS=${JSON.stringify(modelItems)};
const EQUIPMENT_SLOT=EquipmentSlot.${slotConstant};
async function openMenu(player){
  const form=new ActionFormData().title(${JSON.stringify(title)}).body(${JSON.stringify(body)});
${buttons}
  const r=await form.show(player);
  if(r.canceled||r.selection===undefined)return;
  system.run(()=>{
    const equippable=player.getComponent(EntityComponentTypes.Equippable);
    const current=equippable?.getEquipment(EQUIPMENT_SLOT);
    if(!current||!MODEL_ITEMS.includes(current.typeId)){
      player.sendMessage("§cกรุณาสวมโมเดล ${ns}:${modelItem} ก่อนใช้ Controller");
      return;
    }
    equippable.setEquipment(EQUIPMENT_SLOT,new ItemStack(MODEL_ITEMS[r.selection],1));
  });
}
world.afterEvents.itemUse.subscribe(e=>{
  if(e.itemStack?.typeId!==CONTROLLER_ITEM)return;
  system.run(()=>openMenu(e.source));
});
${autoGive?`world.afterEvents.playerSpawn.subscribe(e=>{if(!e.initialSpawn)return;system.runTimeout(()=>{const c=e.player.getComponent("minecraft:inventory")?.container;if(!c)return;let found=false;for(let i=0;i<c.size;i++)if(c.getItem(i)?.typeId===CONTROLLER_ITEM)found=true;if(!found)c.addItem(new ItemStack(CONTROLLER_ITEM,1));},20);});`:""}`;
}
function makeExpressionRenderControllers(ns,item,expr){
  const controllers={};
  const bones=expr.map(e=>e.bone).filter(Boolean);
  expr.forEach((selected,i)=>{
    const visibility={};
    for(const bone of bones)visibility[bone]=bone===selected.bone?"1.0":"0.0";
    controllers[`controller.render.${ns}.${item}.expr_${i}`]={geometry:"Geometry.default",materials:[{"*":"Material.default"}],textures:["Texture.default"],part_visibility:visibility};
  });
  return {format_version:"1.8.0",render_controllers:controllers};
}

installControllerModeSelector();
refreshControllerPreview();
updateIds();
refresh();
