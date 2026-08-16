/* HİS Finans UI V4 — SADECE GÖRSEL/KULLANIM KATMANI
   Supabase çağrısı, veri yazma/silme/güncelleme, RPC veya şema değişikliği YOK.
*/
(function(){'use strict';
const css=`
/* V4 quick filters */
.v4-toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:-2px 0 14px}
.v4-search{flex:1;min-width:220px;height:44px;padding:0 14px;border:1px solid #d8e0eb;border-radius:12px;background:#fff;outline:none;font-size:14px}
.v4-search:focus{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb14}
.v4-filter{height:44px;border:1px solid #d8e0eb;border-radius:12px;background:#fff;padding:0 12px;color:#25334b}
.v4-count{font-size:12px;color:#718096;font-weight:700}
.v4-source{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:800;white-space:nowrap}
.v4-source.manual{background:#f1f5f9;color:#475569}.v4-source.transfer{background:#e0f2fe;color:#0369a1}.v4-source.tahsilat{background:#dcfce7;color:#15803d}.v4-source.fatura{background:#fef3c7;color:#92400e}.v4-source.cek{background:#f3e8ff;color:#7e22ce}
.v4-lock{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:10px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800}
.v4-actions{display:flex;gap:7px;flex-wrap:wrap}.v4-actions button{min-height:40px}
.v4-form-note{grid-column:1/-1;padding:11px 13px;border-radius:11px;background:#eff6ff;color:#1e40af;font-size:12px;line-height:1.5}
.v4-amount{font-variant-numeric:tabular-nums;letter-spacing:.1px}
.v4-success{position:fixed;inset:auto 20px 20px auto;z-index:9999;max-width:430px;background:#fff;border:1px solid #dbe5ef;border-left:4px solid #059669;border-radius:14px;box-shadow:0 18px 50px #0002;padding:15px 17px;display:none}
.v4-success.show{display:block;animation:v4in .2s ease}.v4-success b{display:block;margin-bottom:4px}.v4-success small{color:#64748b}
@keyframes v4in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(max-width:700px){.v4-toolbar{align-items:stretch}.v4-search,.v4-filter{width:100%;min-width:0}.v4-actions button{flex:1}.v4-success{left:12px;right:12px;bottom:12px;max-width:none}}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
function esc(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]))}
function sourceLabel(v){v=String(v||'manuel').toLocaleLowerCase('tr-TR');if(v.includes('transfer'))return ['↔','Para Transferi','transfer'];if(v.includes('tahsil'))return ['₺','Tahsilat','tahsilat'];if(v.includes('fatura'))return ['▧','Fatura','fatura'];if(v.includes('cek')||v.includes('senet'))return ['◈','Çek / Senet','cek'];return ['•','Manuel','manual']}
function sourceBadge(v){const [i,t,c]=sourceLabel(v);return `<span class="v4-source ${c}">${i} ${t}</span>`}
function amountInput(input){if(!input||input.dataset.v4)return;input.dataset.v4='1';input.setAttribute('inputmode','decimal');input.setAttribute('autocomplete','off');input.addEventListener('blur',()=>{let s=input.value.trim().replace(/\s/g,'');if(!s)return; if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');let n=Number(s);if(Number.isFinite(n))input.value=n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})});input.addEventListener('focus',()=>{const n=Number(input.value.replace(/\./g,'').replace(',','.'));if(Number.isFinite(n)&&n)input.value=String(n)})}
function enhanceAmounts(){document.querySelectorAll('input').forEach(i=>{const x=((i.id||'')+' '+(i.name||'')+' '+(i.placeholder||'')).toLocaleLowerCase('tr-TR');if(/tutar|miktar|fiyat|bakiye|limit/.test(x))amountInput(i)})}
function install(){enhanceAmounts();new MutationObserver(()=>enhanceAmounts()).observe(document.body,{subtree:true,childList:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.querySelector('.modalBg.show');if(m)window.closeModal?.();}});
 window.hisUIV4={sourceBadge,enhanceAmounts};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();