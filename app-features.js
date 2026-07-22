/* Rabbit Builder advanced project tools */
let faceMethod="bone";
let detectedBoneNames=[];

function getFaceMethod(){return faceMethod}

function extractBoneNames(data,fromBB=false){
  const names=[];
  if(fromBB){
    const walk=nodes=>{
      for(const node of nodes||[]){
        if(node&&typeof node==="object"&&Array.isArray(node.children)){
          names.push(cleanId(node.name,"bone"));
          walk(node.children.filter(x=>x&&typeof x==="object"));
        }
      }
    };
    walk(data?.outliner||[]);
  }else{
    for(const geo of data?.["minecraft:geometry"]||[]){
      for(const bone of geo.bones||[])if(bone?.name)names.push(String(bone.name));
    }
  }
  return [...new Set(names)].sort((a,b)=>a.localeCompare(b));
}

function updateBoneDatalist(){
  let list=$("boneNameList");
  if(!list){
    list=document.createElement("datalist");
    list.id="boneNameList";
    document.body.appendChild(list);
  }
  list.innerHTML=detectedBoneNames.map(name=>`<option value="${name.replace(/"/g,"&quot;")}"></option>`).join("");
  document.querySelectorAll(".expr-bone").forEach(input=>input.setAttribute("list","boneNameList"));
  const count=$("detectedBoneCount");
  if(count)count.textContent=detectedBoneNames.length?`พบ ${detectedBoneNames.length} Bone จากโมเดล`:"ยังไม่พบ Bone";
}

const originalInspectGeometry=inspectGeometry;
inspectGeometry=function(data,fromBB=false){
  originalInspectGeometry(data,fromBB);
  detectedBoneNames=extractBoneNames(data,fromBB);
  updateBoneDatalist();
  updateAdvancedSummary();
};

function enhanceExpressionRow(row){
  if(!row||row.dataset.enhanced==="1")return;
  row.dataset.enhanced="1";
  const bone=row.querySelector(".expr-bone");
  if(bone)bone.setAttribute("list","boneNameList");
  const assets=document.createElement("div");
  assets.className="expr-assets hidden";
  assets.innerHTML=`
    <label class="expr-file texture-file"><span>Texture สีหน้า</span><input class="expr-texture" type="file" accept="image/png"><small>PNG</small></label>
    <label class="expr-file model-file"><span>โมเดลสีหน้า</span><input class="expr-model" type="file" accept=".bbmodel,.json,.geo.json,application/json"><small>BBMODEL / GEO.JSON</small></label>
  `;
  row.appendChild(assets);
  row.querySelectorAll("input").forEach(input=>input.addEventListener("input",()=>{refreshControllerPreview();updateAdvancedSummary();runProjectValidation(false)}));
  row.querySelectorAll('input[type="file"]').forEach(input=>input.addEventListener("change",()=>{input.closest("label")?.classList.toggle("has-file",!!input.files[0]);updateAdvancedSummary();runProjectValidation(false)}));
  row.querySelector(".remove-expression")?.addEventListener("click",()=>setTimeout(()=>{updateAdvancedSummary();runProjectValidation(false)},0));
}

function applyFaceMethodToRows(){
  document.querySelectorAll(".expression-row").forEach((row,index)=>{
    enhanceExpressionRow(row);
    const bone=row.querySelector(".expr-bone");
    const assets=row.querySelector(".expr-assets");
    const texture=row.querySelector(".texture-file");
    const model=row.querySelector(".model-file");
    if(bone)bone.classList.toggle("hidden",faceMethod!=="bone");
    if(assets)assets.classList.toggle("hidden",faceMethod==="bone");
    if(texture)texture.classList.toggle("hidden",faceMethod==="bone");
    if(model)model.classList.toggle("hidden",faceMethod!=="model");
    const texSpan=texture?.querySelector("span");
    const modelSpan=model?.querySelector("span");
    if(texSpan)texSpan.textContent=index===0?"Texture ปกติ (เว้นว่างใช้ไฟล์หลัก)":"Texture สีหน้า";
    if(modelSpan)modelSpan.textContent=index===0?"โมเดลปกติ (เว้นว่างใช้ไฟล์หลัก)":"โมเดลสีหน้า";
  });
  const warning=document.querySelector(".controller-warning span");
  if(warning){
    warning.textContent=faceMethod==="bone"
      ?"เลือก Bone ของแต่ละหน้า ระบบจะแสดงทีละ Bone"
      :faceMethod==="texture"
        ?"ใช้ Geometry เดิม แต่เปลี่ยน PNG ของทั้งโมเดลในแต่ละสีหน้า"
        :"แต่ละสีหน้าสามารถใช้ Geometry และ Texture คนละไฟล์ได้";
  }
  refreshControllerPreview();
  updateAdvancedSummary();
}

function installAdvancedTools(){
  const controllerGrid=document.querySelector(".controller-grid");
  if(controllerGrid&&!$("faceMethod")){
    const method=document.createElement("div");
    method.className="advanced-tool-card face-method-card";
    method.innerHTML=`
      <div><h4>วิธีเปลี่ยนสีหน้า</h4><p>เลือกตามรูปแบบไฟล์ที่ทำใน Blockbench</p></div>
      <div class="face-method-options">
        <label><input type="radio" name="faceMethod" value="bone" checked><b>Bone</b><span>แยก Face_Normal, Face_Happy</span></label>
        <label><input type="radio" name="faceMethod" value="texture"><b>Texture</b><span>เปลี่ยน PNG ทั้งหน้า/ทั้งหัว</span></label>
        <label><input type="radio" name="faceMethod" value="model"><b>โมเดลแยก</b><span>แต่ละหน้ามี BBMODEL/GEO.JSON</span></label>
      </div>
      <small id="detectedBoneCount">ยังไม่พบ Bone</small>
    `;
    controllerGrid.insertBefore(method,controllerGrid.firstChild);
    method.querySelectorAll('input[name="faceMethod"]').forEach(input=>input.addEventListener("change",()=>{
      faceMethod=input.value;
      applyFaceMethodToRows();
      runProjectValidation(false);
    }));
  }

  const projectCard=$("project")?.querySelector(".card");
  const formGrid=projectCard?.querySelector(".form-grid");
  if(formGrid&&!$("resetItemIdBtn")){
    const tools=document.createElement("div");
    tools.className="project-tools";
    tools.innerHTML=`
      <button id="resetItemIdBtn" type="button">↻ ใช้ชื่องานเป็น Item ID</button>
      <button id="saveProjectBtn" type="button">บันทึกโปรเจกต์</button>
      <label class="open-project-btn">เปิดโปรเจกต์<input id="openProjectFile" type="file" accept="application/json,.json"></label>
    `;
    projectCard.appendChild(tools);
    $("resetItemIdBtn").addEventListener("click",()=>{
      if(typeof itemIdTouched!=="undefined")itemIdTouched=false;
      const derived=originalCustomerItemId($("customerFileName").value);
      applyEditableItemId(derived,false);
      updateAdvancedSummary();
    });
    $("saveProjectBtn").addEventListener("click",saveProjectSettings);
    $("openProjectFile").addEventListener("change",loadProjectSettings);
  }

  const buildCard=document.querySelector(".build-card");
  if(buildCard&&!$("validationPanel")){
    const panel=document.createElement("div");
    panel.className="advanced-build-panels";
    panel.innerHTML=`
      <div class="validation-card"><div><b>ตรวจสอบก่อน Build</b><span id="validationHeadline">รอตรวจสอบ</span></div><button id="validateBtn" type="button">ตรวจไฟล์</button><ul id="validationPanel"></ul></div>
      <div class="output-summary-card"><b>สรุป Add-on</b><div id="advancedSummary"></div></div>
    `;
    buildCard.appendChild(panel);
    $("validateBtn").addEventListener("click",()=>runProjectValidation(true));
  }

  document.querySelectorAll(".expression-row").forEach(enhanceExpressionRow);
  const originalAdd=$("addExpressionBtn");
  originalAdd?.addEventListener("click",()=>setTimeout(()=>{
    document.querySelectorAll(".expression-row").forEach(enhanceExpressionRow);
    applyFaceMethodToRows();
    updateAdvancedSummary();
  },0));

  const watchIds=["packName","author","customerFileName","itemName","displayTh","displayEn","slot","version","controllerDisplayName","controllerMenuTitle","controllerMenuBody"];
  watchIds.forEach(id=>$(id)?.addEventListener("input",()=>{updateAdvancedSummary();runProjectValidation(false)}));
  ["useAnimation","hideHelmet","includeSource","includeReadme","autoGiveController"].forEach(id=>$(id)?.addEventListener("change",updateAdvancedSummary));
  document.querySelectorAll('input[name="controllerMode"]').forEach(input=>input.addEventListener("change",()=>{updateAdvancedSummary();runProjectValidation(false)}));

  $("buildBtn")?.addEventListener("click",event=>{
    const result=runProjectValidation(true);
    if(!result.ok){event.preventDefault();event.stopImmediatePropagation();setStatus("ยังสร้างไม่ได้: กรุณาแก้รายการตรวจสอบ");}
  },true);

  injectAdvancedStyles();
  updateBoneDatalist();
  applyFaceMethodToRows();
  updateAdvancedSummary();
  runProjectValidation(false);
}

function getExpressionsAdvanced(){
  return [...document.querySelectorAll(".expression-row")].map((row,index)=>({
    label:row.querySelector(".expr-label")?.value.trim()||`Expression ${index+1}`,
    bone:row.querySelector(".expr-bone")?.value.trim()||"",
    icon:row.querySelector(".expr-icon")?.value.trim()||"",
    textureFile:row.querySelector(".expr-texture")?.files?.[0]||null,
    modelFile:row.querySelector(".expr-model")?.files?.[0]||null
  }));
}
getExpressions=getExpressionsAdvanced;

function validateExpressionFiles(expressions,problems){
  if(getControllerMode()!=="expressions")return;
  if(expressions.length<1)problems.push({type:"error",text:"ต้องมีสีหน้าอย่างน้อย 1 แบบ"});
  const labels=new Set();
  expressions.forEach((expr,index)=>{
    const key=expr.label.toLowerCase();
    if(labels.has(key))problems.push({type:"error",text:`ชื่อสีหน้าซ้ำ: ${expr.label}`});
    labels.add(key);
    if(faceMethod==="bone"){
      if(expr.bone&&detectedBoneNames.length&&!detectedBoneNames.includes(expr.bone))problems.push({type:"error",text:`ไม่พบ Bone “${expr.bone}” ในโมเดล`});
    }else if(faceMethod==="texture"){
      if(index>0&&!expr.textureFile)problems.push({type:"error",text:`สีหน้า “${expr.label}” ยังไม่มี Texture PNG`});
    }else if(faceMethod==="model"){
      if(index>0&&!expr.modelFile)problems.push({type:"error",text:`สีหน้า “${expr.label}” ยังไม่มีไฟล์โมเดล`});
    }
  });
  if(faceMethod==="bone"){
    const used=expressions.map(x=>x.bone).filter(Boolean);
    const duplicate=used.find((bone,index)=>used.indexOf(bone)!==index);
    if(duplicate)problems.push({type:"error",text:`Bone ถูกใช้ซ้ำ: ${duplicate}`});
    if(!detectedBoneNames.length)problems.push({type:"warning",text:"ยังอ่านรายชื่อ Bone ไม่ได้ กรุณาตรวจชื่อ Bone ด้วยตนเอง"});
  }
}

function runProjectValidation(showStatus=true){
  const problems=[];
  const item=editableItemSuffix($("itemName")?.value);
  if(!/^[a-z0-9_]+$/.test(item))problems.push({type:"error",text:"Item ID ใช้ได้เฉพาะ a-z, 0-9 และ _"});
  if(!$("packName")?.value.trim())problems.push({type:"error",text:"ยังไม่ได้ใส่ชื่อแพ็ก"});
  if(!$("customerFileName")?.value.trim())problems.push({type:"error",text:"ยังไม่ได้ใส่ชื่อลูกค้า / ชื่องาน"});
  if(getControllerMode()!=="merge"){
    const ready=mode==="bbmodel"?!!bbData:!!manualGeoData&&!!$("textureFile")?.files?.[0];
    if(!ready)problems.push({type:"error",text:mode==="bbmodel"?"ยังไม่ได้เลือก .bbmodel ที่อ่านได้":"ต้องเลือก Geometry และ Texture"});
  }
  validateExpressionFiles(getExpressionsAdvanced(),problems);
  const version=parseVersion($("version")?.value||"0.0.0");
  if(version.every(x=>x===0))problems.push({type:"warning",text:"เวอร์ชันแพ็กเป็น 0.0.0"});
  const errors=problems.filter(x=>x.type==="error").length;
  const warnings=problems.filter(x=>x.type==="warning").length;
  const panel=$("validationPanel");
  if(panel){
    panel.innerHTML=problems.length?problems.map(x=>`<li class="${x.type}">${x.type==="error"?"✕":"!"} ${x.text}</li>`).join(""):'<li class="success">✓ พร้อมสร้าง Add-on</li>';
  }
  const headline=$("validationHeadline");
  if(headline)headline.textContent=errors?`${errors} ข้อผิดพลาด${warnings?` • ${warnings} คำเตือน`:""}`:warnings?`ผ่าน • ${warnings} คำเตือน`:"ผ่านทั้งหมด";
  if(showStatus)setStatus(errors?`พบ ${errors} ข้อผิดพลาด`:warnings?`ตรวจผ่าน มี ${warnings} คำเตือน`:"ตรวจผ่าน พร้อม Build");
  return {ok:errors===0,errors,warnings,problems};
}

function updateAdvancedSummary(){
  const summary=$("advancedSummary");
  if(!summary)return;
  const item=editableItemSuffix($("itemName")?.value);
  const output=lyFileBase($("customerFileName")?.value,"Customer_Head");
  const controller=getControllerMode()==="expressions";
  const methodName={bone:"Bone",texture:"Texture",model:"โมเดลแยก"}[faceMethod];
  const expressions=getExpressionsAdvanced();
  summary.innerHTML=`
    <div><span>ชื่อไฟล์</span><code>${output}.mcaddon</code></div>
    <div><span>ไอเทมหลัก</span><code>ly:${item}</code></div>
    <div><span>Geometry</span><code>geometry.ly.${item}</code></div>
    <div><span>ช่องสวม</span><b>${{"slot.armor.head":"Head","slot.armor.chest":"Chest","slot.armor.legs":"Legs","slot.armor.feet":"Feet"}[$("slot")?.value]||"Head"}</b></div>
    <div><span>ระบบสีหน้า</span><b>${controller?`${expressions.length} แบบ • ${methodName}`:"ไม่มี"}</b></div>
    <div><span>Controller</span><code>${controller?`ly:${item}_controller`:"ไม่สร้าง"}</code></div>
    <div><span>ไฟล์ภายใน</span><code>${output}_BP.mcpack + ${output}_RP.mcpack</code></div>
  `;
}

function projectSettingsObject(){
  const fields=["packName","author","customerFileName","itemName","displayTh","displayEn","slot","version","controllerDisplayName","controllerMenuTitle","controllerMenuBody","mergeOutputName"];
  const values={};
  fields.forEach(id=>{if($(id))values[id]=$(id).value});
  const checks=["useAnimation","hideHelmet","includeSource","includeReadme","autoGiveController","regenerateMergeUuids","keepMergeDocs"];
  checks.forEach(id=>{if($(id))values[id]=$(id).checked});
  return {
    format:"rabbit-builder-project",
    formatVersion:1,
    savedAt:new Date().toISOString(),
    mode,
    controllerMode:getControllerMode(),
    faceMethod,
    values,
    expressions:getExpressionsAdvanced().map(({label,bone,icon})=>({label,bone,icon})),
    note:"ไฟล์ BBMODEL, Geometry และ PNG ไม่ถูกฝังในไฟล์ตั้งค่า กรุณาเลือกไฟล์อีกครั้งเมื่อเปิดโปรเจกต์"
  };
}

function saveProjectSettings(){
  const data=projectSettingsObject();
  download(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),`${lyFileBase($("customerFileName")?.value,"Project")}.rabbit.json`);
  setStatus("บันทึกการตั้งค่าโปรเจกต์แล้ว");
}

async function loadProjectSettings(event){
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(data.format!=="rabbit-builder-project")throw new Error("ไม่ใช่ไฟล์โปรเจกต์ Rabbit Builder");
    for(const [id,value] of Object.entries(data.values||{})){
      const el=$(id);if(!el)continue;
      if(el.type==="checkbox")el.checked=!!value;else el.value=value;
      el.dispatchEvent(new Event(el.type==="checkbox"?"change":"input",{bubbles:true}));
    }
    if(data.mode){document.querySelector(`.mode-tab[data-mode="${data.mode}"]`)?.click()}
    if(data.controllerMode){document.querySelector(`input[name="controllerMode"][value="${data.controllerMode}"]`)?.click()}
    if(data.faceMethod){document.querySelector(`input[name="faceMethod"][value="${data.faceMethod}"]`)?.click()}
    if(Array.isArray(data.expressions)&&data.expressions.length){
      const list=$("expressionList");list.innerHTML="";
      for(const expr of data.expressions){
        const row=document.createElement("div");row.className="expression-row";
        row.innerHTML=`<span class="drag-dot">⋮⋮</span><input class="expr-label"><input class="expr-bone"><input class="expr-icon"><button class="remove-expression" type="button">×</button>`;
        row.querySelector(".expr-label").value=expr.label||"สีหน้า";
        row.querySelector(".expr-bone").value=expr.bone||"";
        row.querySelector(".expr-icon").value=expr.icon||"";
        list.appendChild(row);bindExpressionRow(row);enhanceExpressionRow(row);
      }
    }
    applyEditableItemId($("itemName").value,true);
    applyFaceMethodToRows();
    updateAdvancedSummary();
    runProjectValidation(false);
    setStatus("เปิดโปรเจกต์สำเร็จ กรุณาเลือกไฟล์โมเดลและ Texture อีกครั้ง");
  }catch(error){setStatus("เปิดโปรเจกต์ไม่ได้: "+error.message)}
  finally{event.target.value=""}
}

function injectAdvancedStyles(){
  if($("advancedFeatureStyles"))return;
  const style=document.createElement("style");style.id="advancedFeatureStyles";
  style.textContent=`
    .advanced-tool-card{grid-column:1/-1;padding:15px;border:1px solid #dedde9;border-radius:14px;background:#faf9ff}.advanced-tool-card h4{margin:0;font-size:12px}.advanced-tool-card p{margin:4px 0 10px;font-size:9px;color:#898b9f}
    .face-method-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.face-method-options label{padding:10px;border:1px solid #dedde9;border-radius:10px;background:white;cursor:pointer}.face-method-options input{margin-right:5px}.face-method-options b{font-size:10px}.face-method-options span{display:block;margin:4px 0 0 19px;font-size:8px;color:#898b9f}.face-method-card>small{display:block;margin-top:8px;color:#6550bd}
    .expr-assets{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:7px}.expr-file{position:relative;padding:8px;border:1px dashed #c9c6da;border-radius:8px;font-size:8px;cursor:pointer}.expr-file input{position:absolute;inset:0;opacity:0;cursor:pointer}.expr-file small{float:right}.expr-file.has-file{border-color:#6e59cb;background:#f5f1ff}.expression-row{flex-wrap:wrap}.expression-row>.expr-assets.hidden,.expression-row>.hidden{display:none!important}
    .project-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.project-tools button,.open-project-btn{border:1px solid #d8d5e7;border-radius:9px;padding:9px 12px;background:#fff;font-size:9px;cursor:pointer}.open-project-btn{position:relative}.open-project-btn input{position:absolute;inset:0;opacity:0;cursor:pointer}
    .advanced-build-panels{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.validation-card,.output-summary-card{border:1px solid #dedde9;border-radius:13px;padding:13px;background:#fbfbfe}.validation-card>div{display:flex;justify-content:space-between;align-items:center}.validation-card span{font-size:8px;color:#77798e}.validation-card button{border:0;border-radius:8px;padding:7px 10px;background:#27235d;color:white;font-size:8px}.validation-card ul{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:5px}.validation-card li{font-size:8px;padding:6px 8px;border-radius:7px}.validation-card li.error{background:#fff0f0;color:#a93636}.validation-card li.warning{background:#fff8e6;color:#8b681a}.validation-card li.success{background:#edfff2;color:#267240}
    .output-summary-card>b{font-size:10px}.output-summary-card #advancedSummary{display:grid;gap:6px;margin-top:10px}.output-summary-card #advancedSummary>div{display:flex;justify-content:space-between;gap:10px;font-size:8px}.output-summary-card span{color:#85879a}.output-summary-card code{font-size:8px;text-align:right;overflow-wrap:anywhere}
    @media(max-width:760px){.face-method-options,.advanced-build-panels,.expr-assets{grid-template-columns:1fr}.output-summary-card #advancedSummary>div{display:block}.output-summary-card code{display:block;text-align:left;margin-top:3px}}
  `;
  document.head.appendChild(style);
}

installAdvancedTools();
