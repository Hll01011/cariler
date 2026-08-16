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
    const c=state.data.cariler.find(x=>x.id===id), rows=state.data.cariMoves.filter(x=>x.cari_id===id), bal=balanceCari(id);
    openModal("Cari Detay",`<div class="grid2"><div class="card" style="margin:0"><span class="mini">Cari</span><div class="stat-big">${esc2(c?.unvan||"")}</div><p class="muted">${esc2(c?.vergi_no||"Vergi/T.C. yok")} • ${esc2(c?.telefon||"Telefon yok")}</p></div><div class="card" style="margin:0"><span class="mini">Güncel Bakiye</span><div class="stat-big ${bal>0?"danger-text":bal<0?"success-text":""}">${money2(Math.abs(bal))}</div><p class="muted">${bal>0?"Borçlu":bal<0?"Alacaklı":"Kapalı"}</p></div></div><div class="actions" style="margin:15px 0"><button class="btn primary" onclick="closeModal();newCariMoveFor('${esc2(id)}')">+ Cari Hareketi Ekle</button><button class="btn success" onclick="closeModal();newSettlementForCari('${esc2(id)}','tahsilat')">+ Tahsilat</button><button class="btn soft" onclick="closeModal();newSettlementForCari('${esc2(id)}','odeme')">+ Ödeme</button><button class="btn soft" onclick="closeModal();editCari('${esc2(id)}')">Cariyi Düzenle</button></div><div class="notice">Cari hareketinde banka/kasa seçilmemişse <b>para hareketi oluşmaz</b>; bu yalnızca cari borç/alacak kaydıdır. Para gerçekten çıktığında veya girdiğinde ayrıca Tahsilat/Ödeme işlemiyle hangi banka veya kasadan olduğunu bağlarız.</div><div style="margin-top:15px">${cariTable(rows,false)}</div>`,closeModal,"Kapat");
  };

  try{ if(typeof render==="function") render(); }catch(e){}
})();

/* HYS_FINANCE_FLOW_FIXES_V1 */
(function(){
  "use strict";
  const oldFaturalar=window.faturalar;
  const oldDisplayPayments=window.displayPayments;
  function settlementModal(cariId,kind,invoiceId=null){
    const inv=invoiceId?state.data.invoices.find(x=>x.id===invoiceId):null;
    const isPay=kind==="odeme",title=inv?(isPay?"Faturayı Öde":"Faturayı Tahsil Et"):(isPay?"Yeni Ödeme":"Yeni Tahsilat"),max=inv?num(inv.kalan_tutar):0;
    openModal(title,`<div class="notice">${inv?`<b>${esc(inv.fatura_no||"Fatura")}</b> — ${money(max)} kalan.`:(isPay?"Bu ödeme cari bakiyesini azaltır ve seçilen banka/kasadan para çıkışı oluşturur.":"Bu tahsilat cari bakiyesini azaltır ve seçilen banka/kasaya para girişi oluşturur.")}</div><div class="form"><div class="field"><label>Cari *</label><select id="sf_cari" class="select">${cariOptions(cariId||inv?.cari_id||"")}</select></div>${inv?`<div class="field"><label>Fatura</label><input class="input" value="${esc(inv.fatura_no||"")} — ${money(max)}" readonly></div>`:""}<div class="field"><label>Tarih</label><input id="sf_date" class="input" type="date" value="${dateNow()}"></div><div class="field"><label>Tutar *</label><input id="sf_amt" class="input" type="number" min="0.01" step="0.01" value="${max?max:""}"></div><div class="field"><label>Yöntem</label><select id="sf_method" class="select"><option value="Bankadan">Bankadan</option><option value="Nakit">Nakit</option></select></div><div class="field"><label>Banka</label><select id="sf_bank" class="select"><option value="">Yok</option>${bankOptions()}</select></div><div class="field"><label>Kasa</label><select id="sf_cash" class="select"><option value="">Yok</option>${cashOptions()}</select></div><div class="field"><label>Belge No</label><input id="sf_doc" class="input"></div><div class="field full"><label>Açıklama</label><textarea id="sf_desc" class="textarea">${esc(inv?(isPay?"Fatura ödemesi":"Fatura tahsilatı"):"")}</textarea></div></div>`,async()=>{
      const cari=$("sf_cari").value,bank=$("sf_bank").value||null,cash=$("sf_cash").value||null,method=$("sf_method").value,amount=num($("sf_amt").value);
      if(bank&&cash)throw Error("Banka veya kasa seçin; ikisini birlikte kullanmayın.");
      if(method==="Bankadan"&&!bank)throw Error(isPay?"Bankadan ödeme için banka seçin.":"Bankadan tahsilat için banka seçin.");
      if(method==="Nakit"&&!cash)throw Error(isPay?"Nakit ödeme için kasa seçin.":"Nakit tahsilat için kasa seçin.");
      if(amount<=0)throw Error("Tutar 0'dan büyük olmalıdır.");
      if(inv&&amount>num(inv.kalan_tutar))throw Error("Tutar fatura kalanından büyük olamaz.");
      const id=await rpc(isPay?"finans_odeme_ekle":"finans_tahsilat_ekle",{p_cari:cari,p_fatura:invoiceId||null,p_tarih:$("sf_date").value,p_tutar:amount,p_yontem:method,p_banka:bank,p_kasa:cash,p_belge:$("sf_doc").value.trim()||null,p_aciklama:$("sf_desc").value.trim()||null});
      closeModal();await load();toast((isPay?"Ödeme":"Tahsilat")+" kaydedildi. İşlem #"+await islemNo(id));
    });
    const sync=()=>{const m=$("sf_method").value,b=$("sf_bank"),k=$("sf_cash");b.disabled=m!=="Bankadan";k.disabled=m!=="Nakit";if(m!=="Bankadan")b.value="";if(m!=="Nakit")k.value=""};$("sf_method").onchange=sync;sync();
  }
  window.newSettlementForInvoice=function(id){const inv=state.data.invoices.find(x=>x.id===id);if(!inv||num(inv.kalan_tutar)<=0)return toast("Bu fatura zaten kapalı.",true);settlementModal(inv.cari_id,inv.fatura_turu==="alis"?"odeme":"tahsilat",id)};
  window.newSettlementForCari=function(id,kind){settlementModal(id,kind,null)};
  window.newPayment=function(){
    if(!state.data.cariler.length)return toast("Önce cari oluşturun.",true);
    const sales=state.data.invoices.filter(x=>x.fatura_turu==="satis"&&num(x.kalan_tutar)>0);
    openModal("Yeni Tahsilat",`<div class="notice">Tahsilat yalnızca <b>satış faturalarından</b> yapılır. Ödeme ise alış faturasında fatura satırındaki <b>Öde</b> düğmesinden yapılır.</div><div class="form"><div class="field"><label>Cari *</label><select id="pc" class="select">${cariOptions()}</select></div><div class="field"><label>Fatura</label><select id="pf" class="select"><option value="">Fatura seçilmedi</option>${sales.map(x=>`<option value="${x.id}">${esc(x.fatura_no||"—")} — ${money(x.kalan_tutar)}</option>`).join("")}</select></div><div class="field"><label>Tarih</label><input id="pd" class="input" type="date" value="${dateNow()}"></div><div class="field"><label>Tutar *</label><input id="pu" class="input" type="number" step="0.01"></div><div class="field"><label>Yöntem</label><select id="py" class="select"><option value="Bankadan">Bankadan</option><option value="Nakit">Nakit</option></select></div><div class="field"><label>Banka</label><select id="pbk" class="select"><option value="">Yok</option>${bankOptions()}</select></div><div class="field"><label>Kasa</label><select id="pks" class="select"><option value="">Yok</option>${cashOptions()}</select></div><div class="field"><label>Belge No</label><input id="pdoc" class="input"></div><div class="field full"><label>Açıklama</label><textarea id="pdesc" class="textarea"></textarea></div></div>`,async()=>{const bank=$("pbk").value||null,cash=$("pks").value||null;if(bank&&cash)throw Error("Banka veya kasa seçin; ikisini birlikte kullanmayın.");if($("py").value==="Bankadan"&&!bank)throw Error("Bankadan tahsilat için banka seçin.");if($("py").value==="Nakit"&&!cash)throw Error("Nakit tahsilat için kasa seçin.");const id=await rpc("finans_tahsilat_ekle",{p_cari:$("pc").value,p_fatura:$("pf").value||null,p_tarih:$("pd").value,p_tutar:num($("pu").value),p_yontem:$("py").value,p_banka:bank,p_kasa:cash,p_belge:$("pdoc").value.trim()||null,p_aciklama:$("pdesc").value.trim()||null});closeModal();await load();toast("Tahsilat kaydedildi. İşlem #"+await islemNo(id))});
  };
  window.displayPayments=function(){const base=oldDisplayPayments?oldDisplayPayments():state.data.payments.slice();return base.filter(x=>x.islem_yonu!=="odeme")};
  function injectInvoiceActions(){
    const grid=document.getElementById("fgrid");if(!grid)return;
    [...grid.querySelectorAll("tbody tr")].forEach(tr=>{
      if(tr.dataset.hysPay)return;
      const no=tr.cells?.[0]?.querySelector("b")?.textContent?.trim();if(!no)return;
      const inv=state.data.invoices.find(x=>String(x.fatura_no||"—").trim()===no);if(!inv||num(inv.kalan_tutar)<=0)return;
      const td=tr.lastElementChild;if(!td)return;
      const b=document.createElement("button");b.className="icon-btn";b.textContent=inv.fatura_turu==="alis"?"Öde":"Tahsil Et";b.onclick=()=>newSettlementForInvoice(inv.id);
      const actions=td.querySelector(".row-actions");if(actions)actions.appendChild(b);else td.appendChild(b);tr.dataset.hysPay="1";
    });
  }
  window.faturalar=function(){oldFaturalar();setTimeout(injectInvoiceActions,20);const grid=document.getElementById("fgrid");if(grid&&!grid.__hysObs){grid.__hysObs=new MutationObserver(()=>setTimeout(injectInvoiceActions,10));grid.__hysObs.observe(grid,{childList:true,subtree:true})}};
  try{if(typeof render==="function")render()}catch(e){}
})();
