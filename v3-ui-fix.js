/* V3 UI error normalizer */
(function(){'use strict';
 const old=window.toast;
 if(typeof old!=='function')return;
 window.toast=function(message,bad){
   let s=message;
   if(message&&typeof message==='object')s=message.message||message.details||message.hint||String(message);
   if(typeof s==='string'){
     try{const j=JSON.parse(s);s=j.message||j.details||j.hint||s}catch(_){ }
     s=s.replace(/^ERROR:\s*/,'').replace(/^P0001:\s*/,'');
     if(/doğrudan değiştirilemez|bağlı|ana finans/i.test(s))s='🔒 İşlem gerçekleştirilemedi\n'+s;
   }
   return old.call(this,s,bad);
 };
})();
