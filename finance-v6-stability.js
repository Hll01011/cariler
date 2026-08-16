/* HİS Finans V6 — SON UI/AKSİYON KATMANI
   Amaç: Düzenle/İptal butonlarını deterministik üretmek ve aynı işlemi birden fazla
   JS katmanının farklı şekilde yönetmesini engellemek.
   Supabase şeması/verisi değiştirilmez. Finans yazma işlemleri mevcut RPC motorundan geçer.
*/
(function(){'use strict';
  const norm=v=>String(v??'').trim().toLocaleLowerCase('tr-TR');
  const src=x=>norm(x?.kaynak_turu);
  const op=x=>x?.islem_id||x?.kaynak_id||null;
  const manual=s=>!s||s==='manual'||s==='manuel'||s==='manuel_cari'||s==='manuel_banka'||s==='manuel_kasa';
  const esc6=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const badge6=x=>{const s=src(x);if(s==='manuel_banka')return '<span class="goodPill">MANUEL BANKA</span>';if(s==='manuel_kasa')return '<span class="goodPill">MANUEL KASA</span>';if(s==='manuel_cari'||s==='manual'||s==='manuel'||!s)return '<span class="pill">MANUEL</span>';if(s.includes('tahsil'))return '<span class="goodPill">TAHSİLAT</span>';if(s.includes('fatura'))return '<span class="pill">FATURA</span>';if(s.includes('transfer'))return '<span class="pill">TRANSFER</span>';if(s.includes('cek')||s.includes('senet'))return '<span class="pill">ÇEK / SENET</span>';return '<span class="pill">'+esc6(x?.kaynak_turu||'KAYNAK')+'</span>';};
  function action6(x,kind){
    const id=op(x);if(!id)return '<span class="muted">—</span>';
    if(manual(src(x))){
      return `<div class="actions"><button type="button" class="ghost" onclick="hisV6Edit('${kind}','${x.id}')">Düzenle</button><button type="button" class="dangerBtn" onclick="hisV6Cancel('${x.id}')">İptal</button></div>`;
    }
    return `<button type="button" class="ghost" onclick="hisV6Open('${esc6(src(x))}','${esc6(id)}')">🔗 Ana işlemi aç</button>`;
  }
  window.hisV6Cancel=async function(id){if(!id)return;if(!confirm('Ana finans işlemi iptal edilsin mi? Cari, banka ve kasa yansımaları birlikte geri alınır.'))return;try{await mutate(()=>api('rpc/finans_islem_iptal',{method:'POST',body:JSON.stringify({p_islem:id,p_neden:'Kullanıcı tarafından iptal edildi'})}),'Ana işlem iptal edildi');closeModal()}catch(e){toast(e.message||'İptal işlemi başarısız',true)}};
  window.hisV6Edit=function(kind,id){const arr=kind==='cari'?S.cariMoves:kind==='bank'?S.bankMoves:S.cashMoves;const x=arr.find(z=>z.id===id);if(!x)return toast('Finans hareketi bulunamadı. Yeniden yükleyin.',true);if(kind==='cari')return editManualCari(x);if(kind==='bank')return editManualBank(x);return editManualCash(x)};
  window.hisV6Open=function(s,id){if(s.includes('manuel')){if(s.includes('banka'))return hisV6Edit('bank',id);if(s.includes('kasa'))return hisV6Edit('cash',id);return hisV6Edit('cari',id);}if(s.includes('tahsil'))return nav('tahsilatlar');if(s.includes('fatura'))return nav('faturalar');if(s.includes('transfer'))return nav('bankalar');if(s.includes('cek')||s.includes('senet'))return nav('cekler');return nav('cariler')};
  function renderRows(kind,id){
    const arr=kind==='cari'?S.cariMoves:kind==='bank'?S.bankMoves:S.cashMoves;
    const rows=kind==='cari'?arr.filter(x=>x.cari_id===id):kind==='bank'?arr.filter(x=>x.banka_hesap_id===id):arr.filter(x=>x.kasa_id===id);
    const acct=kind==='cari'?S.cariler.find(x=>x.id===id):kind==='bank'?S.banks.find(x=>x.id===id):S.cash.find(x=>x.id===id);
    const title=kind==='cari'?'Cari Detay':kind==='bank'?'Banka Hareketleri':'Kasa Hareketleri';
    const name=kind==='cari'?acct?.unvan:kind==='bank'?((acct?.banka_adi||'')+(acct?.hesap_adi?' — '+acct.hesap_adi:'')):acct?.kasa_adi;
    const bal=kind==='cari'?cariBal(id):kind==='bank'?bankBal(id):cashBal(id);
    const head=kind==='cari'?`<div class="detail"><div><small>Cari</small><strong>${esc6(name)}</strong></div><div><small>Bakiye</small><strong>${money(bal)}</strong></div></div>`:`<div class="detail"><div><small>${kind==='bank'?'Banka Hesabı':'Kasa'}</small><strong>${esc6(name)}</strong></div><div><small>Mevcut Bakiye</small><strong>${money(bal)}</strong></div></div>`;
    const add=kind==='cari'?`<button class="success" type="button" onclick="closeModal();newCariMove()">+ Hareket</button>`:`<button class="primary" type="button" onclick="closeModal();${kind==='bank'?`newBankMove('${id}')`:`newCashMove('${id}')`}">+ ${kind==='bank'?'Banka':'Kasa'} Hareketi</button>`;
    const body=rows.map(x=>`<tr><td>${dt(x.tarih)}</td><td>${esc6(x.aciklama||x.belge_no||'-')}</td><td>${badge6(x)}</td><td>${kind==='cari'?(x.tip==='borc'?'<span class="dangerText">Borç</span>':'<span class="successText">Alacak</span>'):(x.tip==='giris'?'<span class="goodPill">GİRİŞ</span>':'<span class="dangerPill">ÇIKIŞ</span>')}</td><td class="num">${money(x.tutar)}</td><td>${action6(x,kind)}</td></tr>`).join('')||`<tr><td colspan="6" class="empty">Hareket yok.</td></tr>`;
    modal(title,`${head}<div class="actions" style="margin-bottom:15px">${add}</div><div class="tableWrap"><table style="min-width:800px"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Kaynak</th><th>${kind==='cari'?'Yön':'Tip'}</th><th class="num">Tutar</th><th>İşlem</th></tr></thead><tbody>${body}</tbody></table></div>`,closeModal,'Kapat');
  }
  window.cariDetail=id=>renderRows('cari',id);
  window.bankDetail=id=>renderRows('bank',id);
  window.cashDetail=id=>renderRows('cash',id);
  // V5'nin kaynak açma fonksiyonunu da aynı deterministik mantığa çek.
  window.v5OpenSource=window.hisV6Open;
  // Eski DOM dekoratörleri buton eklemeye çalışsa bile V6'nin render ettiği tabloyu değiştirmesin.
  window.__HIS_V6_READY=true;
})();