/* HİS Finans — Banka/Kasa transfer ve işlem bütünlüğü koruması */
(function(){'use strict';
  function transferOpts(type,currentId){
    if(type==='kasa') return (S.cash||[]).filter(x=>String(x.id)!==String(currentId)).map(x=>`<option value="${x.id}">${esc(x.kasa_adi||'Kasa')}</option>`).join('');
    return (S.banks||[]).filter(x=>String(x.id)!==String(currentId)).map(x=>`<option value="${x.id}">${esc((x.banka_adi||'')+(x.hesap_adi?' — '+x.hesap_adi:''))}</option>`).join('');
  }
  function syncBankTarget(){
    const mode=$('bmTargetType')?.value, box=$('bmTargetBox');
    if(!box)return;
    if(mode==='yok'){box.innerHTML='';box.style.display='none';return;}
    box.style.display='';
    box.innerHTML=`<label>Karşı Hesap *</label><select id="bmTarget">${transferOpts(mode,$('bmba')?.value)}</select>`;
  }
  function syncCashTarget(){
    const mode=$('kmTargetType')?.value, box=$('kmTargetBox');
    if(!box)return;
    if(mode==='yok'){box.innerHTML='';box.style.display='none';return;}
    box.style.display='';
    box.innerHTML=`<label>Karşı Hesap *</label><select id="kmTarget">${transferOpts(mode,$('kmk')?.value)}</select>`;
  }
  window.newBankMove=function(bankId){
    modal('Yeni Banka Hareketi',`<div class="form">
      <div><label>Banka</label><select id="bmba" onchange="syncBankTarget()">${bankOptions(bankId)}</select></div>
      <div><label>Tip</label><select id="bmt"><option value="giris">Giriş</option><option value="cikis" selected>Çıkış</option></select></div>
      <div><label>İşlem Türü</label><select id="bmTargetType" onchange="syncBankTarget()"><option value="yok">Normal Banka Hareketi</option><option value="kasa">Kasa Transferi</option><option value="banka">Banka Transferi</option></select></div>
      <div id="bmTargetBox" style="display:none"></div>
      <div><label>Tarih</label><input id="bmd" type="date" value="${today()}"></div>
      <div><label>Tutar *</label><input id="bmu" type="number" step="0.01" min="0"></div>
      <div id="bmCariBox"><label>Cari (opsiyonel)</label><select id="bmc"><option value="">Cari yok</option>${cariOptions()}</select></div>
      <div><label>Belge No</label><input id="bmb"></div>
      <div><label>Kategori</label><input id="bmk"></div>
      <div class="full"><label>Açıklama</label><textarea id="bma"></textarea></div>
      <div class="full muted">Karşı hesap seçilirse işlem cari kullanmadan <b>tek transfer</b> olarak kaydedilir: kaynakta çıkış, hedefte giriş.</div>
    </div>`,async()=>{
      const a=Number($('bmu').value||0), mode=$('bmTargetType').value, date=$('bmd').value, desc=$('bma').value.trim()||null, source=$('bmba').value;
      if(!a)throw Error('Tutar 0’dan büyük olmalıdır.');
      if(mode!=='yok'){
        if(!['kasa','banka'].includes(mode))throw Error('Geçersiz karşı hesap.');
        const target=$('bmTarget')?.value;if(!target)throw Error('Karşı hesap seçin.');
        if($('bmt').value!=='cikis')throw Error('Banka transferinde kaynak banka hareketi Çıkış olmalıdır.');
        if(a>bankBal(source)+0.005)throw Error('Yetersiz banka bakiyesi. Transfer hesabı eksiye düşüremez.');
        await api('rpc/finans_transferi_olustur',{method:'POST',body:JSON.stringify({p_tarih:date,p_tutar:a,p_kaynak_turu:'banka',p_kaynak_id:source,p_hedef_turu:mode,p_hedef_id:target,p_aciklama:desc||'Banka transferi'})});
        closeModal();await load();toast(mode==='kasa'?'Bankadan kasaya transfer yapıldı.':'Bankadan bankaya transfer yapıldı.');return;
      }
      if($('bmt').value==='cikis' && a>bankBal(source)+0.005)throw Error('Yetersiz banka bakiyesi. Bu çıkış işlemi hesabı eksiye düşüremez.');
      await mutate(()=>api('banka_hareketleri',{method:'POST',body:JSON.stringify({banka_hesap_id:source,cari_id:$('bmc').value||null,tarih:date,tip:$('bmt').value,tutar:a,belge_no:$('bmb').value.trim()||null,kategori:$('bmk').value.trim()||null,odeme_yontemi:'Bankadan',aciklama:desc})}),'Banka hareketi kaydedildi');closeModal();
    },'Kaydet');
  };
  window.newCashMove=function(cashId){
    modal('Yeni Kasa Hareketi',`<div class="form">
      <div><label>Kasa</label><select id="kmk" onchange="syncCashTarget()">${cashOptions(cashId)}</select></div>
      <div><label>Tip</label><select id="kmt"><option value="giris">Giriş</option><option value="cikis" selected>Çıkış</option></select></div>
      <div><label>İşlem Türü</label><select id="kmTargetType" onchange="syncCashTarget()"><option value="yok">Normal Kasa Hareketi</option><option value="banka">Banka Transferi</option><option value="kasa">Kasa Transferi</option></select></div>
      <div id="kmTargetBox" style="display:none"></div>
      <div><label>Tarih</label><input id="kmd" type="date" value="${today()}"></div>
      <div><label>Tutar *</label><input id="kmu" type="number" step="0.01" min="0"></div>
      <div><label>Cari</label><select id="kmc"><option value="">Cari yok</option>${cariOptions()}</select></div>
      <div><label>Belge No</label><input id="kmb"></div>
      <div><label>Kategori</label><input id="kmkat"></div>
      <div class="full"><label>Açıklama</label><textarea id="kma"></textarea></div>
      <div class="full muted">Karşı hesap seçilirse işlem cari kullanmadan <b>tek transfer</b> olarak kaydedilir.</div>
    </div>`,async()=>{
      const a=Number($('kmu').value||0), mode=$('kmTargetType').value, date=$('kmd').value, desc=$('kma').value.trim()||null, source=$('kmk').value;
      if(!a)throw Error('Tutar 0’dan büyük olmalıdır.');
      if(mode!=='yok'){
        const target=$('kmTarget')?.value;if(!target)throw Error('Karşı hesap seçin.');
        if($('kmt').value!=='cikis')throw Error('Kasa transferinde kaynak kasa hareketi Çıkış olmalıdır.');
        if(a>cashBal(source)+0.005)throw Error('Yetersiz kasa bakiyesi. Transfer kasayı eksiye düşüremez.');
        await api('rpc/finans_transferi_olustur',{method:'POST',body:JSON.stringify({p_tarih:date,p_tutar:a,p_kaynak_turu:'kasa',p_kaynak_id:source,p_hedef_turu:mode,p_hedef_id:target,p_aciklama:desc||'Kasa transferi'})});
        closeModal();await load();toast(mode==='banka'?'Kasadan bankaya transfer yapıldı.':'Kasadan kasaya transfer yapıldı.');return;
      }
      if($('kmt').value==='cikis' && a>cashBal(source)+0.005)throw Error('Yetersiz kasa bakiyesi. Bu çıkış işlemi kasayı eksiye düşüremez.');
      await mutate(()=>api('kasa_hareketleri',{method:'POST',body:JSON.stringify({kasa_id:source,cari_id:$('kmc').value||null,tarih:date,tip:$('kmt').value,tutar:a,belge_no:$('kmb').value.trim()||null,kategori:$('kmkat').value.trim()||null,odeme_yontemi:'Nakit',aciklama:desc})}),'Kasa hareketi kaydedildi');closeModal();
    },'Kaydet');
  };
  window.syncBankTarget=syncBankTarget;
  window.syncCashTarget=syncCashTarget;

  // Tahsilat: tek para kaynağı, fatura kalanını aşmama, yöntem ile hesap eşleşmesi.
  function guardPaymentSave(editId){
    const a=Number($('pu')?.value||0), method=String($('po')?.value||''), bank=$('pbank')?.value||'', cash=$('pcash')?.value||'', invoice=$('pf')?.value||'';
    if(a<=0)throw Error('Tutar 0’dan büyük olmalıdır.');
    if(method==='Bankadan'&&!bank)throw Error('Bankadan tahsilatta banka hesabı seçmelisiniz.');
    if((method==='Kasadan'||method==='Nakit')&&!cash)throw Error('Kasa/Nakit tahsilatta kasa seçmelisiniz.');
    if(bank&&cash)throw Error('Bir tahsilatta banka ve kasa birlikte kullanılamaz.');
    if(invoice){
      const inv=(S.invoices||[]).find(x=>x.id===invoice);
      if(inv){
        const paid=(S.payments||[]).filter(p=>p.fatura_id===invoice&&p.id!==editId).reduce((s,p)=>s+Number(p.tutar||0),0);
        const remaining=Math.max(0,Number(inv.geneltoplam||0)-paid);
        if(a>remaining+0.005)throw Error('Tahsilat tutarı faturanın kalan tutarını aşamaz.');
      }
    }
  }
  function bindModalGuard(fn){
    setTimeout(()=>{
      const b=$('modalSave');if(!b||b.__hisFinanceGuard)return;
      const original=b.onclick;if(typeof original!=='function')return;
      b.__hisFinanceGuard=true;
      b.onclick=async function(ev){try{fn()}catch(e){toast(e.message||'İşlem engellendi',true);return}return original.call(this,ev)};
    },0);
  }
  const originalNewPayment=window.newPayment;
  if(typeof originalNewPayment==='function')window.newPayment=function(){originalNewPayment.apply(this,arguments);bindModalGuard(()=>guardPaymentSave());};
  const originalEditPayment=window.editPayment;
  if(typeof originalEditPayment==='function')window.editPayment=function(id){originalEditPayment.apply(this,arguments);bindModalGuard(()=>guardPaymentSave(id));};

  // Manuel cari hareketi banka/kasa hareketi gibi gösterme: ana para modülü kullanılmalı.
  const originalCariMove=window.newCariMove;
  if(typeof originalCariMove==='function')window.newCariMove=function(){originalCariMove.apply(this,arguments);bindModalGuard(()=>{
    if(String($('cmo')?.value||'').trim())throw Error('Bu ekran yalnızca cari bakiyeyi değiştirir. Banka/kasa hareketi için Tahsilat veya ilgili ana işlem ekranını kullanın.');
    if(Number($('cmu')?.value||0)<=0)throw Error('Tutar 0’dan büyük olmalıdır.');
  });};
})();
