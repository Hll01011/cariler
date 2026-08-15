/* HİS Finans — Çek/Senet güvenli durum geçişleri */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const key=v=>String(v||'').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g,'_').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ç/g,'c');
  function lockStatus(){
    const s=$('cfStatus'); if(!s)return;
    if(!s.dataset.hisInitial)s.dataset.hisInitial=s.value;
    const initial=key(s.dataset.hisInitial), current=key(s.value);
    [...s.options].forEach(o=>{const k=key(o.value);let disabled=false;if(initial==='bankaya_verildi')disabled=!['bankaya_verildi','tahsil_edildi','iade'].includes(k);if(initial==='tahsil_edildi')disabled=k!=='tahsil_edildi';if(initial==='iade')disabled=k!=='iade';o.disabled=disabled;});
    const bank=$('cfBank'),cash=$('cfCash');
    if(bank){bank.disabled=['portfoyde','iade'].includes(current);bank.required=['bankaya_verildi','tahsil_edildi'].includes(current);}
    if(cash){cash.disabled=current!=='tahsil_edildi';if(current!=='tahsil_edildi')cash.value='';}
    const hint=s.closest('.form')?.querySelector('.muted');
    if(hint)hint.textContent=current==='bankaya_verildi'?'Bankaya Verildi = çek bankaya teslim edildi; portföyden çıkar ve banka bakiyesi değişmez. Tahsil edilince gerçek banka hareketi oluşur.':current==='tahsil_edildi'?'Tahsil Edildi = para gerçekten hesaba/kasaya geçti. Banka veya kasa seçeneklerinden yalnızca biri seçilir.':current==='iade'?'İade / Karşılıksız = çek tahsil edilmez; banka/kasa hareketi oluşturulmaz.':'Portföyde = çek işletmenin elinde bekliyor; banka/kasa hareketi oluşturulmaz.';
  }
  function watch(){const s=$('cfStatus');if(!s||s.dataset.hisGuard)return;s.dataset.hisGuard='1';s.addEventListener('change',lockStatus);lockStatus();}
  new MutationObserver(watch).observe(document.body,{childList:true,subtree:true});
  setInterval(watch,500);
})();
