/* Loader: preserve combined face safety, then enable full-body outfit mode */
(function(){
  function loadOutfit(){
    if(document.querySelector('script[data-rabbit-outfit-mode]'))return;
    const outfit=document.createElement('script');
    outfit.src='app-outfit.js';
    outfit.dataset.rabbitOutfitMode='1';
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
    console.warn('Combined face safety could not be loaded; outfit mode will still start.');
    loadOutfit();
  },{once:true});
  document.body.appendChild(preserved);
})();
