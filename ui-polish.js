/* HİS Finans UI Polish
   Bu dosya SADECE ön yüz davranışlarını iyileştirir.
   Supabase, fetch, RPC, tablo verisi veya finans motoruna erişmez.
*/
(function(){
  'use strict';
  const moneyText=/₺|TL|TRY|tutar|bakiye|alacak|borç|giriş|çıkış/i;

  function addGlobalStyles(){
    if(document.getElementById('his-ui-polish-style')) return;
    const s=document.createElement('style'); s.id='his-ui-polish-style';
    s.textContent=`
      .his-list-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
      .his-list-search{flex:1;min-width:220px;padding:11px 13px;border:1px solid #d8e0eb;border-radius:11px;outline:none;background:#fff}
      .his-list-search:focus{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb14}
      .his-count{font-size:11px;color:#718096;background:#f1f5f9;padding:7px 10px;border-radius:99px;font-weight:800}
      .his-source{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:99px;background:#eef2ff;color:#3730a3;font-size:10px;font-weight:850;white-space:nowrap}
      .his-source.manual{background:#f1f5f9;color:#475569}.his-source.transfer{background:#e0f2fe;color:#0369a1}.his-source.payment{background:#dcfce7;color:#15803d}.his-source.invoice{background:#fef3c7;color:#92400e}.his-source.check{background:#f3e8ff;color:#7e22ce}
      .his-action-hint{font-size:11px;color:#64748b;margin-top:4px}
      .his-modal-note{padding:11px 13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;margin-bottom:13px;font-size:12px;color:#475569}
      .his-success{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:11px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;margin-bottom:12px;font-weight:750}
      @media(max-width:700px){.his-list-search{min-width:0;width:100%}.his-list-tools{align-items:stretch}.his-count{align-self:flex-start}.his-source{font-size:9px}}
    `;
    document.head.appendChild(s);
  }

  function normalizeSource(v){
    const x=String(v||'').toLocaleLowerCase('tr-TR');
    if(x.includes('transfer')) return ['transfer','🔗 Transfer'];
    if(x.includes('tahsil')) return ['payment','₺ Tahsilat'];
    if(x.includes('fatura')) return ['invoice','▧ Fatura'];
    if(x.includes('cek')||x.includes('senet')) return ['check','◈ Çek/Senet'];
    if(x.includes('manuel')) return ['manual','✎ Manuel'];
    return ['manual',v||'Hareket'];
  }

  function decorateSources(root){
    root.querySelectorAll('table tbody tr').forEach(tr=>{
      const cells=[...tr.children];
      cells.forEach(td=>{
        if(td.dataset.hisSourceDecorated) return;
        const txt=td.textContent.trim();
        if(!txt || txt.length>80) return;
        if(/transfer|tahsil|fatura|çek|cek|senet|manuel/i.test(txt)){
          const [cls,label]=normalizeSource(txt);
          td.innerHTML='<span class="his-source '+cls+'">'+label+'</span>';
          td.dataset.hisSourceDecorated='1';
        }
      });
    });
  }

  function addTableSearch(root){
    root.querySelectorAll('.panel').forEach(panel=>{
      const table=panel.querySelector('table');
      if(!table || panel.querySelector('.his-list-tools')) return;
      const head=panel.querySelector('.panelTop');
      if(head && head.nextElementSibling && head.nextElementSibling.tagName==='INPUT') return;
      const tools=document.createElement('div'); tools.className='his-list-tools';
      const input=document.createElement('input'); input.className='his-list-search';
      input.placeholder='🔎 Bu listede ara…'; input.setAttribute('aria-label','Bu listede ara');
      const count=document.createElement('span'); count.className='his-count';
      tools.append(input,count);
      if(head) head.insertAdjacentElement('afterend',tools); else panel.insertBefore(tools,table.parentElement||table);
      const rows=()=>[...table.querySelectorAll('tbody tr')];
      const apply=()=>{
        const q=input.value.trim().toLocaleLowerCase('tr-TR'); let visible=0;
        rows().forEach(r=>{const ok=!q||r.textContent.toLocaleLowerCase('tr-TR').includes(q);r.style.display=ok?'':'none';if(ok&&!r.querySelector('.empty'))visible++;});
        count.textContent=visible+' kayıt';
      };
      input.addEventListener('input',apply); apply();
    });
  }

  function improveInputs(root){
    root.querySelectorAll('input,textarea,select').forEach(el=>{
      const key=((el.id||'')+' '+(el.name||'')+' '+(el.placeholder||'')).toLocaleLowerCase('tr-TR');
      if(/tutar|miktar|bakiye|limit|fiyat|ödeme|odeme/.test(key)){
        if(el.tagName==='INPUT') el.setAttribute('inputmode','decimal');
      }
      if(el.tagName==='INPUT' && el.type==='date') el.setAttribute('aria-label','Tarih');
    });
  }

  function keyboard(){
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        const modal=document.getElementById('modal'); if(modal?.classList.contains('show')){if(typeof closeModal==='function')closeModal();return;}
      }
      if(e.key==='/' && !/input|textarea|select/i.test(document.activeElement?.tagName||'')){
        const x=document.querySelector('.his-list-search,.searchInput'); if(x){e.preventDefault();x.focus();}
      }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
        e.preventDefault();const x=document.querySelector('.his-list-search,.searchInput');if(x){x.focus();x.select();}
      }
    });
  }

  function modalGuidance(){
    const body=document.getElementById('modalBody');
    const title=document.getElementById('modalTitle');
    if(!body||!title||body.dataset.hisGuidance===title.textContent)return;
    const t=title.textContent.toLocaleLowerCase('tr-TR');
    let text='';
    if(t.includes('transfer')) text='Bu işlem banka/kasa etkilerini tek ana işlem altında oluşturur. Kaydın tamamını bu ekrandan yönetin.';
    else if(t.includes('tahsil')) text='Tahsilat ana işlemdir. Cari ve banka/kasa yansımaları birlikte yönetilir.';
    else if(t.includes('fatura')) text='Fatura kaydının cari etkisi ana işlemle birlikte yönetilir.';
    else if(t.includes('çek')||t.includes('senet')) text='Çek/Senet hareketlerini ana kaydın yaşam döngüsü üzerinden yönetin.';
    if(text){const n=document.createElement('div');n.className='his-modal-note';n.textContent='ℹ '+text;body.prepend(n);body.dataset.hisGuidance=title.textContent;}
  }

  function observer(){
    const mo=new MutationObserver(()=>{
      addGlobalStyles();
      const root=document.getElementById('view'); if(root){addTableSearch(root);decorateSources(root);improveInputs(root);}
      modalGuidance();
    });
    mo.observe(document.body,{subtree:true,childList:true});
  }

  function init(){addGlobalStyles();keyboard();observer();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();