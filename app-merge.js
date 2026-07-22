let mergeInspection=null;

function safeFileBase(name){
  return String(name||"addon").replace(/\.(mcaddon|mcpack|zip)$/i,"").replace(/[^a-zA-Z0-9_-]+/g,"_")||"addon";
}
function classifyManifest(manifest){
  const types=(manifest?.modules||[]).map(module=>module.type);
  if(types.includes("resources"))return "rp";
  if(types.includes("data")||types.includes("script"))return "bp";
  return "unknown";
}
async function extractPacksFromFile(file){
  const packs=[];
  const outer=await JSZip.loadAsync(file);
  const rootManifest=outer.file("manifest.json");
  if(rootManifest){
    const manifest=JSON.parse(await rootManifest.async("string"));
    return [{sourceName:file.name,packName:safeFileBase(file.name),kind:classifyManifest(manifest),manifest,zip:outer}];
  }
  const entries=Object.values(outer.files).filter(entry=>!entry.dir);
  for(const entry of entries){
    if(!/\.mcpack$/i.test(entry.name))continue;
    const nested=await JSZip.loadAsync(await entry.async("blob"));
    const mf=nested.file("manifest.json");
    if(!mf)continue;
    const manifest=JSON.parse(await mf.async("string"));
    packs.push({sourceName:file.name,packName:safeFileBase(entry.name.split("/").pop()),kind:classifyManifest(manifest),manifest,zip:nested});
  }
  if(packs.length)return packs;
  for(const manifestEntry of entries.filter(entry=>/(^|\/)manifest\.json$/i.test(entry.name))){
    const prefix=manifestEntry.name.slice(0,-"manifest.json".length);
    if(!prefix)continue;
    const manifest=JSON.parse(await manifestEntry.async("string"));
    const packZip=new JSZip();
    for(const entry of entries){
      if(!entry.name.startsWith(prefix))continue;
      const relative=entry.name.slice(prefix.length);
      if(relative)packZip.file(relative,await entry.async("blob"));
    }
    packs.push({sourceName:file.name,packName:safeFileBase(prefix.replace(/\/$/,"").split("/").pop()),kind:classifyManifest(manifest),manifest,zip:packZip});
  }
  return packs;
}
function renderMergeProblems(problems){
  $("mergeProblems").innerHTML=problems.length?problems.map(problem=>`<div class="merge-problem ${problem.ok?"ok":""}"><i>${problem.ok?"✓":"!"}</i><div><b>${problem.title}</b><span>${problem.text}</span></div></div>`).join(""):'<div class="merge-empty">ยังไม่มีไฟล์สำหรับตรวจสอบ</div>';
}
async function inspectMergeFiles(){
  const files=[...$("mergeFiles").files];
  const packs=[];
  const problems=[];
  $("mergeStatus").textContent="กำลังตรวจไฟล์...";
  for(const file of files){
    try{
      const found=await extractPacksFromFile(file);
      if(found.length){packs.push(...found);problems.push({ok:true,title:file.name,text:`ตรวจพบ ${found.length} แพ็ก`});}
      else problems.push({ok:false,title:file.name,text:"ไม่พบ manifest.json หรือ .mcpack ภายในไฟล์"});
    }catch(error){
      problems.push({ok:false,title:file.name,text:`เปิดไฟล์ไม่ได้: ${error.message}`});
    }
  }
  const uuidOwners=new Map();
  for(const pack of packs){
    const id=pack.manifest?.header?.uuid;
    if(!id)continue;
    if(uuidOwners.has(id))problems.push({ok:false,title:"UUID ซ้ำ",text:`${pack.packName} ซ้ำกับ ${uuidOwners.get(id)}`});
    else uuidOwners.set(id,pack.packName);
    if(pack.kind==="unknown")problems.push({ok:false,title:pack.packName,text:"ไม่สามารถระบุประเภท BP/RP"});
  }
  const bps=packs.filter(pack=>pack.kind==="bp");
  const rps=packs.filter(pack=>pack.kind==="rp");
  mergeInspection={files,packs,bps,rps,problems};
  $("mergeStatFiles").textContent=files.length;
  $("mergeStatBP").textContent=bps.length;
  $("mergeStatRP").textContent=rps.length;
  $("mergeStatWarnings").textContent=problems.filter(problem=>!problem.ok).length;
  $("mergeFileCount").textContent=files.length?`${files.length} ไฟล์`:"ยังไม่ได้เลือกไฟล์";
  $("mergeBtn").disabled=!packs.length;
  $("mergeSummary").textContent=packs.length?`พร้อมรวม ${packs.length} แพ็ก`:"เลือก Add-on อย่างน้อย 1 ไฟล์";
  $("mergeStatus").textContent=packs.length?`${bps.length} BP • ${rps.length} RP`:"";
  renderMergeProblems(problems);
}
const mergeDrop=$("mergeDrop");
["dragenter","dragover"].forEach(type=>mergeDrop.addEventListener(type,event=>{event.preventDefault();mergeDrop.classList.add("drag")}));
["dragleave","drop"].forEach(type=>mergeDrop.addEventListener(type,event=>{event.preventDefault();mergeDrop.classList.remove("drag")}));
mergeDrop.addEventListener("drop",event=>{
  const transfer=new DataTransfer();
  for(const file of event.dataTransfer.files)transfer.items.add(file);
  $("mergeFiles").files=transfer.files;
  $("mergeFiles").dispatchEvent(new Event("change"));
});
$("mergeFiles").addEventListener("change",inspectMergeFiles);
document.querySelectorAll('input[name="mergeStrategy"]').forEach(radio=>radio.addEventListener("change",()=>{
  document.querySelectorAll(".merge-choice").forEach(choice=>choice.classList.toggle("active",choice.querySelector("input").checked));
}));
async function copyZipInto(target,source,prefix="",conflicts=[]){
  for(const [name,entry] of Object.entries(source.files)){
    if(entry.dir)continue;
    const outputName=prefix+name;
    if(target.file(outputName))conflicts.push(outputName);
    target.file(outputName,await entry.async("blob"));
  }
}
async function regenerateManifest(zip,type,rpUuid=null){
  const file=zip.file("manifest.json");
  if(!file)return null;
  const manifest=JSON.parse(await file.async("string"));
  manifest.header.uuid=uuid();
  manifest.modules=(manifest.modules||[]).map(module=>({...module,uuid:uuid()}));
  if(type==="bp"&&rpUuid){
    manifest.dependencies=(manifest.dependencies||[]).filter(dependency=>!dependency.uuid);
    manifest.dependencies.push({uuid:rpUuid,version:manifest.header.version||[1,0,0]});
  }
  zip.file("manifest.json",JSON.stringify(manifest,null,2));
  return manifest;
}
$("mergeBtn").addEventListener("click",async()=>{
  const button=$("mergeBtn");
  try{
    if(!mergeInspection?.packs?.length)throw new Error("ยังไม่มีแพ็กสำหรับรวม");
    button.disabled=true;
    const strategy=document.querySelector('input[name="mergeStrategy"]:checked').value;
    const output=lyFileBase($("mergeOutputName").value,"Combined_Addons");
    $("mergeStatus").textContent="กำลังรวมไฟล์...";
    if(strategy==="bundle"){
      const addon=new JSZip();
      const used=new Set();
      let duplicate=1;
      for(const pack of mergeInspection.packs){
        const base=safeFileBase(pack.packName);
        let filename=`${base}.mcpack`;
        while(used.has(filename))filename=`${base}_${duplicate++}.mcpack`;
        used.add(filename);
        addon.file(filename,await pack.zip.generateAsync({type:"blob",compression:"DEFLATE"}));
      }
      addon.file("MERGE_README_TH.txt",`ชื่อไฟล์: ${output}.mcaddon\nโหมด: Safe Bundle\nจำนวนแพ็ก: ${mergeInspection.packs.length}\nBehavior Packs: ${mergeInspection.bps.length}\nResource Packs: ${mergeInspection.rps.length}\n`);
      const blob=await addon.generateAsync({type:"blob",compression:"DEFLATE"});
      download(blob,`${output}.mcaddon`);
      $("mergeStatus").textContent=`สร้างสำเร็จ: ${output}.mcaddon`;
      return;
    }
    const mergedBP=new JSZip(),mergedRP=new JSZip(),conflicts=[];
    let bpIndex=0,rpIndex=0;
    for(const pack of mergeInspection.packs){
      if(pack.kind==="bp")await copyZipInto(mergedBP,pack.zip,bpIndex++?`merged_${safeFileBase(pack.packName)}/`:"",conflicts);
      if(pack.kind==="rp")await copyZipInto(mergedRP,pack.zip,rpIndex++?`merged_${safeFileBase(pack.packName)}/`:"",conflicts);
    }
    const firstBP=mergeInspection.bps[0],firstRP=mergeInspection.rps[0];
    if(firstBP&&!mergedBP.file("manifest.json"))mergedBP.file("manifest.json",JSON.stringify(firstBP.manifest,null,2));
    if(firstRP&&!mergedRP.file("manifest.json"))mergedRP.file("manifest.json",JSON.stringify(firstRP.manifest,null,2));
    let rpManifest=null;
    if($("regenerateMergeUuids").checked&&firstRP)rpManifest=await regenerateManifest(mergedRP,"rp");
    if($("regenerateMergeUuids").checked&&firstBP)await regenerateManifest(mergedBP,"bp",rpManifest?.header?.uuid||null);
    const addon=new JSZip();
    if(firstBP)addon.file(`${output}_BP.mcpack`,await mergedBP.generateAsync({type:"blob",compression:"DEFLATE"}));
    if(firstRP)addon.file(`${output}_RP.mcpack`,await mergedRP.generateAsync({type:"blob",compression:"DEFLATE"}));
    addon.file("MERGE_REPORT_TH.txt",`ชื่อไฟล์: ${output}.mcaddon\nโหมด: รวมเป็น BP/RP เดียว\nPath ที่ชน: ${conflicts.length}\n\n${conflicts.join("\n")||"- ไม่มี"}\n`);
    const blob=await addon.generateAsync({type:"blob",compression:"DEFLATE"});
    download(blob,`${output}.mcaddon`);
    $("mergeStatus").textContent=`สร้างสำเร็จ: ${output}.mcaddon • path ชน ${conflicts.length}`;
  }catch(error){
    $("mergeStatus").textContent=`เกิดข้อผิดพลาด: ${error.message}`;
  }finally{
    button.disabled=!(mergeInspection?.packs?.length);
  }
});

function loadLyStudioTheme(){
  if(document.querySelector('link[data-ly-studio-theme]'))return;
  const theme=document.createElement("link");
  theme.rel="stylesheet";
  theme.href="theme-v2.css";
  theme.dataset.lyStudioTheme="2";
  document.head.appendChild(theme);
}
loadLyStudioTheme();

function loadDecorationSafety(){
  if(document.querySelector('script[data-rabbit-decoration-safety]'))return;
  const safety=document.createElement("script");
  safety.src="app-decoration-safety.js";
  safety.dataset.rabbitDecorationSafety="1";
  document.body.appendChild(safety);
}
function loadDecorationFeatures(){
  if(document.querySelector('script[data-rabbit-decorations]'))return;
  const script=document.createElement("script");
  script.src="app-decorations.js";
  script.dataset.rabbitDecorations="1";
  script.addEventListener("load",loadDecorationSafety,{once:true});
  document.body.appendChild(script);
}

if(!document.querySelector('script[data-rabbit-features]')){
  const featureScript=document.createElement("script");
  featureScript.src="app-features.js";
  featureScript.dataset.rabbitFeatures="1";
  featureScript.addEventListener("load",loadDecorationFeatures,{once:true});
  document.body.appendChild(featureScript);
}else if(typeof runProjectValidation==="function"){
  loadDecorationFeatures();
}else{
  document.querySelector('script[data-rabbit-features]')?.addEventListener("load",loadDecorationFeatures,{once:true});
}
