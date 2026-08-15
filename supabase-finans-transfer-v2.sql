-- HİS Finans V2 — Merkezi para transferi altyapısı
-- Bu dosya yalnızca geliştirme/test aşamasında uygulanmalıdır.

create table if not exists public.finans_transferler (
  id uuid primary key default gen_random_uuid(),
  tarih date not null default current_date,
  tutar numeric not null check (tutar > 0),
  kaynak_turu text not null check (kaynak_turu in ('banka','kasa')),
  kaynak_id uuid not null,
  hedef_turu text not null check (hedef_turu in ('banka','kasa')),
  hedef_id uuid not null,
  aciklama text,
  kaynak_hareket_id uuid,
  hedef_hareket_id uuid,
  durum text not null default 'aktif' check (durum in ('aktif','iptal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finans_transferler_tarih on public.finans_transferler(tarih desc);
create index if not exists idx_finans_transferler_kaynak on public.finans_transferler(kaynak_turu,kaynak_id);
create index if not exists idx_finans_transferler_hedef on public.finans_transferler(hedef_turu,hedef_id);

create or replace function public.finans_transfer_hesap_var_mi(p_tur text, p_id uuid)
returns boolean language plpgsql stable as $$
begin
  if p_tur='banka' then
    return exists(select 1 from public.banka_hesaplari where id=p_id and aktif=true);
  elsif p_tur='kasa' then
    return exists(select 1 from public.kasa_hesaplari where id=p_id and aktif=true);
  end if;
  return false;
end;
$$;

create or replace function public.finans_transferi_olustur(
  p_tarih date,
  p_tutar numeric,
  p_kaynak_turu text,
  p_kaynak_id uuid,
  p_hedef_turu text,
  p_hedef_id uuid,
  p_aciklama text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_kaynak_hareket uuid;
  v_hedef_hareket uuid;
  v_aciklama text := coalesce(nullif(trim(p_aciklama),''),'Para transferi');
begin
  if p_tutar is null or p_tutar <= 0 then raise exception 'Tutar 0 dan büyük olmalıdır.'; end if;
  if p_kaynak_turu not in ('banka','kasa') or p_hedef_turu not in ('banka','kasa') then raise exception 'Geçersiz hesap türü.'; end if;
  if p_kaynak_turu=p_hedef_turu and p_kaynak_id=p_hedef_id then raise exception 'Kaynak ve hedef aynı olamaz.'; end if;
  if not public.finans_transfer_hesap_var_mi(p_kaynak_turu,p_kaynak_id) then raise exception 'Kaynak hesap bulunamadı veya pasif.'; end if;
  if not public.finans_transfer_hesap_var_mi(p_hedef_turu,p_hedef_id) then raise exception 'Hedef hesap bulunamadı veya pasif.'; end if;

  insert into public.finans_transferler(tarih,tutar,kaynak_turu,kaynak_id,hedef_turu,hedef_id,aciklama)
  values(coalesce(p_tarih,current_date),p_tutar,p_kaynak_turu,p_kaynak_id,p_hedef_turu,p_hedef_id,v_aciklama)
  returning id into v_id;

  if p_kaynak_turu='banka' then
    insert into public.banka_hareketleri(banka_hesap_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_kaynak_id,coalesce(p_tarih,current_date),'cikis',p_tutar,'Transfer',v_aciklama,v_id::text,v_id)
    returning id into v_kaynak_hareket;
  else
    insert into public.kasa_hareketleri(kasa_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_kaynak_id,coalesce(p_tarih,current_date),'cikis',p_tutar,'Transfer',v_aciklama,v_id::text,v_id)
    returning id into v_kaynak_hareket;
  end if;

  if p_hedef_turu='banka' then
    insert into public.banka_hareketleri(banka_hesap_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_hedef_id,coalesce(p_tarih,current_date),'giris',p_tutar,'Transfer',v_aciklama,v_id::text,v_id)
    returning id into v_hedef_hareket;
  else
    insert into public.kasa_hareketleri(kasa_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_hedef_id,coalesce(p_tarih,current_date),'giris',p_tutar,'Transfer',v_aciklama,v_id::text,v_id)
    returning id into v_hedef_hareket;
  end if;

  update public.finans_transferler
  set kaynak_hareket_id=v_kaynak_hareket,hedef_hareket_id=v_hedef_hareket,updated_at=now()
  where id=v_id;
  return v_id;
exception when others then
  raise;
end;
$$;

create or replace function public.finans_transferi_iptal_et(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v public.finans_transferler;
begin
  select * into v from public.finans_transferler where id=p_id for update;
  if not found then raise exception 'Transfer bulunamadı.'; end if;
  if v.durum='iptal' then return true; end if;

  if v.kaynak_turu='banka' then delete from public.banka_hareketleri where id=v.kaynak_hareket_id;
  else delete from public.kasa_hareketleri where id=v.kaynak_hareket_id; end if;
  if v.hedef_turu='banka' then delete from public.banka_hareketleri where id=v.hedef_hareket_id;
  else delete from public.kasa_hareketleri where id=v.hedef_hareket_id; end if;

  update public.finans_transferler set durum='iptal',updated_at=now() where id=p_id;
  return true;
end;
$$;

create or replace function public.finans_transferi_duzenle(
  p_id uuid,
  p_tarih date,
  p_tutar numeric,
  p_kaynak_turu text,
  p_kaynak_id uuid,
  p_hedef_turu text,
  p_hedef_id uuid,
  p_aciklama text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.finans_transferler;
  v_kaynak_hareket uuid;
  v_hedef_hareket uuid;
  v_aciklama text := coalesce(nullif(trim(p_aciklama),''),'Para transferi');
begin
  if p_tutar is null or p_tutar <= 0 then raise exception 'Tutar 0 dan büyük olmalıdır.'; end if;
  if p_kaynak_turu not in ('banka','kasa') or p_hedef_turu not in ('banka','kasa') then raise exception 'Geçersiz hesap türü.'; end if;
  if p_kaynak_turu=p_hedef_turu and p_kaynak_id=p_hedef_id then raise exception 'Kaynak ve hedef aynı olamaz.'; end if;

  select * into v from public.finans_transferler where id=p_id for update;
  if not found then raise exception 'Transfer bulunamadı.'; end if;
  if v.durum='iptal' then raise exception 'İptal edilmiş transfer düzenlenemez.'; end if;
  if not public.finans_transfer_hesap_var_mi(p_kaynak_turu,p_kaynak_id) then raise exception 'Kaynak hesap bulunamadı veya pasif.'; end if;
  if not public.finans_transfer_hesap_var_mi(p_hedef_turu,p_hedef_id) then raise exception 'Hedef hesap bulunamadı veya pasif.'; end if;

  if v.kaynak_turu='banka' then delete from public.banka_hareketleri where id=v.kaynak_hareket_id;
  else delete from public.kasa_hareketleri where id=v.kaynak_hareket_id; end if;
  if v.hedef_turu='banka' then delete from public.banka_hareketleri where id=v.hedef_hareket_id;
  else delete from public.kasa_hareketleri where id=v.hedef_hareket_id; end if;

  update public.finans_transferler
  set tarih=coalesce(p_tarih,current_date), tutar=p_tutar, kaynak_turu=p_kaynak_turu, kaynak_id=p_kaynak_id,
      hedef_turu=p_hedef_turu, hedef_id=p_hedef_id, aciklama=v_aciklama, updated_at=now()
  where id=p_id;

  if p_kaynak_turu='banka' then
    insert into public.banka_hareketleri(banka_hesap_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_kaynak_id,coalesce(p_tarih,current_date),'cikis',p_tutar,'Transfer',v_aciklama,p_id::text,p_id)
    returning id into v_kaynak_hareket;
  else
    insert into public.kasa_hareketleri(kasa_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_kaynak_id,coalesce(p_tarih,current_date),'cikis',p_tutar,'Transfer',v_aciklama,p_id::text,p_id)
    returning id into v_kaynak_hareket;
  end if;

  if p_hedef_turu='banka' then
    insert into public.banka_hareketleri(banka_hesap_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_hedef_id,coalesce(p_tarih,current_date),'giris',p_tutar,'Transfer',v_aciklama,p_id::text,p_id)
    returning id into v_hedef_hareket;
  else
    insert into public.kasa_hareketleri(kasa_id,tarih,tip,tutar,kategori,aciklama,kaynak_turu,kaynak_id)
    values(p_hedef_id,coalesce(p_tarih,current_date),'giris',p_tutar,'Transfer',v_aciklama,p_id::text,p_id)
    returning id into v_hedef_hareket;
  end if;

  update public.finans_transferler
  set kaynak_hareket_id=v_kaynak_hareket, hedef_hareket_id=v_hedef_hareket, updated_at=now()
  where id=p_id;
  return true;
end;
$$;

-- NOT: Production'da RLS/policy kararı ayrıca verilmelidir. Bu migration'ı canlıya
-- almadan önce uygulama rolü ve RPC izinleri ayrıca gözden geçirilmelidir.
