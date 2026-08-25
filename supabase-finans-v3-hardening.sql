-- HİS Finans V3 Hardening
-- Amaç: PostgREST RPC çakışmasını kaldırmak, bağlı finansal kayıtları korumak,
-- transfer/çek/fatura düzenleme ve iptal akışlarını güvenli hale getirmek.

-- PostgREST overloaded RPC kullanmasın.
drop function if exists public.finans_cari_ekle(text,text,text,text,text,text,text);
create or replace function public.finans_cari_hesap_ekle(
  p_unvan text,
  p_yetkili text default null,
  p_telefon text default null,
  p_email text default null,
  p_vergi_no text default null,
  p_adres text default null,
  p_notlar text default null
) returns uuid
language sql security definer set search_path = ''
as $$ select private.finans_cari_ekle($1,$2,$3,$4,$5,$6,$7); $$;

-- Fatura düzenleme: ayrı aktif tahsilat varsa kilitle.
create or replace function public.finans_fatura_duzenle(
  p_islem uuid,p_cari uuid,p_fatura_no text,p_tarih date,p_vade date,
  p_ara numeric,p_kdv_oran numeric,p_kdv numeric,p_total numeric,
  p_odeme text,p_aciklama text
) returns void
language plpgsql security definer set search_path=public
as $$
declare old public.faturalar;
begin
  if p_total is null or p_total<=0 then raise exception 'Fatura toplamı 0 dan büyük olmalıdır.'; end if;
  if p_odeme is not null and p_odeme not in ('Bankadan','Nakit') then raise exception 'Geçersiz ödeme yöntemi.'; end if;
  select * into old from public.faturalar where islem_id=p_islem limit 1;
  if old.id is null then raise exception 'Fatura bulunamadı'; end if;
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı'; end if;
  if not exists(select 1 from public.cariler where id=p_cari) then raise exception 'Cari bulunamadı.'; end if;
  if exists(select 1 from public.tahsilatlar t join public.islemler ti on ti.id=t.islem_id where t.fatura_id=old.id and t.islem_id<>p_islem and ti.durum='aktif') then
    raise exception 'Bu faturaya bağlı aktif tahsilat var. Önce tahsilatı iptal/düzenle yapın.';
  end if;
  if p_odeme is distinct from old.odeme_yontemi and (p_odeme is not null or old.odeme_yontemi is not null) then
    raise exception 'Ödeme yöntemi değiştirilemez. Mevcut ödeme kaydını iptal edip faturayı yeniden düzenleyin.';
  end if;
  delete from public.tahsilatlar where islem_id=p_islem;
  delete from public.cari_hareketleri where islem_id=p_islem;
  delete from public.banka_hareketleri where islem_id=p_islem;
  delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.faturalar set cari_id=p_cari,fatura_no=p_fatura_no,tarih=p_tarih,vade_tarihi=p_vade,ara_toplam=p_ara,kdv_orani=p_kdv_oran,kdv_tutari=p_kdv,geneltoplam=p_total,kalan_tutar=p_total,aciklama=p_aciklama where id=old.id;
  update public.islemler set tarih=p_tarih,tutar=p_total,aciklama=coalesce(nullif(trim(p_aciklama),''),aciklama) where id=p_islem;
  insert into public.cari_hareketleri(cari_id,tip,tarih,vade_tarihi,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,banka_hesap_id,kasa_id,islem_id)
  values(p_cari,case when old.fatura_turu='satis' then 'borc' else 'alacak' end,p_tarih,p_vade,p_total,p_fatura_no,p_aciklama,null,'fatura',p_islem,null,null,p_islem);
end; $$;

-- Fatura fiziksel silinmez; FK ve finansal geçmiş korunur.
create or replace function public.finans_fatura_iptal(p_islem uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_fatura public.faturalar;
begin
  select * into v_fatura from public.faturalar where islem_id=p_islem limit 1;
  if v_fatura.id is null then raise exception 'Fatura bulunamadı.'; end if;
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı'; end if;
  if exists(select 1 from public.tahsilatlar t join public.islemler ti on ti.id=t.islem_id where t.fatura_id=v_fatura.id and t.islem_id<>p_islem and ti.durum='aktif') then
    raise exception 'Faturaya bağlı aktif tahsilat var. Önce tahsilatı iptal edin.';
  end if;
  delete from public.cari_hareketleri where islem_id=p_islem;
  delete from public.banka_hareketleri where islem_id=p_islem;
  delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.faturalar set kalan_tutar=0 where id=v_fatura.id;
  update public.islemler set durum='iptal',iptal_edildi=true where id=p_islem;
end; $$;

-- Cari hareket düzenleme doğrulamaları.
create or replace function public.finans_cari_duzenle(p_islem uuid,p_cari uuid,p_tarih date,p_tip text,p_tutar numeric,p_vade date,p_belge text,p_aciklama text,p_banka uuid,p_kasa uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare old public.cari_hareketleri;
begin
  if p_tip not in ('borc','alacak') then raise exception 'Cari yönü borc veya alacak olmalı'; end if;
  if p_tutar is null or p_tutar<=0 then raise exception 'Tutar 0 dan büyük olmalı'; end if;
  if p_banka is not null and p_kasa is not null then raise exception 'Banka veya kasa seçin; ikisini birlikte kullanmayın.'; end if;
  if not exists(select 1 from public.cariler where id=p_cari) then raise exception 'Cari bulunamadı'; end if;
  if p_banka is not null and not exists(select 1 from public.banka_hesaplari where id=p_banka and aktif=true) then raise exception 'Banka hesabı bulunamadı veya pasif.'; end if;
  if p_kasa is not null and not exists(select 1 from public.kasa_hesaplari where id=p_kasa and aktif=true) then raise exception 'Kasa bulunamadı veya pasif.'; end if;
  select * into old from public.cari_hareketleri where islem_id=p_islem limit 1;
  if old.id is null then raise exception 'Cari hareketi bulunamadı'; end if;
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı'; end if;
  delete from public.cari_hareketleri where islem_id=p_islem;
  delete from public.banka_hareketleri where islem_id=p_islem;
  delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.islemler set tarih=p_tarih,aciklama=coalesce(nullif(trim(p_aciklama),''),aciklama),tutar=p_tutar where id=p_islem;
  insert into public.cari_hareketleri(cari_id,tip,tarih,vade_tarihi,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,banka_hesap_id,kasa_id,islem_id)
  values(p_cari,p_tip,p_tarih,p_vade,p_tutar,p_belge,p_aciklama,case when p_banka is not null then 'Bankadan' when p_kasa is not null then 'Nakit' end,'manuel',p_islem,p_banka,p_kasa,p_islem);
  if p_banka is not null then
    insert into public.banka_hareketleri(banka_hesap_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,kategori,aciklama,kaynak_turu,kaynak_id,islem_id)
    values(p_banka,p_cari,p_tarih,case when p_tip='alacak' then 'giris' else 'cikis' end,p_tutar,p_belge,case when p_tip='alacak' then 'Bankadan' else 'Ödeme' end,'Cari',p_aciklama,'manuel',p_islem,p_islem);
  elsif p_kasa is not null then
    insert into public.kasa_hareketleri(kasa_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,kategori,aciklama,kaynak_turu,kaynak_id,islem_id)
    values(p_kasa,p_cari,p_tarih,case when p_tip='alacak' then 'giris' else 'cikis' end,p_tutar,p_belge,case when p_tip='alacak' then 'Nakit' else 'Ödeme' end,'Cari',p_aciklama,'manuel',p_islem,p_islem);
  end if;
end; $$;

-- Manuel banka/kasa düzenleme güvenliği.
create or replace function public.finans_manuel_banka_duzenle(p_islem uuid,p_banka uuid,p_cari uuid,p_tarih date,p_tip text,p_tutar numeric,p_belge text,p_kategori text,p_aciklama text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_tip not in('giris','cikis') or p_tutar is null or p_tutar<=0 then raise exception 'Geçersiz banka hareketi.'; end if;
  if not exists(select 1 from public.banka_hesaplari where id=p_banka and aktif=true) then raise exception 'Banka hesabı bulunamadı veya pasif.'; end if;
  if p_cari is not null and not exists(select 1 from public.cariler where id=p_cari) then raise exception 'Cari bulunamadı.'; end if;
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı'; end if;
  delete from public.cari_hareketleri where islem_id=p_islem; delete from public.banka_hareketleri where islem_id=p_islem; delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.islemler set tarih=p_tarih,aciklama=coalesce(nullif(trim(p_aciklama),''),aciklama),tutar=p_tutar where id=p_islem;
  insert into public.banka_hareketleri(banka_hesap_id,cari_id,tarih,tip,tutar,belge_no,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_banka,p_cari,p_tarih,p_tip,p_tutar,p_belge,p_kategori,p_aciklama,'manuel',p_islem,p_islem);
  if p_cari is not null then insert into public.cari_hareketleri(cari_id,tip,tarih,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,banka_hesap_id,islem_id) values(p_cari,case when p_tip='giris' then 'alacak' else 'borc' end,p_tarih,p_tutar,p_belge,p_aciklama,'Bankadan','manuel',p_islem,p_banka,p_islem); end if;
end; $$;

create or replace function public.finans_manuel_kasa_duzenle(p_islem uuid,p_kasa uuid,p_cari uuid,p_tarih date,p_tip text,p_tutar numeric,p_belge text,p_kategori text,p_aciklama text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_tip not in('giris','cikis') or p_tutar is null or p_tutar<=0 then raise exception 'Geçersiz kasa hareketi.'; end if;
  if not exists(select 1 from public.kasa_hesaplari where id=p_kasa and aktif=true) then raise exception 'Kasa bulunamadı veya pasif.'; end if;
  if p_cari is not null and not exists(select 1 from public.cariler where id=p_cari) then raise exception 'Cari bulunamadı.'; end if;
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı'; end if;
  delete from public.cari_hareketleri where islem_id=p_islem; delete from public.banka_hareketleri where islem_id=p_islem; delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.islemler set tarih=p_tarih,aciklama=coalesce(nullif(trim(p_aciklama),''),aciklama),tutar=p_tutar where id=p_islem;
  insert into public.kasa_hareketleri(kasa_id,cari_id,tarih,tip,tutar,belge_no,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_kasa,p_cari,p_tarih,p_tip,p_tutar,p_belge,p_kategori,p_aciklama,'manuel',p_islem,p_islem);
  if p_cari is not null then insert into public.cari_hareketleri(cari_id,tip,tarih,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,kasa_id,islem_id) values(p_cari,case when p_tip='giris' then 'alacak' else 'borc' end,p_tarih,p_tutar,p_belge,p_aciklama,'Nakit','manuel',p_islem,p_kasa,p_islem); end if;
end; $$;

-- Transfer düzenleme: kaynak/hedef hesap ve tutar doğrulanır.
create or replace function public.finans_transfer_duzenle(p_islem uuid,p_tarih date,p_tutar numeric,p_kt text,p_kid uuid,p_ht text,p_hid uuid,p_aciklama text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_kt not in('banka','kasa') or p_ht not in('banka','kasa') then raise exception 'Geçersiz hesap türü'; end if;
  if p_tutar is null or p_tutar<=0 then raise exception 'Tutar 0 dan büyük olmalı'; end if;
  if p_kt=p_ht and p_kid=p_hid then raise exception 'Kaynak ve hedef aynı olamaz'; end if;
  if p_kt='banka' and not exists(select 1 from public.banka_hesaplari where id=p_kid and aktif=true) then raise exception 'Kaynak banka bulunamadı'; end if;
  if p_kt='kasa' and not exists(select 1 from public.kasa_hesaplari where id=p_kid and aktif=true) then raise exception 'Kaynak kasa bulunamadı'; end if;
  if p_ht='banka' and not exists(select 1 from public.banka_hesaplari where id=p_hid and aktif=true) then raise exception 'Hedef banka bulunamadı'; end if;
  if p_ht='kasa' and not exists(select 1 from public.kasa_hesaplari where id=p_hid and aktif=true) then raise exception 'Hedef kasa bulunamadı'; end if;
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı'; end if;
  delete from public.banka_hareketleri where islem_id=p_islem; delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.islemler set tarih=p_tarih,aciklama=coalesce(nullif(trim(p_aciklama),''),aciklama),tutar=p_tutar,borc_turu=p_ht,borc_id=p_hid,alacak_turu=p_kt,alacak_id=p_kid where id=p_islem;
  if p_kt='banka' then insert into public.banka_hareketleri(banka_hesap_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_kid,p_tarih,'cikis',p_tutar,'Transfer',p_aciklama,'transfer',p_islem,p_islem); else insert into public.kasa_hareketleri(kasa_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_kid,p_tarih,'cikis',p_tutar,'Transfer',p_aciklama,'transfer',p_islem,p_islem); end if;
  if p_ht='banka' then insert into public.banka_hareketleri(banka_hesap_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_hid,p_tarih,'giris',p_tutar,'Transfer',p_aciklama,'transfer',p_islem,p_islem); else insert into public.kasa_hareketleri(kasa_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_hid,p_tarih,'giris',p_tutar,'Transfer',p_aciklama,'transfer',p_islem,p_islem); end if;
  update public.finans_transferler set tarih=p_tarih,tutar=p_tutar,kaynak_turu=p_kt,kaynak_id=p_kid,hedef_turu=p_ht,hedef_id=p_hid,aciklama=p_aciklama,updated_at=now() where islem_id=p_islem;
end; $$;

-- Çek durum geçişlerinde eski yansıma temizlenir; iade/iptal bakiye etkisini geri alır.
create or replace function public.finans_cek_durum_degistir(p_islem uuid,p_yeni text,p_banka uuid,p_kasa uuid,p_tarih date)
returns void language plpgsql security definer set search_path=public
as $$
declare x public.cek_senetler; v_tip text;
begin
  select * into x from public.cek_senetler where islem_id=p_islem for update;
  if not found then raise exception 'Çek/Senet bulunamadı.'; end if;
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı.'; end if;
  if p_yeni not in('bankaya_verildi','tahsil_edildi','odendi','iade') then raise exception 'Geçersiz durum.'; end if;
  if p_banka is not null and p_kasa is not null then raise exception 'Banka veya kasa seçin; ikisini birlikte kullanmayın.'; end if;
  if p_yeni='bankaya_verildi' and p_banka is null then raise exception 'Bankaya Verildi için banka seçin.'; end if;
  if p_yeni in('tahsil_edildi','odendi') and p_banka is null and p_kasa is null then raise exception 'Banka veya kasa seçin.'; end if;
  if p_banka is not null and not exists(select 1 from public.banka_hesaplari where id=p_banka and aktif=true) then raise exception 'Banka hesabı bulunamadı veya pasif.'; end if;
  if p_kasa is not null and not exists(select 1 from public.kasa_hesaplari where id=p_kasa and aktif=true) then raise exception 'Kasa bulunamadı veya pasif.'; end if;
  delete from public.banka_hareketleri where islem_id=p_islem; delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.cek_senetler set portfoy_durumu=p_yeni,tahsil_tarihi=case when p_yeni in('tahsil_edildi','odendi') then p_tarih else null end,banka_hesap_id=case when p_banka is not null then p_banka when p_yeni='iade' then null else banka_hesap_id end,kasa_id=case when p_kasa is not null then p_kasa when p_yeni='iade' then null else kasa_id end where islem_id=p_islem;
  if p_yeni in('tahsil_edildi','odendi') then
    v_tip:=case when x.yon='alınan' then 'giris' else 'cikis' end;
    if p_banka is not null then insert into public.banka_hareketleri(banka_hesap_id,cari_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_banka,x.cari_id,p_tarih,v_tip,x.tutar,'Çek/Senet','Çek/Senet '||p_yeni,'cek_senet',p_islem,p_islem); else insert into public.kasa_hareketleri(kasa_id,cari_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id,islem_id) values(p_kasa,x.cari_id,p_tarih,v_tip,x.tutar,'Çek/Senet','Çek/Senet '||p_yeni,'cek_senet',p_islem,p_islem); end if;
  end if;
end; $$;

create or replace function public.finans_cek_iade(p_islem uuid,p_tarih date,p_aciklama text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı.'; end if;
  if not exists(select 1 from public.cek_senetler where islem_id=p_islem) then raise exception 'Çek/Senet bulunamadı.'; end if;
  delete from public.banka_hareketleri where islem_id=p_islem; delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.cek_senetler set portfoy_durumu='iade',tahsil_tarihi=null,banka_hesap_id=null,kasa_id=null,aciklama=coalesce(p_aciklama,aciklama) where islem_id=p_islem;
end; $$;

create or replace function public.finans_cek_iptal(p_islem uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.islemler where id=p_islem and durum='aktif') then raise exception 'Aktif işlem bulunamadı'; end if;
  delete from public.banka_hareketleri where islem_id=p_islem; delete from public.kasa_hareketleri where islem_id=p_islem;
  update public.cek_senetler set portfoy_durumu='iptal',tahsil_tarihi=null,banka_hesap_id=null,kasa_id=null where islem_id=p_islem;
  update public.islemler set durum='iptal',iptal_edildi=true where id=p_islem;
end; $$;

notify pgrst, 'reload schema';
