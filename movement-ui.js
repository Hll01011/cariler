/* HYS_MOVEMENT_UI_V2 */
(function(){
  "use strict";
  function esc2(v){return String(v??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
  function money2(v){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(Number(v||0))}
  function fmtDate2(v){return v?new Date(v+"T00:00:00").toLocaleDateString("tr-TR"):"—"}
  function active(id){return !!(state?.data?.islemler||[]).find(x=>x.id===id&&x.durum==="aktif")}
  function cariName(id){return (state?.data?.cariler||[]).find(c=>c.id===id)?.unvan||"—"}

  cariTable=function(rows,compact=false){
    rows=Array.isArray(rows)?rows:[];
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Tarih</th><th>Cari</th><th>Yön</th><th>Belge</th><th>Kaynak</th><th class="num">Tutar</th>${compact?"":"<th>İşlem</th>"}</tr></thead><tbody>${rows.map(x=>{
      const act=active(x.islem_id);
      const action=compact?"":(act?`<div class="row-actions"><button class="icon-btn" onclick="editTransaction('${esc2(x.islem_id||"")}')">Düzenle</button><button class="icon-btn danger" onclick="voidTransaction('${esc2(x.islem_id||"")}','cari_hareket')">İptal</button></div>`:`<span class="mini">İptal</span>`);
      return `<tr><td>${fmtDate2(x.tarih)}</td><td><b>${esc2(cariName(x.cari_id))}</b><br><small>${esc2(x.aciklama||"")}</small></td><td>${x.tip==="borc"?'<span class="pill bad">BORÇ</span>':'<span class="pill good">ALACAK</span>'}</td><td>${esc2(x.belge_no||"—")}</td><td>${esc2(x.kaynak_turu||"manuel")}</td><td class="num">${money2(x.tutar)}</td>${compact?"":`<td>${action}</td>`}</tr>`;
    }).join("")||`<tr><td colspan="${compact?6:7}" class="empty">Kayıt bulunamadı.</td></tr>`}</tbody></table></div>`;
  };

  bankMoveTable=function(rows){
    rows=Array.isArray(rows)?rows:[];
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Tarih</th><th>Cari</th><th>Tip</th><th>Belge</th><th>Açıklama</th><th class="num">Tutar</th><th>İşlem</th></tr></thead><tbody>${rows.map(x=>{
      const act=active(x.islem_id);
      return `<tr><td>${fmtDate2(x.tarih)}</td><td>${esc2(cariName(x.cari_id))}</td><td>${x.tip==="giris"?'<span class="pill good">GİRİŞ</span>':'<span class="pill bad">ÇIKIŞ</span>'}</td><td>${esc2(x.belge_no||"—")}</td><td>${esc2(x.aciklama||"—")}</td><td class="num">${money2(x.tutar)}</td><td>${act?`<div class="row-actions"><button class="icon-btn" onclick="editTransaction('${esc2(x.islem_id||"")}')">Düzenle</button><button class="icon-btn danger" onclick="voidTransaction('${esc2(x.islem_id||"")}','manuel_banka')">İptal</button></div>`:`<span class="mini">—</span>`}</td></tr>`;
    }).join("")||`<tr><td colspan="7" class="empty">Hareket yok.</td></tr>`}</tbody></table></div>`;
  };

  cashMoveTable=function(rows){
    rows=Array.isArray(rows)?rows:[];
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Tarih</th><th>Cari</th><th>Tip</th><th>Belge</th><th>Açıklama</th><th class="num">Tutar</th><th>İşlem</th></tr></thead><tbody>${rows.map(x=>{
      const act=active(x.islem_id);
      return `<tr><td>${fmtDate2(x.tarih)}</td><td>${esc2(cariName(x.cari_id))}</td><td>${x.tip==="giris"?'<span class="pill good">GİRİŞ</span>':'<span class="pill bad">ÇIKIŞ</span>'}</td><td>${esc2(x.belge_no||"—")}</td><td>${esc2(x.aciklama||"—")}</td><td class="num">${money2(x.tutar)}</td><td>${act?`<div class="row-actions"><button class="icon-btn" onclick="editTransaction('${esc2(x.islem_id||"")}')">Düzenle</button><button class="icon-btn danger" onclick="voidTransaction('${esc2(x.islem_id||"")}','manuel_kasa')">İptal</button></div>`:`<span class="mini">—</span>`}</td></tr>`;
    }).join("")||`<tr><td colspan="7" class="empty">Hareket yok.</td></tr>`}</tbody></table></div>`;
  };

  window.cariDetail=function(id){
    const c=state.data.cariler.find(x=>x.id===id), rows=state.data.cariMoves.filter(x=>x.cari_id===id);
    openModal("Cari Detay",`<div class="grid2"><div class="card" style="margin:0"><span class="mini">Cari</span><div class="stat-big">${esc2(c?.unvan||"")}</div><p class="muted">${esc2(c?.vergi_no||"Vergi/T.C. yok")} • ${esc2(c?.telefon||"Telefon yok")}</p></div><div class="card" style="margin:0"><span class="mini">Güncel Bakiye</span><div class="stat-big ${balanceCari(id)>0?"danger-text":balanceCari(id)<0?"success-text":""}">${money2(Math.abs(balanceCari(id)))}</div><p class="muted">${balanceCari(id)>0?"Borçlu":balanceCari(id)<0?"Alacaklı":"Kapalı"}</p></div></div><div class="actions" style="margin:15px 0"><button class="btn primary" onclick="closeModal();newCariMoveFor('${esc2(id)}')">+ Cari Hareketi Ekle</button><button class="btn soft" onclick="closeModal();editCari('${esc2(id)}')">Cariyi Düzenle</button></div><div class="notice">Kural: Cari hareketi banka veya kasa ile bağlıysa düzenleme aynı ana işlem üzerinden yapılır; cari, banka/kasa ve tutar birlikte güncellenir. İptal de bağlı yansımayı birlikte iptal eder.</div><div style="margin-top:15px">${cariTable(rows,false)}</div>`,closeModal,"Kapat");
  };

  try{ if(typeof render==="function") render(); }catch(e){}
})();
