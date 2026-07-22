let itemIdTouched=false;
const itemIdField=$("itemName");
const originalCustomerItemId=customerItemId;
function editableItemSuffix(value){
  return cleanId(String(value||"").replace(/^ly\s*[:\-_ ]*/i,""),"customer_model");
}
function applyEditableItemId(value,markTouched=false){
  if(!itemIdField)return;
  if(markTouched)itemIdTouched=true;
  const item=editableItemSuffix(value);
  itemIdField.value=item;
  itemIdField.readOnly=false;
  $("namespace").value="ly";
  $("namespace").readOnly=true;
  $("geometryId").value=`geometry.ly.${item}`;
  $("animationId").value=`animation.ly.${item}.idle_motion`;
  $("giveCommand").textContent=`/give @s ly:${item} 1`;
  if($("controllerItemName")){
    $("controllerItemName").value=`${item}_controller`;
    $("controllerItemName").readOnly=true;
  }
  if($("controllerGiveCommand"))$("controllerGiveCommand").textContent=`/give @s ly:${item}_controller 1`;
  const label=itemIdField.closest("label")?.querySelector("span");
  if(label)label.textContent="Item ID (แก้ได้ • เริ่มด้วย LY อัตโนมัติ)";
}
customerItemId=function(){return editableItemSuffix(itemIdField?.value)};
if(itemIdField){
  itemIdField.readOnly=false;
  applyEditableItemId(itemIdField.value,false);
  itemIdField.addEventListener("input",()=>applyEditableItemId(itemIdField.value,true));
  $("customerFileName")?.addEventListener("input",()=>{
    if(!itemIdTouched)applyEditableItemId(originalCustomerItemId($("customerFileName").value),false);
    else applyEditableItemId(itemIdField.value,false);
  });
}

function makeSimpleExpressionRenderControllers(ns,item,count){
  const controllers={};
  for(let i=0;i<count;i++){
    controllers[`controller.render.${ns}.${item}.expr_${i}`]={
      geometry:"Geometry.default",
      materials:[{"*":"Material.default"}],
      textures:["Texture.default"]
    };
  }
  return {format_version:"1.8.0",render_controllers:controllers};
}

async function readExpressionModel(file,geometryIdentifier){
  const data=JSON.parse(await file.text());
  const isBB=file.name.toLowerCase().endsWith(".bbmodel")||Array.isArray(data.outliner)||Array.isArray(data.elements);
  if(isBB){
    return {
      geometry:convertBBGeometry(data,geometryIdentifier),
      embeddedTexture:extractEmbeddedTexture(data),
      sourceType:"bbmodel"
    };
  }
  const geometry=JSON.parse(JSON.stringify(data));
  const geos=geometry["minecraft:geometry"];
  if(!Array.isArray(geos)||!geos.length)throw new Error(`ไฟล์ ${file.name} ไม่พบ minecraft:geometry`);
  geos[0].description=geos[0].description||{};
  geos[0].description.identifier=geometryIdentifier;
  return {geometry,embeddedTexture:null,sourceType:"geometry"};
}

$("buildBtn").addEventListener("click",async()=>{
  const btn=$("buildBtn");
  try{
    if(getControllerMode()==="merge")throw new Error("โหมดนี้ใช้สำหรับรวม Add-on อย่างเดียว");
    btn.disabled=true;
    setStatus("กำลังเตรียมไฟล์...");
    const ns="ly";
    const item=customerItemId($("customerFileName")?.value||$("itemName").value);
    const identifier=`${ns}:${item}`;
    const geometryId=`geometry.${ns}.${item}`;
    const animationId=`animation.${ns}.${item}.idle_motion`;
    const version=parseVersion($("version").value);
    const packName=$("packName").value.trim()||"Customer Model";
    const author=$("author").value.trim()||"Unknown";
    const outputBase=lyFileBase($("customerFileName")?.value,"Customer_Head");
    const controllerEnabled=getControllerMode()==="expressions";
    const expressionMethod=typeof getFaceMethod==="function"?getFaceMethod():"bone";
    const controllerItem=`${item}_controller`;
    const controllerDisplayName=$("controllerDisplayName")?.value.trim()||`${outputBase} Controller`;
    const controllerMenuTitle=$("controllerMenuTitle")?.value.trim()||"เลือกสีหน้า";
    const controllerMenuBody=$("controllerMenuBody")?.value.trim()||"เลือกสีหน้าที่ต้องการใช้";
    const expressions=getExpressions();
    const slot=$("slot").value;

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
      if($("includeSource").checked){
        for(const id of ["geoFile","textureFile","iconFile","animationFile"])if($(id).files[0])sources.push($(id).files[0]);
      }
    }

    const variants=[];
    if(controllerEnabled){
      for(let index=0;index<expressions.length;index++){
        const expression=expressions[index];
        const suffix=index?`_expr_${index}`:"";
        const variantItem=`${item}${suffix}`;
        const variantGeometryId=expressionMethod==="model"&&index>0?`geometry.${ns}.${item}.expr_${index}`:geometryId;
        let variantGeometry=geometry;
        let variantTexture=texture;
        let geometryFileName=`${item}.geo.json`;
        let textureFileName=`${item}.png`;

        if(expressionMethod==="texture"){
          if(expression.textureFile)variantTexture=expression.textureFile;
          else if(index>0)throw new Error(`สีหน้า “${expression.label}” ยังไม่มี Texture PNG`);
          textureFileName=index?`${item}_expr_${index}.png`:`${item}.png`;
        }else if(expressionMethod==="model"){
          if(expression.modelFile){
            const read=await readExpressionModel(expression.modelFile,variantGeometryId);
            variantGeometry=read.geometry;
            variantTexture=expression.textureFile||read.embeddedTexture||texture;
            geometryFileName=index?`${item}_expr_${index}.geo.json`:`${item}.geo.json`;
            textureFileName=index?`${item}_expr_${index}.png`:`${item}.png`;
            if($("includeSource").checked)sources.push(expression.modelFile);
          }else if(index>0){
            throw new Error(`สีหน้า “${expression.label}” ยังไม่มีไฟล์โมเดล`);
          }
          if(expression.textureFile){
            variantTexture=expression.textureFile;
            if($("includeSource").checked)sources.push(expression.textureFile);
          }
          if(!variantTexture)throw new Error(`สีหน้า “${expression.label}” ไม่พบ Texture`);
        }
        if(expressionMethod==="texture"&&expression.textureFile&&$("includeSource").checked)sources.push(expression.textureFile);

        variants.push({
          expression,index,variantItem,
          identifier:`${ns}:${variantItem}`,
          geometry:variantGeometry,
          geometryId:variantGeometryId,
          geometryFileName,
          texture:variantTexture,
          textureFileName,
          texturePath:`textures/entity/${textureFileName.replace(/\.png$/i,"")}`,
          renderId:`controller.render.${ns}.${item}.expr_${index}`
        });
      }
    }

    const rpHeader=uuid(),rpModule=uuid(),bpHeader=uuid(),bpModule=uuid();
    const bpModules=[{type:"data",uuid:bpModule,version}];
    const bpDependencies=[{uuid:rpHeader,version}];
    if(controllerEnabled){
      bpModules.push({type:"script",language:"javascript",entry:"scripts/main.js",uuid:uuid(),version});
      bpDependencies.push(
        {module_name:"@minecraft/server",version:"1.16.0"},
        {module_name:"@minecraft/server-ui",version:"1.3.0"}
      );
    }
    const bpManifest={
      format_version:2,
      header:{name:`${packName} BP [${item}]`,description:`Generated by Rabbit Builder • ${author}`,uuid:bpHeader,version,min_engine_version:[1,21,0]},
      modules:bpModules,
      dependencies:bpDependencies
    };
    const rpManifest={
      format_version:2,
      header:{name:`${packName} RP [${item}]`,description:`Generated by Rabbit Builder • ${author}`,uuid:rpHeader,version,min_engine_version:[1,21,0]},
      modules:[{type:"resources",uuid:rpModule,version}]
    };

    const makeWearableItem=(id,visible=true)=>({
      format_version:"1.21.0",
      "minecraft:item":{
        description:{identifier:id,...(visible?{menu_category:{category:"equipment"}}:{})},
        components:{
          "minecraft:display_name":{value:`item.${id}.name`},
          "minecraft:icon":{textures:{default:item}},
          "minecraft:wearable":{slot,dispensable:true},
          "minecraft:max_stack_size":1
        }
      }
    });
    const makeAttachable=(id,renderController,geometryIdentifier=geometryId,texturePath=`textures/entity/${item}`)=>{
      const desc={
        identifier:id,
        materials:{default:"entity_alphatest"},
        textures:{default:texturePath},
        geometry:{default:geometryIdentifier},
        render_controllers:[renderController]
      };
      if(animation){
        desc.animations={custom_animation:animationId};
        desc.scripts={animate:["custom_animation"]};
      }
      if($("hideHelmet").checked){
        desc.scripts=desc.scripts||{};
        desc.scripts.parent_setup="variable.helmet_layer_visible = 0.0;";
      }
      return {format_version:"1.10.0","minecraft:attachable":{description:desc}};
    };

    const defaultRenderId=`controller.render.${ns}.${item}.default`;
    const expressionRenderFile=controllerEnabled
      ? expressionMethod==="bone"
        ? makeExpressionRenderControllers(ns,item,expressions)
        : makeSimpleExpressionRenderControllers(ns,item,expressions.length)
      : {format_version:"1.8.0",render_controllers:{[defaultRenderId]:{geometry:"Geometry.default",materials:[{"*":"Material.default"}],textures:["Texture.default"]}}};

    const bp=new JSZip(),rp=new JSZip();
    bp.file("manifest.json",JSON.stringify(bpManifest,null,2));
    rp.file("manifest.json",JSON.stringify(rpManifest,null,2));
    rp.folder("textures/items").file(`${item}.png`,icon);
    rp.folder("render_controllers").file(`${item}.render_controllers.json`,JSON.stringify(expressionRenderFile,null,2));
    rp.folder("texts").file("languages.json",JSON.stringify(["en_US","th_TH"],null,2));
    if(animation)rp.folder("animations").file(`${item}.animation.json`,JSON.stringify(animation,null,2));

    const languageEn=[];
    const languageTh=[];
    const displayEn=$("displayEn").value||packName;
    const displayTh=$("displayTh").value||packName;

    if(controllerEnabled){
      const writtenGeometry=new Set();
      const writtenTextures=new Set();
      for(const variant of variants){
        bp.folder("items").file(`${variant.variantItem}.json`,JSON.stringify(makeWearableItem(variant.identifier,variant.index===0),null,2));
        rp.folder("attachables").file(`${variant.variantItem}.json`,JSON.stringify(makeAttachable(variant.identifier,variant.renderId,variant.geometryId,variant.texturePath),null,2));
        if(!writtenGeometry.has(variant.geometryFileName)){
          rp.folder("models/entity").file(variant.geometryFileName,JSON.stringify(variant.geometry,null,2));
          writtenGeometry.add(variant.geometryFileName);
        }
        if(!writtenTextures.has(variant.textureFileName)){
          rp.folder("textures/entity").file(variant.textureFileName,variant.texture);
          writtenTextures.add(variant.textureFileName);
        }
        languageEn.push(`item.${variant.identifier}.name=${displayEn}`);
        languageTh.push(`item.${variant.identifier}.name=${displayTh}`);
      }

      const controllerIdentifier=`${ns}:${controllerItem}`;
      const controllerJson={
        format_version:"1.21.0",
        "minecraft:item":{
          description:{identifier:controllerIdentifier,menu_category:{category:"items"}},
          components:{
            "minecraft:display_name":{value:`item.${controllerIdentifier}.name`},
            "minecraft:icon":{textures:{default:item}},
            "minecraft:max_stack_size":1,
            "minecraft:hand_equipped":true
          }
        }
      };
      bp.folder("items").file(`${controllerItem}.json`,JSON.stringify(controllerJson,null,2));
      bp.folder("scripts").file(
        "main.js",
        makeControllerScript(
          ns,
          controllerItem,
          item,
          slot,
          controllerMenuTitle,
          controllerMenuBody,
          expressions,
          $("autoGiveController")?.checked===true
        )
      );
      languageEn.push(`item.${controllerIdentifier}.name=${controllerDisplayName}`);
      languageTh.push(`item.${controllerIdentifier}.name=${controllerDisplayName}`);
    }else{
      bp.folder("items").file(`${item}.json`,JSON.stringify(makeWearableItem(identifier,true),null,2));
      rp.folder("attachables").file(`${item}.json`,JSON.stringify(makeAttachable(identifier,defaultRenderId),null,2));
      rp.folder("models/entity").file(`${item}.geo.json`,JSON.stringify(geometry,null,2));
      rp.folder("textures/entity").file(`${item}.png`,texture);
      languageEn.push(`item.${identifier}.name=${displayEn}`);
      languageTh.push(`item.${identifier}.name=${displayTh}`);
    }

    const atlas={
      resource_pack_name:`${packName} RP`,
      texture_name:"atlas.items",
      texture_data:{[item]:{textures:`textures/items/${item}`}}
    };
    rp.folder("textures").file("item_texture.json",JSON.stringify(atlas,null,2));
    rp.folder("texts").file("en_US.lang",languageEn.join("\n")+"\n");
    rp.folder("texts").file("th_TH.lang",languageTh.join("\n")+"\n");

    const dep=bpManifest.dependencies[0];
    if(dep.uuid!==rpManifest.header.uuid||JSON.stringify(dep.version)!==JSON.stringify(rpManifest.header.version))throw new Error("Dependency validation failed");

    setStatus("กำลังสร้าง BP.mcpack...");
    const bpBlob=await bp.generateAsync({type:"blob",compression:"DEFLATE"});
    setStatus("กำลังสร้าง RP.mcpack...");
    const rpBlob=await rp.generateAsync({type:"blob",compression:"DEFLATE"});
    const addon=new JSZip();
    addon.file(`${outputBase}_BP.mcpack`,bpBlob);
    addon.file(`${outputBase}_RP.mcpack`,rpBlob);
    if(sources.length){
      const sourceFolder=addon.folder("source_files");
      const usedNames=new Set();
      for(const file of sources){
        if(!file)continue;
        let name=file.name||"source_file";
        if(usedNames.has(name))name=`${Date.now()}_${name}`;
        usedNames.add(name);
        sourceFolder.file(name,file);
      }
    }
    if($("includeReadme").checked){
      const methodText={bone:"Bone",texture:"Texture",model:"โมเดลแยก"}[expressionMethod]||expressionMethod;
      const controllerLines=controllerEnabled
        ? `\nController: /give @s ${ns}:${controllerItem} 1\nวิธีใช้: สวม ${identifier} แล้วถือ Controller กดใช้และเลือกสีหน้า\nวิธีเปลี่ยนสีหน้า: ${methodText}\nจำนวนสีหน้า: ${expressions.length}\n`
        : "\nระบบสีหน้า: ไม่ได้เปิดใช้\n";
      addon.file("README_TH.txt",`แพ็ก: ${packName}\nไอเทม: ${identifier}\nGeometry: ${geometryId}\nคำสั่ง: /give @s ${identifier} 1\nชื่อไฟล์: ${outputBase}.mcaddon\n${controllerLines}`);
    }
    setStatus("กำลังรวม .mcaddon...");
    const blob=await addon.generateAsync({type:"blob",compression:"DEFLATE"});
    download(blob,`${outputBase}.mcaddon`);
    setStatus(`สร้างสำเร็จ: ${outputBase}.mcaddon`);
  }catch(e){
    setStatus("เกิดข้อผิดพลาด: "+e.message);
  }finally{
    refresh();
  }
});
