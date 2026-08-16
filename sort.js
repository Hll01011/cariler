/* HYS_UNIVERSAL_SORT_V1 */
(function(){
  "use strict";
  const norm=s=>String(s||"").toLocaleLowerCase("tr-TR");
  const amount=s=>{let x=String(s||"").replace(/[^0-9,.-]/g,"").replace(/\./g,"").replace(",",".");return Number(x)||0};
  const date=s=>{let t=String(s||"").trim(),m=t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]).getTime()||0;let d=Date.parse(t);return Number.isNaN(d)?0:d};
  const indexOf=(heads,words)=>{for(const w of words){const i=heads.findIndex(h=>h.includes(w));if(i>=0)return i}return -1};
  function sortTable(table,mode){
    const heads=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
    const rows=[...table.querySelectorAll("tbody tr")];
    if(!rows.length||!table.tBodies.length)return;
    const di=indexOf(heads,["tarih","işlem tarihi","vade"]);
    const ai=indexOf(heads,["tutar","bakiye","toplam","borç","alacak"]);
    const ni=indexOf(heads,["cari","unvan","banka","kasa","açıklama"]);
    let cmp;
    if(mode==="date_desc"&&di>=0)cmp=(a,b)=>date(b.cells[di]?.textContent)-date(a.cells[di]?.textContent);
    else if(mode==="date_asc"&&di>=0)cmp=(a,b)=>date(a.cells[di]?.textContent)-date(b.cells[di]?.textContent);
    else if(mode==="amount_desc"&&ai>=0)cmp=(a,b)=>amount(b.cells[ai]?.textContent)-amount(a.cells[ai]?.textContent);
    else if(mode==="amount_asc"&&ai>=0)cmp=(a,b)=>amount(a.cells[ai]?.textContent)-amount(b.cells[ai]?.textContent);
    else {const i=ni>=0?ni:0;cmp=(a,b)=>norm(a.cells[i]?.textContent).localeCompare(norm(b.cells[i]?.textContent),"tr",{sensitivity:"base"});if(mode==="name_desc"){const base=cmp;cmp=(a,b)=>base(b,a)}}
    rows.sort(cmp).forEach(r=>table.tBodies[0].appendChild(r));
  }
  function addBar(table){
    const wrap=table.closest(".table-wrap");
    if(!wrap||wrap.previousElementSibling?.classList.contains("hys-sortbar"))return;
    const bar=document.createElement("div");bar.className="hys-sortbar";
    bar.innerHTML='<span>Sırala</span><select aria-label="Liste sıralama"><option value="date_desc">Yeni → Eski</option><option value="date_asc">Eski → Yeni</option><option value="amount_desc">Tutar Büyük → Küçük</option><option value="amount_asc">Tutar Küçük → Büyük</option><option value="name_asc">A → Z</option><option value="name_desc">Z → A</option></select><button type="button">↺ Varsayılan</button>';
    wrap.parentNode.insertBefore(bar,wrap);
    const select=bar.querySelector("select");
    select.addEventListener("change",()=>sortTable(table,select.value));
    bar.querySelector("button").addEventListener("click",()=>{select.value="date_desc";sortTable(table,"date_desc")});
    sortTable(table,"date_desc");
  }
  function scan(){document.querySelectorAll(".table-wrap table").forEach(addBar)}
  let timer;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,40)});
  function start(){scan();observer.observe(document.getElementById("app")||document.body,{childList:true,subtree:true})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
