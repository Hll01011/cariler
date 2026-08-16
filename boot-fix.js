/* HİS Finans — deterministic boot / script-race fix */
(function(){
  'use strict';
  window.__HIS_FINANS_READY = false;
  function lock(){
    if(document.getElementById('hisBootLock')) return;
    const d=document.createElement('div');
    d.id='hisBootLock';
    d.innerHTML='<div class="hisBootCard"><b>HİS FİNANS</b><span>Finans motoru hazırlanıyor…</span></div>';
    Object.assign(d.style,{position:'fixed',inset:'0',zIndex:'99999',display:'grid',placeItems:'center',background:'rgba(8,19,35,.72)',backdropFilter:'blur(5px)',fontFamily:'Segoe UI,Arial,sans-serif'});
    const c=d.firstElementChild;
    Object.assign(c.style,{background:'#fff',borderRadius:'18px',padding:'24px 30px',boxShadow:'0 25px 70px rgba(0,0,0,.28)',textAlign:'center',minWidth:'260px'});
    c.querySelector('b').style.display='block';
    c.querySelector('b').style.fontSize='20px';
    c.querySelector('b').style.marginBottom='7px';
    c.querySelector('span').style.color='#718096';
    document.body.appendChild(d);
  }
  function unlock(){
    window.__HIS_FINANS_READY=true;
    document.getElementById('hisBootLock')?.remove();
    try{
      if(window.S && typeof window.nav==='function') window.nav(window.S.page||'dashboard');
      else if(window.S && typeof window.load==='function') window.load();
    }catch(e){console.error('HIS boot refresh:',e)}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',lock,{once:true}); else lock();
  window.__HIS_FINANS_UNLOCK=unlock;
  // The script itself is loaded last; all V5 patches are now guaranteed to exist.
  unlock();
})();
