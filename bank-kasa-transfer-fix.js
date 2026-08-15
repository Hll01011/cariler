/* HİS Finans V3 loader — eski finans yamaları yerine merkezi motor katmanı */
(function(){'use strict';
  const files=['v3-bridge.js','v3-manual-edit.js','v3-ui-fix.js'];
  let i=0;
  function next(){
    if(i>=files.length){window.hisFinansV3Loaded=true;return;}
    const s=document.createElement('script');
    s.src=files[i++]+'?v=3';
    s.onload=next;
    s.onerror=()=>{console.error('HİS Finans V3 yüklenemedi:',s.src);next()};
    document.head.appendChild(s);
  }
  next();
})();
