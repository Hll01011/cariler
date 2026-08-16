/* HİS Finans V4 loader — finans motoruna dokunmadan UI katmanı */
(function(){'use strict';
  const files=['v3-bridge.js','v3-manual-edit.js','v3-ui-fix.js','ui-polish.js','ui-v4.js'];
  let i=0;
  function next(){
    if(i>=files.length){window.hisFinansV3Loaded=true;return;}
    const s=document.createElement('script');
    s.src=files[i++]+'?v=5';
    s.onload=next;
    s.onerror=()=>{console.error('HİS Finans katmanı yüklenemedi:',s.src);next()};
    document.head.appendChild(s);
  }
  next();
})();