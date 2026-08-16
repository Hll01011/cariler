/* HİS Finans app core restore + modal deadlock fix */
(function(){
  'use strict';
  var base='https://raw.githubusercontent.com/Hll01011/cariler/8f437f5863d6ece820315ea65f7480148d7ea395/app.js';
  /* Parser-blocking load: finance V5/V6 scripts must see S/api/modal/render. */
  document.write('<script src="'+base+'"><\\/script>');
  window.modal=function(title,html,save,label){
    label=label||'Kaydet';
    var titleEl=document.getElementById('modalTitle'), body=document.getElementById('modalBody'), b=document.getElementById('modalSave'), m=document.getElementById('modal');
    if(!titleEl||!body||!b||!m)return;
    titleEl.textContent=title;body.innerHTML=html;b.textContent=label;b.dataset.saving='0';b.disabled=false;
    b.onclick=async function(){
      if(b.dataset.saving==='1')return;
      b.dataset.saving='1';b.disabled=true;b.textContent='Kaydediliyor…';
      try{await save();}
      catch(e){if(typeof window.toast==='function')window.toast(e.message||'İşlem başarısız',true);}
      finally{b.dataset.saving='0';b.disabled=false;b.textContent=label;}
    };
    m.classList.add('show');
  };
  window.__HIS_MODAL_FIXED=true;
})();