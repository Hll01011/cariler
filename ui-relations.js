/* HİS Finans — Ana işlem / bağlı hareket UI V2
   Mevcut Supabase şemasını değiştirmez. Yeni tablo/kolon/RPC oluşturmaz.
   Mevcut api(), S.* ve transferPage() altyapısını kullanır. */
(function(){'use strict';
  const escx=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').toLocaleLowerCase('tr-TR').replace(/_/g,' ').trim();
  const manualType=v=>{const k=norm(v);return !k||k==='manuel'||k==='manual'||k.includes('manuel banka')||k.includes('manuel kasa')||k.includes('manuel cari')||k==='cari hareket'||k==='kasa hareketi'||k==='banka hareketi';};
  const isLinked=row=>!!row?.islem_id&&!manualType(row?.kaynak_turu);
  const label=v=>{v=norm(v||'manuel');if(v.includes('transfer'))return ['↔','Para Transferi','transfer'];if(v.includes('tahsil'))return ['₺','Tahsilat','tahsilat'];if(v.includes('fatura'))return ['▧','Fatura','fatura'];if(v.includes('cek')||v.includes('senet'))return ['◈','Çek / Senet','cek'];return ['•','Manuel','manual'];};
  const badge=v=>{const [i,t,c]=label(v);return `<span class="v4-source ${c}">${i} ${t}</span>`;};
  const id8=id=>escx(String(id||'').slice(0,8));

  function sourceBox(row){
    if(!isLinked(row)) return `<div class="v4-relation"><span class="v4-source manual">• Manuel ana işlem</span>${row?.islem_id?`<span class="v4-sourceid">#${id8(row.islem_id)}</span>`:''}</div>`;
    const [i,t]=label(row.kaynak_turu);
    return `<div class="v4-relation"><span>🔗</span>${badge(row.kaynak_turu)}<span class="v4-sourceid">#${id8(row.islem_id)}</span></div><button class="ghost v4-linkbtn" onclick='window.hisOpenSource(${JSON.stringify(row)})'>Ana işlemi gör →</button>`;
  }

  function sourceTarget(row){
    const k=norm(row?.kaynak_turu);
    if(k.includes('transfer')) return {page:'transferler',label:'Para Transferleri'};
    if(k.includes('tahsil')) return {page:'tahsilatlar',label:'Tahsilatlar'};
    if(k.includes('fatura')) return {page:'faturalar',label:'Faturalar'};
    if(k.includes('cek')||k.includes('senet')) return {page:'cekler',label:'Çek / Senet'};
    return null;
  }

  function openSource(row){
    if(!isLinked(row)){
      toast('Bu hareket bağımsız manuel ana işlemdir. Buradan doğrudan düzenlenebilir veya silinebilir.',false);
      return;
    }
    const [i,t]=label(row.kaynak_turu),target=sourceTarget(row);
    const go=target?`<button class="primary" onclick="closeModal();location.hash='${target.page}';${target.page==='transferler'?'window.transferPage?.();':''}">${target.label} sayfasına git →</button>`:'<button class="ghost" onclick="closeModal()">Kapat</button>';
    modal('Ana İşlem Bağlantısı',`<div class="v4-sourcebox"><div class="v4-source-title">${badge(row.kaynak_turu)} <strong>${escx(t)} #${id8(row.islem_id)}</strong></div><p class="v4-source-help">Bu finans hareketi <b>${escx(t)}</b> ana işleminden oluşturulmuştur. Değişiklik ve iptal işlemleri ana işlem üzerinden yapılır.</p><div class="v4-sourceid">Ana işlem ID: ${escx(String(row.islem_id))}</div>${go}</div>`,closeModal,'Kapat');
  }

  async function deleteManual(table,id,accountTable,accountField,accountId){
    const rowTable=table;
    if(!confirm('Bu manuel finans hareketini silmek istiyor musun? Bakiye bu hareket kadar değişecektir.'))return;
    try{
      await api(`${rowTable}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
      await load();
      toast('Manuel hareket silindi.');
      if(accountTable&&accountField&&accountId) window[accountTable==='kasa_hesaplari'?'cashDetail':accountTable==='banka_hesaplari'?'bankDetail':'cariDetail']?.(accountId);
    }catch(e){toast(prettyDbError(e,'Finans hareketi silinemedi.'),true);}
  }

  function prettyDbError(e,fallback){
    const m=String(e?.message||e||'');
    if(/foreign key|violates foreign key/i.test(m)) return 'Bu hesapta bağlı finans hareketleri bulunuyor. Önce hareketleri yönetin; hesap doğrudan silinemez.';
    if(/permission|rls|row level/i.test(m)) return 'Bu işlem için veritabanı yetkisi bulunmuyor.';
    return fallback+' '+m.replace(/\{.*?\}/g,'').slice(0,180);
  }

  function override(){
    window.deleteBankMove=async function(id){const x=S.bankMoves.find(r=>String(r.id)===String(id));if(!x)return toast('Banka hareketi bulunamadı.',true);if(isLinked(x))return openSource(x);await deleteManual('banka_hareketleri',id,'banka_hesaplari','banka_hesap_id',x.banka_hesap_id);};
    window.deleteCashMove=async function(id){const x=S.cashMoves.find(r=>String(r.id)===String(id));if(!x)return toast('Kasa hareketi bulunamadı.',true);if(isLinked(x))return openSource(x);await deleteManual('kasa_hareketleri',id,'kasa_hesaplari','kasa_id',x.kasa_id);};
    window.deleteCariMove=async function(id){const x=S.cariMoves.find(r=>String(r.id)===String(id));if(!x)return toast('Cari hareketi bulunamadı.',true);if(isLinked(x))return openSource(x);await deleteManual('cari_hareketleri',id,'cariler','id',x.cari_id);};

    window.bankDetail=function(id){const b=S.banks.find(x=>x.id===id),rows=S.bankMoves.filter(x=>x.banka_hesap_id===id);modal('Banka Hareketleri',`<div class="detail"><div><small>Hesap</small><strong>${escx(b?.banka_adi||'')}</strong></div><div><small>Bakiye</small><strong>${money(bankBal(id))}</strong></div></div><div class="tableWrap"><table class="v4-table"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Kaynak / Ana İşlem</th><th>Tip</th><th class="num">Tutar</th><th>İşlem</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${dt(x.tarih)}</td><td>${escx(x.aciklama||x.belge_no||'-')}</td><td>${sourceBox(x)}</td><td>${x.tip==='giris'?'<span class="goodPill">GİRİŞ</span>':'<span class="dangerPill">ÇIKIŞ</span>'}</td><td class="num">${money(x.tutar)}</td><td>${isLinked(x)?'<button class="v4-lock v4-lockbtn" onclick=\'window.hisOpenSource(${JSON.stringify(x)})\'>🔒 Bağlı</button>':`<div class="v4-actions"><button class="ghost" onclick="editBankMove('${x.id}')">Düzenle</button><button class="dangerBtn" onclick="deleteBankMove('${x.id}')">Sil</button></div>`}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Hareket yok.</td></tr>'}</tbody></table></div>`,closeModal,'Kapat');};

    window.cashDetail=function(id){const b=S.cash.find(x=>x.id===id),rows=S.cashMoves.filter(x=>x.kasa_id===id);modal('Kasa Hareketleri',`<div class="detail"><div><small>Kasa</small><strong>${escx(b?.kasa_adi||'')}</strong></div><div><small>Bakiye</small><strong>${money(cashBal(id))}</strong></div></div><div class="tableWrap"><table class="v4-table"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Kaynak / Ana İşlem</th><th>Tip</th><th class="num">Tutar</th><th>İşlem</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${dt(x.tarih)}</td><td>${escx(x.aciklama||x.belge_no||'-')}</td><td>${sourceBox(x)}</td><td>${x.tip==='giris'?'<span class="goodPill">GİRİŞ</span>':'<span class="dangerPill">ÇIKIŞ</span>'}</td><td class="num">${money(x.tutar)}</td><td>${isLinked(x)?'<button class="v4-lock v4-lockbtn" onclick=\'window.hisOpenSource(${JSON.stringify(x)})\'>🔒 Bağlı</button>':`<div class="v4-actions"><button class="ghost" onclick="editCashMove('${x.id}')">Düzenle</button><button class="dangerBtn" onclick="deleteCashMove('${x.id}')">Sil</button></div>`}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Hareket yok.</td></tr>'}</tbody></table></div>`,closeModal,'Kapat');};

    window.cariDetail=function(id){const c=S.cariler.find(x=>x.id===id),rows=S.cariMoves.filter(x=>x.cari_id===id);modal('Cari Detay',`<div class="detail"><div><small>Cari</small><strong>${escx(c?.unvan||'')}</strong></div><div><small>Bakiye</small><strong>${money(cariBal(id))}</strong></div></div><div class="tableWrap"><table class="v4-table"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Kaynak / Ana İşlem</th><th>Yön</th><th class="num">Tutar</th><th>İşlem</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${dt(x.tarih)}</td><td>${escx(x.aciklama||x.belge_no||'-')}</td><td>${sourceBox(x)}</td><td>${x.tip==='borc'?'Borç':'Alacak'}</td><td class="num">${money(x.tutar)}</td><td>${isLinked(x)?'<button class="v4-lock v4-lockbtn" onclick=\'window.hisOpenSource(${JSON.stringify(x)})\'>🔒 Bağlı</button>':`<div class="v4-actions"><button class="ghost" onclick="editCariMove('${x.id}')">Düzenle</button><button class="dangerBtn" onclick="deleteCariMove('${x.id}')">Sil</button></div>`}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Hareket yok.</td></tr>'}</tbody></table></div>`,closeModal,'Kapat');};

    window.deleteCash=async function(id){return deleteAccountSafe('kasa_hesaplari',id,'kasa_hareketleri','kasa_id','Kasa');};
    window.deleteBank=async function(id){return deleteAccountSafe('banka_hesaplari',id,'banka_hareketleri','banka_hesap_id','Banka hesabı');};
  }

  async function deleteAccountSafe(table,id,movesTable,field,labelText){
    if(!confirm(`${labelText} hesabını silmek istiyor musun?`))return;
    try{
      const rows=await api(`${movesTable}?${field}=eq.${encodeURIComponent(id)}&select=id`);
      if(rows?.length){toast(`🔒 ${labelText} silinemedi. Bu hesaba ait ${rows.length} finans hareketi var. Önce hareketleri silin veya hesabı pasif hale getirin.`,true);return;}
      await api(`${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
      await load();toast(`${labelText} silindi.`);
    }catch(e){toast(prettyDbError(e,`${labelText} silinemedi.`),true);}
  }

  function install(){
    const css=document.createElement('style');css.textContent='.v4-sourcebox{padding:15px;border:1px solid #dbe5ef;border-radius:14px;background:#f8fbff;margin-bottom:12px}.v4-source-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:16px}.v4-source-help{color:#64748b;line-height:1.55;margin:12px 0}.v4-relation{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.v4-sourceid{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#64748b}.v4-linkbtn{margin-top:6px;padding:6px 9px;font-size:11px}.v4-lockbtn{border:0;cursor:pointer}.v4-table thead th{position:sticky;top:0;background:#fff;z-index:1}.v4-table tbody tr:hover{background:#f5f8ff}.v4-actions{display:flex;gap:7px;flex-wrap:wrap}.v4-actions button{min-height:38px}';document.head.appendChild(css);window.hisOpenSource=openSource;override();new MutationObserver(override).observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();