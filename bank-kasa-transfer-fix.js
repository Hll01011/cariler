/* HİS Finans V3 loader — merkezi finans motoru + yalnızca ön yüz UI polish */
(function(){'use strict';
  const files=['v3-bridge.js','v3-manual-edit.js','v3-ui-fix.js','ui-polish.js'];
  let i=0;
  function next(){
    if(i>=files.length){window.hisFinansV3Loaded=true;return;}
    const s=document.createElement('script');
    s.src=files[i++]+'?v=4';
    s.onload=next;
    s.onerror=()=>{console.error('HİS Finans katmanı yüklenemedi:',s.src);next()};
    document.head.appendChild(s);
  }
  next();
})();