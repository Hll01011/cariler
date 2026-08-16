/* HİS Finans çekirdek yükleyici - sabit çalışan sürüm */
(function(){
  'use strict';
  /* 2026-08-15 tarihli son çalışan temiz kurulumun gerçek commit'i. */
  var base='https://raw.githubusercontent.com/Hll01011/cariler/0cdf783313a8697864555f932b82167f9a710664/app.js';
  /* Parser-blocking: index.html'deki finans eklentileri çekirdek uygulamadan sonra çalışmalı. */
  document.write('<script src="'+base+'"><\\/script>');
  /* Modal kaydetme kilidini finans mutation kilidinden ayır. */
  window.modal=function(title,html,save,label){
    label=label||'Kaydet';
    var titleEl=document.getElementById('modalTitle'),body=document.getElementById('modalBody'),b=document.getElementById('modalSave'),m=document.getElementById('modal');
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