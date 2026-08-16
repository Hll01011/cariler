/* HİS Finans app loader
   Çekirdek uygulama, son sağlam commit'in değişmez blob'undan yüklenir.
   Bu dosya Supabase'e doğrudan erişmez; çekirdek app.js kendi mevcut API katmanını kullanır.
*/
(function(){
  'use strict';
  var base='https://raw.githubusercontent.com/Hll01011/cariler/8f437f5863d6ece820315ea65f7480148d7ea395/app.js';
  var s=document.createElement('script');
  s.src=base;
  s.onload=function(){
    /* Modal kilidi ile finans mutation kilidini ayır. Eski modal(),
       mutate() çağrısından önce busy=true yaptığı için V5 formları hiç
       RPC'ye ulaşamıyordu. Burada yalnızca modal davranışını değiştiriyoruz. */
    window.modal=function(title,html,save,label){
      label=label||'Kaydet';
      var titleEl=document.getElementById('modalTitle'), body=document.getElementById('modalBody'), b=document.getElementById('modalSave'), m=document.getElementById('modal');
      if(!titleEl||!body||!b||!m)return;
      titleEl.textContent=title; body.innerHTML=html; b.textContent=label; b.dataset.saving='0'; b.disabled=false;
      b.onclick=async function(){
        if(b.dataset.saving==='1')return;
        b.dataset.saving='1'; b.disabled=true; b.textContent='Kaydediliyor…';
        try{await save();}
        catch(e){if(typeof window.toast==='function')window.toast(e.message||'İşlem başarısız',true);}
        finally{b.dataset.saving='0';b.disabled=false;b.textContent=label;}
      };
      m.classList.add('show');
    };
    window.__HIS_MODAL_FIXED=true;
  };
  s.onerror=function(){console.error('HİS Finans çekirdek uygulaması yüklenemedi.');};
  document.head.appendChild(s);
})();