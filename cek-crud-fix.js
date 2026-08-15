/* HİS Finans — Çek/Senet düzenle + sil güvenli katmanı */
(function(){
  'use strict';
  function addCrudButtons(){
    const title=document.getElementById('modalTitle');
    const view=document.getElementById('view');
    if(!view || !title)return;
    if(!/çek\s*\/\s*senet/i.test(title.textContent||''))return;
    const rows=[...view.querySelectorAll('table tbody tr')];
    rows.forEach(row=>{
      if(row.dataset.hisCrud==='1')return;
      const cells=row.querySelectorAll('td');
      if(cells.length<8)return;
      const first=cells[0]?.textContent?.trim()||'';
      const check=(S.checks||[]).find(x=>String(x.cek_no||'-').trim()===first);
      if(!check)return;
      const actions=cells[7].querySelector('.actions')||cells[7];
      if(!actions)return;
      if(typeof window.editCheckFlow==='function'){
        const edit=document.createElement('button');
        edit.className='ghost';edit.type='button';edit.textContent='Düzenle';
        edit.onclick=()=>window.editCheckFlow(check.id);
        actions.appendChild(edit);
      }
      const del=document.createElement('button');
      del.className='dangerBtn';del.type='button';del.textContent='Sil';
      del.onclick=()=>window.deleteCheckFlow(check.id);
      actions.appendChild(del);
      row.dataset.hisCrud='1';
    });
  }
  window.deleteCheckFlow=async function(id){
    const x=(S.checks||[]).find(z=>z.id===id);
    if(!x)return toast('Çek bulunamadı.',true);
    const ok=confirm('Bu çek/senet kaydı silinsin mi?\n\n'+(x.cek_no||'-')+' — '+money(x.tutar));
    if(!ok)return;
    try{
      /* Önce çek kaydını sil. Mevcut sistemde kaynak bağlantıları trigger ile yönetiliyorsa
         veritabanı ters kayıt mantığını uygular; manuel test kayıtlarında doğrudan silinir. */
      await api('cek_senetler?id=eq.'+encodeURIComponent(id),{method:'DELETE'});
      await load();
      toast('Çek/senet silindi.');
    }catch(e){toast(e.message||'Çek silinemedi.',true)}
  };
  const originalCekler=window.cekler;
  if(typeof originalCekler==='function'){
    window.cekler=function(){
      originalCekler();
      setTimeout(addCrudButtons,20);
      setTimeout(addCrudButtons,150);
    };
  }
  const observer=new MutationObserver(()=>{clearTimeout(window.__hisCheckCrudTimer);window.__hisCheckCrudTimer=setTimeout(addCrudButtons,40)});
  observer.observe(document.body,{subtree:true,childList:true});
})();
