/* Studio v4 loader — replaces the old overlapping Easy Studio v3 shell */
(async function(){
  if(window.__lyStudioV4Loader)return;
  window.__lyStudioV4Loader=true;

  document.title="LY Bedrock Character Studio v4";
  const version="4.0.1";
  const read=async path=>{
    const response=await fetch(`${path}?v=${version}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`โหลด ${path} ไม่สำเร็จ (${response.status})`);
    return response.text();
  };
  const join=async paths=>(await Promise.all(paths.map(read))).join("\n");

  try{
    const core=await join([
      "v4/app-studio-v4.part1.txt",
      "v4/app-studio-v4.part2.txt",
      "v4/app-studio-v4.part3.txt",
      "v4/app-studio-v4.part4.txt"
    ]);
    new Function(`${core}\n//# sourceURL=app-studio-v4.js`)();

    const preview=await join([
      "v4/app-studio-v4-preview.part1.txt",
      "v4/app-studio-v4-preview.part2.txt"
    ]);
    new Function(`${preview}\n//# sourceURL=app-studio-v4-preview.js`)();

    const title=document.querySelector(".topbar h1");
    if(title)title.textContent="Bedrock Character Studio v4";
    const eyebrow=document.querySelector(".topbar .eyebrow");
    if(eyebrow)eyebrow.textContent="LY ADD-ON PRODUCTION WORKSPACE";
  }catch(error){
    console.error("Studio v4 failed to start",error);
    const main=document.querySelector(".main");
    if(main&&!document.getElementById("v4LoadError")){
      const box=document.createElement("div");
      box.id="v4LoadError";
      box.style.cssText="margin:18px;padding:16px;border:1px solid #ff667e;border-radius:12px;background:#2a1b24;color:#ffadbb";
      box.textContent=`เปิด Studio v4 ไม่สำเร็จ: ${error.message}`;
      main.prepend(box);
    }
  }
})();
