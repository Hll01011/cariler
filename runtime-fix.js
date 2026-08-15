/* HİS Finans — güvenlik katmanı + cari hareket yönetimi + ana ekran cari borç. */
(function(){
  'use strict';
  const baseModal=window.modal;
  const baseApi=window.api;
  if(typeof baseModal==='function'){
    window.modal=function(title,html,save,label='Kaydet'){
      baseModal(title,html,save,label);
      const b=document.getElementById('modalSave');
      if(!b)return;
      b.onclick=async function(){
        if(window.__HIS_MODAL_BUSY)return;
        window.__HIS_MODAL_BUSY=true;b.disabled=true;b.textContent='Kaydediliyor…';
        try{await save()}catch(e){if(typeof toast==='function')toast(e.message||'İşlem başarısız',true)}
        finally{window.__HIS_MODAL_BUSY=false;b.disabled=false;b.textContent=label}
      };
    };
  }
  if(typeof baseApi==='function'){
    window.api=async function(path,opt={}){
      const table=String(path||'').split('?')[0].split('/')[0];
      const method=String(opt.method||'GET').toUpperCase();
      if(table==='cek_senetler'&&(method==='POST'||method==='PATCH')&&opt.body){
        try{const body=JSON.parse(opt.body);if(body.yon==='alınan')body.yon='alinan';opt={...opt,body:JSON.stringify(body)}}catch(_){}}
      return baseApi(path,opt);
    };
  }

  const _dashboard=window.dashboard;
  window.dashboard=function(){
    _dashboard();
    api('cari_hareketleri?select=tip,tutar').then(rows=>{
      const net=(rows||[]).reduce((n,x)=>n+(x.tip==='borc'?1:-1)*Number(x.tutar||0),0);
      const ms=document.querySelectorAll('.metrics .metric');
      if(ms[1]){
        const small=ms[1].querySelector('small'),b=ms[1].querySelector('b'),sp=ms[1].querySelector('span');
        if(small)small.textContent='Açık Borç';
        if(b){b.textContent=money(Math.max(net,0));b.style.color=net>0?'var(--red)':'';}
        if(sp)sp.textContent='cari net bakiyesi';
      }
    }).catch(()=>{});
  };

  async function getMove(id){
    const rows=await api('cari_hareketleri?id=eq.'+encodeURIComponent(id)+'&select=*');
    return rows?.[0]||null;
  }
  async function getCari(id){
    const rows=await api('cariler?id=eq.'+encodeURIComponent(id)+'&select=*');
    return rows?.[0]||null;
  }
  function movementForm(x){
    return `<div class="form">
      <div><label>Tarih *</label><input id="cmDate" type="date" value="${esc(x?.tarih||today())}"></div>
      <div><label>Yön *</label><select id="cmTip"><option value="borc" ${x?.tip==='borc'?'selected':''}>Borç</option><option value="alacak" ${x?.tip==='alacak'?'selected':''}>Alacak</option></select></div>
      <div><label>Tutar *</label><input id="cmAmount" type="number" step="0.01" min="0" value="${Number(x?.tutar||0)}"></div>
      <div><label>Belge No</label><input id="cmDoc" value="${esc(x?.belge_no||'')}"></div>
      <div class="full"><label>Açıklama</label><textarea id="cmDesc">${esc(x?.aciklama||'')}</textarea></div>
    </div>`;
  }
  window.editCariMove=async function(id){
    const x=await getMove(id);
    if(!x)return toast('Cari hareket bulunamadı.',true);
    const linked=x.kaynak_turu&&x.kaynak_turu!=='manual';
    modal('Cari Hareket Düzenle',movementForm(x),async()=>{
      const tarih=$('cmDate').value,tip=$('cmTip').value,tutar=Number($('cmAmount').value),belge_no=$('cmDoc').value.trim(),aciklama=$('cmDesc').value.trim();
      if(!tutar||tutar<0)throw Error('Tutar 0’dan büyük olmalıdır.');
      if(linked)throw Error('Bu hareket '+x.kaynak_turu+' kaydına bağlı. Kaynak kaydı bozmamak için hareketi ilgili modülden düzenleyin.');
      await api('cari_hareketleri?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({tarih,tip,tutar,belge_no,aciklama})});
      closeModal();await load();toast('Cari hareket güncellendi.');
    },'Güncelle');
  };
  window.deleteCariMove=async function(id){
    const x=await getMove(id);
    if(!x)return;
    if(x.kaynak_turu&&x.kaynak_turu!=='manual')return toast('Bu hareket '+x.kaynak_turu+' kaydına bağlı. Silme işlemini kaynak modülden yapmalısınız.',true);
    if(!confirm('Bu cari hareket silinsin mi?'))return;
    await mutate(async()=>{await api('cari_hareketleri?id=eq.'+encodeURIComponent(id),{method:'DELETE'});},'Cari hareket silindi.');
    if(x.cari_id)cariDetail(x.cari_id);
  };
  window.cariDetail=async function(id){
    const c=await getCari(id);
    if(!c)return;
    const moves=await api('cari_hareketleri?cari_id=eq.'+encodeURIComponent(id)+'&select=*&order=tarih.desc,created_at.desc');
    const list=moves||[];
    const bal=list.reduce((n,x)=>n+(x.tip==='borc'?1:-1)*Number(x.tutar||0),0);
    modal('Cari Detay',`<div class="detail"><div>Cari<strong>${esc(c.unvan)}</strong></div><div>Bakiye<strong>${money(Math.abs(bal))} ${bal>0?'Borç':bal<0?'Alacak':''}</strong></div></div>
      <div class="panel" style="margin:0;padding:12px"><div class="panelTop"><h3>Cari Hareketleri</h3><button class="success" onclick="closeModal();newCariMove('${id}')">+ Hareket</button></div>
      <div class="tableWrap"><table style="min-width:760px"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Kaynak</th><th>Yön</th><th class="num">Tutar</th><th>İşlem</th></tr></thead><tbody>
      ${list.map(x=>`<tr><td>${dt(x.tarih)}</td><td>${esc(x.aciklama||x.belge_no||'-')}</td><td>${esc(x.kaynak_turu||'manual')}</td><td>${x.tip==='borc'?'<span class="dangerText">Borç</span>':'<span class="successText">Alacak</span>'}</td><td class="num">${money(x.tutar)}</td><td><div class="actions"><button class="ghost" onclick="editCariMove('${x.id}')">Düzenle</button><button class="dangerBtn" onclick="deleteCariMove('${x.id}')">Sil</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Hareket yok.</td></tr>'}</tbody></table></div></div>`,()=>{},'Kapat');
  };
})();

/* Banka hareketleri: kaynak banka olan kayıt yalnızca banka modülünden düzenlenir. */
(function(){
  'use strict';
  function normalize(v){return String(v??'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR');}
  function bankMoveForm(x){
    return `<div class="form">
      <div><label>Tarih *</label><input id="bmDate" type="date" value="${esc(x?.tarih||today())}"></div>
      <div><label>Tip *</label><select id="bmTip"><option value="giris" ${String(x?.tip).toLowerCase()==='giris'?'selected':''}>Giriş</option><option value="cikis" ${String(x?.tip).toLowerCase()!=='giris'?'selected':''}>Çıkış</option></select></div>
      <div><label>Tutar *</label><input id="bmAmount" type="number" step="0.01" min="0" value="${Number(x?.tutar||0)}"></div>
      <div><label>Belge No</label><input id="bmDoc" value="${esc(x?.belge_no||'')}"></div>
      <div><label>Kategori</label><input id="bmCat" value="${esc(x?.kategori||'')}"></div>
      <div><label>Ödeme Yöntemi</label><input id="bmPay" value="${esc(x?.odeme_yontemi||'')}"></div>
      <div class="full"><label>Açıklama</label><textarea id="bmDesc">${esc(x?.aciklama||'')}</textarea></div>
      <div class="full muted">Bu hareket banka kaynaklıdır. Kaydedildiğinde bağlı cari hareketi de aynı kayıt üzerinden güncellenecektir.</div>
    </div>`;
  }
  async function getBankMove(id){
    const rows=await api('banka_hareketleri?id=eq.'+encodeURIComponent(id)+'&select=*');
    return rows?.[0]||null;
  }
  window.editBankMove=async function(id){
    const x=await getBankMove(id);
    if(!x)return toast('Banka hareketi bulunamadı.',true);
    modal('Banka Hareketi Düzenle',bankMoveForm(x),async()=>{
      const tarih=$('bmDate').value,tip=$('bmTip').value,tutar=Number($('bmAmount').value),belge_no=$('bmDoc').value.trim(),kategori=$('bmCat').value.trim(),odeme_yontemi=$('bmPay').value.trim(),aciklama=$('bmDesc').value.trim();
      if(!tutar||tutar<0)throw Error('Tutar 0’dan büyük olmalıdır.');
      await api('banka_hareketleri?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({tarih,tip,tutar,belge_no,kategori,odeme_yontemi,aciklama})});
      closeModal();await load();toast('Banka hareketi güncellendi. Cari yansıması da güncellendi.');
    },'Güncelle');
  };
  function findBankIdFromModal(){
    const body=document.getElementById('modalBody');if(!body)return null;
    const text=normalize(body.textContent);
    const banks=(typeof S!=='undefined'&&Array.isArray(S.banks))?S.banks:[];
    const bank=banks.find(b=>{const a=normalize(b.banka_adi),h=normalize(b.hesap_adi);return (a&&text.includes(a))||(h&&text.includes(h));});
    return bank?.id||null;
  }
  function decorateBankRows(){
    const modalEl=document.getElementById('modal'),title=document.getElementById('modalTitle');
    if(!modalEl||!title||normalize(title.textContent)!=='banka hareketleri')return;
    const body=document.getElementById('modalBody');if(!body)return;
    const table=body.querySelector('table');if(!table)return;
    const rows=[...table.querySelectorAll('tbody tr')].filter(r=>r.querySelectorAll('td').length>=5);if(!rows.length)return;
    const bankId=findBankIdFromModal();
    const allMoves=(typeof S!=='undefined'&&Array.isArray(S.bankMoves))?S.bankMoves:[];
    const moves=allMoves.filter(x=>!bankId||x.banka_hesap_id===bankId).slice().sort((a,b)=>{const d1=String(a.tarih||''),d2=String(b.tarih||'');if(d1!==d2)return d2.localeCompare(d1);return String(b.created_at||'').localeCompare(String(a.created_at||''));});
    rows.forEach((row,i)=>{
      if(row.dataset.hisEditAdded==='1')return;
      const cells=row.querySelectorAll('td'),buttons=cells[cells.length-1];if(!buttons)return;
      const dateText=normalize(cells[0]?.textContent),descText=normalize(cells[2]?.textContent),amountText=normalize(cells[4]?.textContent).replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
      let move=moves.find(x=>normalize(dt(x.tarih))===dateText&&normalize(x.aciklama||x.belge_no||'-')===descText&&Math.abs(Number(x.tutar||0)-Number(amountText||0))<0.005);
      if(!move)move=moves[i];if(!move)return;
      const b=document.createElement('button');b.className='ghost';b.textContent='Düzenle';b.type='button';b.onclick=()=>window.editBankMove(move.id);buttons.insertBefore(b,buttons.firstChild);row.dataset.hisEditAdded='1';
    });
  }
  const observer=new MutationObserver(()=>{clearTimeout(window.__hisBankDecorateTimer);window.__hisBankDecorateTimer=setTimeout(decorateBankRows,30);});
  observer.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('click',()=>setTimeout(decorateBankRows,50));
})();

/* Kasa hareketleri: kasa kaynaklı kayıtlar yalnızca kasa modülünden düzenlenir. */
(function(){
  'use strict';
  async function getCashMove(id){
    const rows=await api('kasa_hareketleri?id=eq.'+encodeURIComponent(id)+'&select=*');
    return rows?.[0]||null;
  }
  function cashMoveForm(x){
    return `<div class="form">
      <div><label>Tarih *</label><input id="kmDate" type="date" value="${esc(x?.tarih||today())}"></div>
      <div><label>Tip *</label><select id="kmTip"><option value="giris" ${String(x?.tip).toLowerCase()==='giris'?'selected':''}>Giriş</option><option value="cikis" ${String(x?.tip).toLowerCase()!=='giris'?'selected':''}>Çıkış</option></select></div>
      <div><label>Tutar *</label><input id="kmAmount" type="number" step="0.01" min="0" value="${Number(x?.tutar||0)}"></div>
      <div><label>Belge No</label><input id="kmDoc" value="${esc(x?.belge_no||'')}"></div>
      <div><label>Kategori</label><input id="kmCat" value="${esc(x?.kategori||'')}"></div>
      <div><label>Ödeme Yöntemi</label><input id="kmPay" value="${esc(x?.odeme_yontemi||'')}"></div>
      <div><label>Cari</label><select id="kmCari"><option value="">Cari yok</option>${cariOptions(x?.cari_id||'')}</select></div>
      <div class="full"><label>Açıklama</label><textarea id="kmDesc">${esc(x?.aciklama||'')}</textarea></div>
      <div class="full muted">Bu hareket kasa kaynaklıdır. Cari bağlantısı varsa kaydedildiğinde cari yansıması da aynı işlem üzerinden güncellenir.</div>
    </div>`;
  }
  window.editCashMove=async function(id){
    const x=await getCashMove(id);
    if(!x)return toast('Kasa hareketi bulunamadı.',true);
    modal('Kasa Hareketi Düzenle',cashMoveForm(x),async()=>{
      const tarih=$('kmDate').value,tip=$('kmTip').value,tutar=Number($('kmAmount').value),belge_no=$('kmDoc').value.trim(),kategori=$('kmCat').value.trim(),odeme_yontemi=$('kmPay').value.trim(),cari_id=$('kmCari').value||null,aciklama=$('kmDesc').value.trim();
      if(!tutar||tutar<0)throw Error('Tutar 0’dan büyük olmalıdır.');
      await api('kasa_hareketleri?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({tarih,tip,tutar,belge_no,kategori,odeme_yontemi,cari_id,aciklama})});
      closeModal();await load();toast('Kasa hareketi güncellendi. Cari yansıması da güncellendi.');
    },'Güncelle');
  };
  function findCashIdFromModal(){
    const body=document.getElementById('modalBody');if(!body)return null;
    const text=String(body.textContent||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR');
    const cash=(typeof S!=='undefined'&&Array.isArray(S.cash))?S.cash:[];
    const item=cash.find(k=>{const n=String(k.kasa_adi||'').trim().toLocaleLowerCase('tr-TR');return n&&text.includes(n);});
    return item?.id||null;
  }
  function decorateCashRows(){
    const title=document.getElementById('modalTitle');
    if(!title||String(title.textContent||'').trim().toLocaleLowerCase('tr-TR')!=='kasa hareketleri')return;
    const body=document.getElementById('modalBody');if(!body)return;
    const table=body.querySelector('table');if(!table)return;
    const rows=[...table.querySelectorAll('tbody tr')].filter(r=>r.querySelectorAll('td').length>=5);if(!rows.length)return;
    const cashId=findCashIdFromModal();
    const all=(typeof S!=='undefined'&&Array.isArray(S.cashMoves))?S.cashMoves:[];
    const moves=all.filter(x=>!cashId||x.kasa_id===cashId).slice().sort((a,b)=>{const d1=String(a.tarih||''),d2=String(b.tarih||'');if(d1!==d2)return d2.localeCompare(d1);return String(b.created_at||'').localeCompare(String(a.created_at||''));});
    rows.forEach((row,i)=>{
      if(row.dataset.hisCashEditAdded==='1')return;
      const cells=row.querySelectorAll('td'),buttons=cells[cells.length-1];if(!buttons)return;
      const dateText=String(cells[0]?.textContent||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR');
      const descText=String(cells[2]?.textContent||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR');
      const amountText=String(cells[4]?.textContent||'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
      let move=moves.find(x=>String(dt(x.tarih)).toLocaleLowerCase('tr-TR')===dateText&&String(x.aciklama||x.belge_no||'-').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR')===descText&&Math.abs(Number(x.tutar||0)-Number(amountText||0))<0.005);
      if(!move)move=moves[i];if(!move)return;
      const b=document.createElement('button');b.className='ghost';b.textContent='Düzenle';b.type='button';b.onclick=()=>window.editCashMove(move.id);buttons.insertBefore(b,buttons.firstChild);row.dataset.hisCashEditAdded='1';
    });
  }
  const observer=new MutationObserver(()=>{clearTimeout(window.__hisCashDecorateTimer);window.__hisCashDecorateTimer=setTimeout(decorateCashRows,30);});
  observer.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('click',()=>setTimeout(decorateCashRows,50));
})();