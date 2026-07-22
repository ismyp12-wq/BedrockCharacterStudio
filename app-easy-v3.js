/* LY Character Studio v3 — one guided workflow, many build modes */
(function(){
  if(window.__lyEasyStudioV3)return;
  window.__lyEasyStudioV3=true;

  const MODES={
    basic:{legacy:"none",icon:"◇",title:"โมเดลทั่วไป",desc:"หัว หมวก ผม อาวุธ หรือของสวมชิ้นเดียว",guide:"เหมาะกับโมเดลที่ยึดกับช่องสวมเพียงตำแหน่งเดียว เช่น Head หรือ Chest"},
    outfit:{legacy:"outfit",icon:"♙",title:"ชุดเต็มตัว",desc:"ชุดที่ขยับตามหัว ลำตัว แขน และขา",guide:"แยก Group เป็น Head, Body, Right Arm, Left Arm, Right Leg และ Left Leg"},
    faces:{legacy:"expressions",icon:"☺",title:"ระบบสีหน้า",desc:"เลือกเปลี่ยนด้วย Bone, Texture หรือโมเดลแยก",guide:"ใส่หัวหลักหนึ่งชิ้น แล้วใช้ Controller เปลี่ยนสีหน้าภายในเกม"},
    decorate:{legacy:"decorations",icon:"✦",title:"UI แต่งตัว",desc:"เปิด–ปิดแว่น กระเป๋า ปีก และเลือกชุด",guide:"กรอกชื่อ Bone/Path เอง แล้วเว็บสร้างตัวเลือกในเกมให้อัตโนมัติ"},
    merge:{legacy:"merge",icon:"⇄",title:"รวม Add-on",desc:"รวม .mcaddon หรือ .mcpack หลายไฟล์",guide:"ไม่สร้างโมเดลใหม่ ใช้สำหรับรวมงานที่สร้างไว้แล้วเป็นไฟล์เดียว"}
  };
  const SECTION_IDS=["import","project","geometry","build","controller","merge"];
  let currentMode=localStorage.getItem("lyEasyMode")||"basic";
  if(!MODES[currentMode])currentMode="basic";
  let currentStep=Number(localStorage.getItem("lyEasyStep")||1);
  if(currentStep<1||currentStep>4)currentStep=1;

  const byId=id=>document.getElementById(id);
  const legacyRadio=value=>document.querySelector(`input[name="controllerMode"][value="${value}"]`);

  function loadStyle(){
    if(document.querySelector('link[data-ly-easy-v3]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="easy-v3.css";
    link.dataset.lyEasyV3="1";
    document.head.appendChild(link);
  }

  function makeShell(){
    if(byId("easyStudioV3"))return;
    const main=document.querySelector(".main");
    if(!main)return;
    const shell=document.createElement("section");
    shell.id="easyStudioV3";
    shell.className="easy-v3-shell";
    shell.innerHTML=`
      <div class="easy-v3-head">
        <div><h2>เลือกสิ่งที่ต้องการสร้าง</h2><p>เว็บจะแสดงเฉพาะการตั้งค่าที่เกี่ยวข้อง ไม่ต้องกรอกทุกระบบพร้อมกัน</p></div>
        <span class="easy-version">EASY STUDIO v3</span>
      </div>
      <div id="easyModeGrid" class="easy-mode-grid"></div>
      <div class="easy-guide"><i>i</i><div><b id="easyGuideTitle"></b><span id="easyGuideText"></span></div></div>
      <div class="easy-toolbar">
        <div class="easy-stepbar">
          <button class="easy-step" data-step="1"><em>1</em><b>เลือกประเภท</b></button>
          <button class="easy-step" data-step="2"><em>2</em><b>ใส่ไฟล์</b></button>
          <button class="easy-step" data-step="3"><em>3</em><b>ตั้งค่า</b></button>
          <button class="easy-step" data-step="4"><em>4</em><b>ตรวจสอบและ Build</b></button>
        </div>
        <label class="easy-advanced-toggle"><input id="easyAdvancedToggle" type="checkbox"> แสดงการตั้งค่าขั้นสูง</label>
      </div>
      <div class="easy-nav"><button id="easyBack" type="button">← ย้อนกลับ</button><button id="easyNext" class="easy-next" type="button">ถัดไป →</button></div>
    `;
    const topbar=document.querySelector(".topbar");
    if(topbar?.nextSibling)main.insertBefore(shell,topbar.nextSibling);else main.prepend(shell);

    const grid=byId("easyModeGrid");
    Object.entries(MODES).forEach(([key,mode])=>{
      const button=document.createElement("button");
      button.type="button";
      button.className="easy-mode-card";
      button.dataset.mode=key;
      button.innerHTML=`<span class="easy-mode-icon">${mode.icon}</span><b>${mode.title}</b><span>${mode.desc}</span>`;
      button.addEventListener("click",()=>setMode(key,true));
      grid.appendChild(button);
    });

    shell.querySelectorAll(".easy-step").forEach(button=>button.addEventListener("click",()=>{
      if(button.disabled)return;
      setStep(Number(button.dataset.step));
    }));
    byId("easyBack").addEventListener("click",()=>setStep(Math.max(1,currentStep-1)));
    byId("easyNext").addEventListener("click",()=>{
      if(currentMode==="merge"){setStep(4);return;}
      setStep(Math.min(4,currentStep+1));
    });
    const advanced=byId("easyAdvancedToggle");
    advanced.checked=localStorage.getItem("lyEasyAdvanced")==="1";
    document.body.classList.toggle("easy-show-advanced",advanced.checked);
    advanced.addEventListener("change",()=>{
      document.body.classList.toggle("easy-show-advanced",advanced.checked);
      localStorage.setItem("lyEasyAdvanced",advanced.checked?"1":"0");
    });
  }

  function cleanDefaultDecorations(){
    const list=byId("decorationList");
    if(!list||list.dataset.easyCleaned==="1")return;
    const rows=[...list.querySelectorAll(".decoration-row")];
    const values=rows.map(row=>row.querySelector(".deco-bone")?.value.trim().toLowerCase());
    const oldDefaults=rows.length===4&&["glasses","backpack","outfit_normal","outfit_special"].every((value,index)=>values[index]===value);
    if(oldDefaults){
      list.innerHTML="";
      if(typeof createDecorationRow==="function")list.appendChild(createDecorationRow({label:"แว่น",bone:"",type:"toggle",defaultOn:false}));
    }
    list.dataset.easyCleaned="1";
    if(!list.previousElementSibling?.classList.contains("easy-field-help")){
      const help=document.createElement("div");
      help.className="easy-field-help";
      help.textContent="กรอกชื่อที่แสดงในเกม → ชื่อ Bone/Path → เลือกเปิด–ปิดหรือกลุ่มชุด";
      list.before(help);
    }
    if(typeof updateDecorationPreview==="function")updateDecorationPreview();
  }

  function setLegacyMode(key){
    const value=MODES[key].legacy;
    const radio=legacyRadio(value);
    if(radio&&!radio.checked){radio.checked=true;radio.dispatchEvent(new Event("change",{bubbles:true}));}
  }

  function updateModeUi(){
    document.querySelectorAll(".easy-mode-card").forEach(card=>card.classList.toggle("active",card.dataset.mode===currentMode));
    const mode=MODES[currentMode];
    byId("easyGuideTitle").textContent=mode.title;
    byId("easyGuideText").textContent=mode.guide;
    document.body.classList.remove("easy-mode-basic","easy-mode-outfit","easy-mode-faces","easy-mode-decorate","easy-mode-merge");
    document.body.classList.add(`easy-mode-${currentMode}`);
    if(currentMode==="decorate")cleanDefaultDecorations();
    const side=document.querySelector(".sidebar-note");
    if(side){
      const title=side.querySelector("b"),text=side.querySelector("span");
      if(title)title.textContent=mode.title;
      if(text)text.textContent=mode.guide;
    }
  }

  function applyStepVisibility(){
    SECTION_IDS.forEach(id=>byId(id)?.classList.add("easy-section-hidden"));
    if(currentMode==="merge"){
      byId("merge")?.classList.remove("easy-section-hidden");
    }else if(currentStep===2){
      byId("import")?.classList.remove("easy-section-hidden");
    }else if(currentStep===3){
      byId("project")?.classList.remove("easy-section-hidden");
      byId("geometry")?.classList.remove("easy-section-hidden");
      if(currentMode!=="basic")byId("controller")?.classList.remove("easy-section-hidden");
    }else if(currentStep===4){
      byId("build")?.classList.remove("easy-section-hidden");
    }
    document.querySelectorAll(".easy-step").forEach(button=>{
      const step=Number(button.dataset.step);
      button.classList.toggle("active",step===currentStep);
      button.disabled=currentMode==="merge"&&(step===2||step===3);
    });
    const back=byId("easyBack"),next=byId("easyNext");
    back.disabled=currentStep===1||currentMode==="merge";
    next.disabled=currentStep===4;
    next.textContent=currentStep===4?"พร้อมใช้งาน":currentMode==="merge"?"ไปหน้ารวมไฟล์ →":"ถัดไป →";
    localStorage.setItem("lyEasyStep",String(currentStep));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function setStep(step){
    currentStep=currentMode==="merge"?4:Math.max(1,Math.min(4,step));
    applyStepVisibility();
  }

  function setMode(key,advance=false){
    if(!MODES[key])return;
    currentMode=key;
    localStorage.setItem("lyEasyMode",key);
    setLegacyMode(key);
    updateModeUi();
    currentStep=key==="merge"?4:(advance?2:Math.min(currentStep,4));
    applyStepVisibility();
  }

  function addFriendlyLabels(){
    const item=byId("itemName");
    if(item){item.readOnly=false;item.placeholder="เช่น hmok_head";}
    const customer=byId("customerFileName");
    if(customer)customer.placeholder="เช่น Hmok_Head";
    const controllerTitle=byId("controllerMenuTitle");
    if(controllerTitle)controllerTitle.placeholder="เช่น แต่งตัวละคร";
    const controllerBody=byId("controllerMenuBody");
    if(controllerBody)controllerBody.placeholder="เลือกสีหน้าและของตกแต่ง";
    document.querySelectorAll(".deco-bone").forEach(input=>input.placeholder="Bone / Path เช่น Head.Glasses");
  }

  function syncFromLegacy(){
    document.querySelectorAll('input[name="controllerMode"]').forEach(radio=>radio.addEventListener("change",()=>{
      const found=Object.entries(MODES).find(([,mode])=>mode.legacy===radio.value);
      if(found&&radio.checked&&currentMode!==found[0]){
        currentMode=found[0];
        localStorage.setItem("lyEasyMode",currentMode);
        updateModeUi();
        applyStepVisibility();
      }
    }));
  }

  function start(){
    loadStyle();
    makeShell();
    addFriendlyLabels();
    syncFromLegacy();
    setMode(currentMode,false);
    setStep(currentMode==="merge"?4:currentStep);
    const observer=new MutationObserver(()=>addFriendlyLabels());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
