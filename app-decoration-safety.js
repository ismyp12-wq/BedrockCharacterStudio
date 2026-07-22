/* Loader: combined safety → outfit mode → Easy Studio v3 */
(function(){
  function loadEasyStudio(){
    if(document.querySelector('script[data-ly-easy-studio]'))return;
    const easy=document.createElement('script');
    easy.src='app-easy-v3.js';
    easy.dataset.lyEasyStudio='3';
    document.body.appendChild(easy);
  }

  function loadOutfit(){
    if(document.querySelector('script[data-rabbit-outfit-mode]')){
      loadEasyStudio();
      return;
    }
    const outfit=document.createElement('script');
    outfit.src='app-outfit.js';
    outfit.dataset.rabbitOutfitMode='1';
    outfit.addEventListener('load',loadEasyStudio,{once:true});
    outfit.addEventListener('error',loadEasyStudio,{once:true});
    document.body.appendChild(outfit);
  }

  if(window.__rabbitCombinedSafetyLoaded){
    loadOutfit();
    return;
  }

  const preserved=document.createElement('script');
  preserved.src='https://cdn.jsdelivr.net/gh/ismyp12-wq/BedrockCharacterStudio@fba7f760525a2f803c1a3e17094599f1f2d8a8ee/app-decoration-safety.js';
  preserved.dataset.rabbitCombinedSafety='1';
  preserved.addEventListener('load',()=>{
    window.__rabbitCombinedSafetyLoaded=true;
    loadOutfit();
  },{once:true});
  preserved.addEventListener('error',()=>{
    console.warn('Combined face safety could not be loaded; outfit and Easy Studio will still start.');
    loadOutfit();
  },{once:true});
  document.body.appendChild(preserved);
})();
