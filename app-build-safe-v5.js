/* LY Studio v5 — one build route + generated add-on integrity check */
(function(){
  if(window.__lySafeBuildV5)return;
  window.__lySafeBuildV5=true;

  const byId=id=>document.getElementById(id);
  const setBuildStatus=text=>{
    if(typeof setStatus==="function")setStatus(text);
    else if(byId("status"))byId("status").textContent=text;
  };

  function installSingleBuildRoute(){
    const legacy=byId("buildBtn");
    if(!legacy||legacy.dataset.singleBuildRoute==="1")return;

    const visible=legacy.cloneNode(true);
    legacy.id="legacyBuildBtn";
    legacy.tabIndex=-1;
    legacy.setAttribute("aria-hidden","true");
    legacy.style.display="none";
    visible.id="buildBtn";
    visible.dataset.singleBuildRoute="1";
    legacy.replaceWith(visible);

    visible.addEventListener("click",event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      if(visible.disabled)return;

      const selectedMode=typeof getControllerMode==="function"?getControllerMode():"none";
      if(selectedMode==="merge"){
        setBuildStatus("โหมดนี้ใช้ปุ่มรวม Add-on ด้านล่าง");
        byId("merge")?.scrollIntoView({behavior:"smooth",block:"start"});
        return;
      }

      if(typeof runProjectValidation==="function"){
        const result=runProjectValidation(true);
        if(result&&result.ok===false){
          setBuildStatus("ยัง Build ไม่ได้: กรุณาแก้รายการตรวจสอบ");
          return;
        }
      }

      const textureCount=byId("textureFile")?.files?.length||0;
      const route=typeof mode!=="undefined"&&mode==="manual"&&textureCount>1
        ? "Geo.json + Multi-Texture"
        : selectedMode==="outfit"
          ? "ชุดขยับตามร่างกาย"
          : "โมเดลติดจุดเดียว";
      setBuildStatus(`กำลัง Build ด้วยระบบเดียว: ${route}`);

      legacy.disabled=false;
      legacy.click();
    },true);

    const syncDisabled=()=>{
      if(typeof refresh==="function")refresh();
    };
    ["bbFile","geoFile","textureFile","fallbackTexture","iconFile","animationFile"].forEach(id=>{
      byId(id)?.addEventListener("change",()=>setTimeout(syncDisabled,0));
    });
  }

  async function jsonFile(zip,path){
    const entry=zip.file(path);
    if(!entry)throw new Error(`ไม่พบ ${path}`);
    try{return JSON.parse(await entry.async("string"));}
    catch(error){throw new Error(`${path} เป็น JSON ไม่ถูกต้อง: ${error.message}`);}
  }

  function packKind(manifest){
    const types=(manifest?.modules||[]).map(module=>module?.type);
    if(types.includes("resources"))return "rp";
    if(types.includes("data")||types.includes("script"))return "bp";
    return "unknown";
  }

  function normalizedTexturePath(value){
    const path=String(value||"").replace(/^\/+/,"");
    return /\.[a-z0-9]+$/i.test(path)?path:`${path}.png`;
  }

  async function validateGeneratedAddon(blob){
    if(typeof JSZip==="undefined")throw new Error("JSZip ยังไม่พร้อม");
    const outer=await JSZip.loadAsync(blob);
    const nestedEntries=Object.values(outer.files).filter(entry=>!entry.dir&&/\.mcpack$/i.test(entry.name));
    if(nestedEntries.length<2)throw new Error("ไฟล์ .mcaddon ต้องมี BP.mcpack และ RP.mcpack");

    let bp=null,rp=null;
    for(const entry of nestedEntries){
      const zip=await JSZip.loadAsync(await entry.async("blob"));
      const manifest=await jsonFile(zip,"manifest.json");
      const pack={zip,manifest,name:entry.name,kind:packKind(manifest)};
      if(pack.kind==="bp"&&!bp)bp=pack;
      if(pack.kind==="rp"&&!rp)rp=pack;
    }
    if(!bp)throw new Error("ไม่พบ Behavior Pack ที่ถูกต้อง");
    if(!rp)throw new Error("ไม่พบ Resource Pack ที่ถูกต้อง");

    const rpUuid=rp.manifest?.header?.uuid;
    const dependency=(bp.manifest?.dependencies||[]).find(item=>item?.uuid===rpUuid);
    if(!rpUuid||!dependency)throw new Error("BP ไม่ได้เชื่อม UUID ไปยัง RP");

    const itemFiles=Object.keys(bp.zip.files).filter(path=>/^items\/.*\.json$/i.test(path));
    if(!itemFiles.length)throw new Error("BP ไม่มีไฟล์ Item");
    for(const path of itemFiles)await jsonFile(bp.zip,path);

    const geometryIds=new Set();
    const geometryFiles=Object.keys(rp.zip.files).filter(path=>/models\/entity\/.*\.geo\.json$/i.test(path));
    if(!geometryFiles.length)throw new Error("RP ไม่มี Geometry");
    for(const path of geometryFiles){
      const json=await jsonFile(rp.zip,path);
      for(const geometry of json?.["minecraft:geometry"]||[]){
        const identifier=geometry?.description?.identifier;
        if(identifier)geometryIds.add(identifier);
      }
    }

    const controllerIds=new Map();
    const controllerFiles=Object.keys(rp.zip.files).filter(path=>/render_controllers\/.*\.json$/i.test(path));
    if(!controllerFiles.length)throw new Error("RP ไม่มี Render Controller");
    for(const path of controllerFiles){
      const json=await jsonFile(rp.zip,path);
      for(const [id,controller] of Object.entries(json?.render_controllers||{}))controllerIds.set(id,{controller,path});
    }

    const attachableFiles=Object.keys(rp.zip.files).filter(path=>/attachables\/.*\.json$/i.test(path));
    if(!attachableFiles.length)throw new Error("RP ไม่มี Attachable");
    for(const path of attachableFiles){
      const json=await jsonFile(rp.zip,path);
      const description=json?.["minecraft:attachable"]?.description;
      if(!description?.identifier)throw new Error(`${path} ไม่มี identifier`);

      const geometryMap=description.geometry||{};
      const textureMap=description.textures||{};
      for(const [key,identifier] of Object.entries(geometryMap)){
        if(!geometryIds.has(identifier))throw new Error(`${path}: Geometry.${key} อ้างถึง ${identifier} ที่ไม่มีไฟล์`);
      }
      for(const [key,value] of Object.entries(textureMap)){
        const texturePath=normalizedTexturePath(value);
        if(!rp.zip.file(texturePath))throw new Error(`${path}: Texture.${key} อ้างถึง ${texturePath} ที่ไม่มีไฟล์`);
      }

      const renderList=Array.isArray(description.render_controllers)?description.render_controllers:[];
      if(!renderList.length)throw new Error(`${path} ไม่มี render_controllers`);
      for(const renderId of renderList){
        const record=controllerIds.get(renderId);
        if(!record)throw new Error(`${path}: ไม่พบ Render Controller ${renderId}`);
        const geometryKey=String(record.controller?.geometry||"").replace(/^Geometry\./,"");
        if(geometryKey&&!Object.prototype.hasOwnProperty.call(geometryMap,geometryKey)){
          throw new Error(`${record.path}: Geometry.${geometryKey} ไม่ได้ประกาศใน ${path}`);
        }
        for(const textureRef of record.controller?.textures||[]){
          const textureKey=String(textureRef||"").replace(/^Texture\./,"");
          if(textureKey&&!Object.prototype.hasOwnProperty.call(textureMap,textureKey)){
            throw new Error(`${record.path}: Texture.${textureKey} ไม่ได้ประกาศใน ${path}`);
          }
        }
      }
    }

    return {
      bp:bp.name,
      rp:rp.name,
      items:itemFiles.length,
      geometries:geometryFiles.length,
      textures:Object.keys(rp.zip.files).filter(path=>/textures\/entity\/.*\.png$/i.test(path)).length,
      attachables:attachableFiles.length,
      controllers:controllerIds.size
    };
  }

  function installDownloadCheck(){
    const original=window.download;
    if(typeof original!=="function"||original.__lySafeWrapped)return;

    const safeDownload=function(blob,name){
      if(!/\.mcaddon$/i.test(String(name||"")))return original(blob,name);
      setBuildStatus("กำลังตรวจสอบโครงสร้าง Add-on ก่อนดาวน์โหลด...");
      validateGeneratedAddon(blob).then(summary=>{
        setBuildStatus(`สร้างและตรวจสอบสำเร็จ: ${name} • ${summary.geometries} Geometry • ${summary.textures} Texture`);
        original(blob,name);
      }).catch(error=>{
        console.error("Generated add-on validation failed",error);
        setBuildStatus(`Build ไม่ผ่านการตรวจสอบ: ${error.message}`);
      });
    };
    safeDownload.__lySafeWrapped=true;
    window.download=safeDownload;
  }

  function addBuildNote(){
    const card=document.querySelector(".build-card");
    if(!card||byId("singleBuildEngineNote"))return;
    const note=document.createElement("div");
    note.id="singleBuildEngineNote";
    note.className="controller-warning";
    note.innerHTML="<b>Build Engine เดียว</b><span>โมเดลปกติและชุดเต็มตัวใช้ขั้นตอนเดียวกัน ต่างกันเฉพาะวิธีผูก Bone • ระบบจะตรวจไฟล์ภายในก่อนดาวน์โหลด</span>";
    card.querySelector(".section-head")?.insertAdjacentElement("afterend",note);
  }

  function start(){
    installDownloadCheck();
    installSingleBuildRoute();
    addBuildNote();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();