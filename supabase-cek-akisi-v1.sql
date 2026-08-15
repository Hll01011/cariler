-- HİS Finans — Çek/Senet yaşam döngüsü v1
-- Geliştirme dalı içindir. Production'a henüz uygulanmaz.
-- Kritik kural:
--   bankaya_verildi = bankaya teslim edildi, banka bakiyesi DEĞİŞMEZ
--   tahsil_edildi  = para gerçekten bankaya/kasaya geçti, hareket OLUŞUR
--   iade           = alınan çek için cari borcu yeniden açar

CREATE OR REPLACE FUNCTION public.his_finans_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_group uuid;
  v_id uuid;
  v_type text;
  v_cari_tip text;
  v_settled boolean;
  v_old_invoice uuid;
  v_new_invoice uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW,OLD);
  END IF;

  v_type := TG_TABLE_NAME;
  v_id := COALESCE(NEW.id,OLD.id);

  SELECT islem_id INTO v_group
  FROM public.finans_islem_baglantilari
  WHERE kaynak_turu=v_type AND kaynak_id=v_id
  ORDER BY created_at DESC LIMIT 1;

  IF TG_OP='DELETE' THEN
    IF v_group IS NOT NULL THEN
      PERFORM public.his_finans_delete_mirrors(v_group,v_type,v_id);
    END IF;
    IF v_type='tahsilatlar' THEN
      v_old_invoice := OLD.fatura_id;
      IF v_old_invoice IS NOT NULL THEN PERFORM public.his_finans_recalc_invoice(v_old_invoice); END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF v_group IS NULL THEN v_group := gen_random_uuid(); END IF;
  IF TG_OP='UPDATE' THEN
    PERFORM public.his_finans_delete_mirrors(v_group,v_type,v_id);
  END IF;
  PERFORM public.his_finans_link(v_group,v_type,v_id,'ana');

  IF v_type='tahsilatlar' THEN
    IF NEW.cari_id IS NULL THEN RAISE EXCEPTION 'Tahsilatta cari seçilmelidir'; END IF;
    IF NEW.tutar IS NULL OR NEW.tutar<=0 THEN RAISE EXCEPTION 'Tahsilat tutarı sıfırdan büyük olmalıdır'; END IF;
    IF NEW.banka_hesap_id IS NULL AND NEW.kasa_id IS NULL THEN RAISE EXCEPTION 'Tahsilatta banka veya kasa seçilmelidir'; END IF;
    INSERT INTO public.cari_hareketleri(cari_id,tip,tarih,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,banka_hesap_id,kasa_id)
    VALUES(NEW.cari_id,'alacak',NEW.tarih,NEW.tutar,NEW.belge_no,COALESCE(NEW.aciklama,'Tahsilat'),NEW.odeme_yontemi,v_type,NEW.id,NEW.banka_hesap_id,NEW.kasa_id)
    RETURNING id INTO v_id;
    PERFORM public.his_finans_link(v_group,'cari_hareketleri',v_id,'yansima');
    IF NEW.banka_hesap_id IS NOT NULL THEN
      INSERT INTO public.banka_hareketleri(banka_hesap_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
      VALUES(NEW.banka_hesap_id,NEW.cari_id,NEW.tarih,'giris',NEW.tutar,NEW.belge_no,NEW.odeme_yontemi,COALESCE(NEW.aciklama,'Tahsilat'))
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'banka_hareketleri',v_id,'yansima');
    ELSE
      INSERT INTO public.kasa_hareketleri(kasa_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
      VALUES(NEW.kasa_id,NEW.cari_id,NEW.tarih,'giris',NEW.tutar,NEW.belge_no,NEW.odeme_yontemi,COALESCE(NEW.aciklama,'Tahsilat'))
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'kasa_hareketleri',v_id,'yansima');
    END IF;
    PERFORM public.his_finans_recalc_invoice(NEW.fatura_id);

  ELSIF v_type='banka_hareketleri' THEN
    IF NEW.cari_id IS NOT NULL THEN
      INSERT INTO public.cari_hareketleri(cari_id,tip,tarih,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,banka_hesap_id)
      VALUES(NEW.cari_id,CASE WHEN NEW.tip='giris' THEN 'alacak' ELSE 'borc' END,NEW.tarih,NEW.tutar,NEW.belge_no,COALESCE(NEW.aciklama,'Banka hareketi'),NEW.odeme_yontemi,v_type,NEW.id,NEW.banka_hesap_id)
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'cari_hareketleri',v_id,'yansima');
    END IF;

  ELSIF v_type='kasa_hareketleri' THEN
    IF NEW.cari_id IS NOT NULL THEN
      INSERT INTO public.cari_hareketleri(cari_id,tip,tarih,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,kasa_id)
      VALUES(NEW.cari_id,CASE WHEN NEW.tip='giris' THEN 'alacak' ELSE 'borc' END,NEW.tarih,NEW.tutar,NEW.belge_no,COALESCE(NEW.aciklama,'Kasa hareketi'),NEW.odeme_yontemi,v_type,NEW.id,NEW.kasa_id)
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'cari_hareketleri',v_id,'yansima');
    END IF;

  ELSIF v_type='cek_senetler' THEN
    IF NEW.cari_id IS NOT NULL THEN
      -- Alınan çek normalde cari borcunu düşürür; iade edilirse borcu yeniden açar.
      v_cari_tip := CASE
        WHEN lower(NEW.portfoy_durumu)='iade' AND NEW.yon='alinan' THEN 'borc'
        WHEN lower(NEW.portfoy_durumu)='iade' AND NEW.yon='verilen' THEN 'alacak'
        WHEN NEW.yon='verilen' THEN 'borc'
        ELSE 'alacak'
      END;
      INSERT INTO public.cari_hareketleri(cari_id,tip,tarih,vade_tarihi,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,banka_hesap_id,kasa_id)
      VALUES(NEW.cari_id,v_cari_tip,COALESCE(NEW.duzenleme_tarihi,NEW.vade_tarihi,CURRENT_DATE),NEW.vade_tarihi,NEW.tutar,NEW.cek_no,COALESCE(NEW.aciklama,'Çek/Senet '||COALESCE(NEW.cek_no,'')),'cek_senet',v_type,NEW.id,NEW.banka_hesap_id,NEW.kasa_id)
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'cari_hareketleri',v_id,'yansima');
    END IF;

    -- Sadece gerçek tahsilat banka/kasa hareketi üretir.
    -- bankaya_verildi aşamasında para henüz hesaba geçmediği için finans bakiyesi değişmez.
    v_settled := lower(replace(COALESCE(NEW.portfoy_durumu,''),' ', '_')) IN ('tahsil_edildi','odendi');
    IF v_settled AND NEW.banka_hesap_id IS NOT NULL THEN
      INSERT INTO public.banka_hareketleri(banka_hesap_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
      VALUES(NEW.banka_hesap_id,NEW.cari_id,COALESCE(NEW.tahsil_tarihi,NEW.vade_tarihi,CURRENT_DATE),CASE WHEN NEW.yon='verilen' THEN 'cikis' ELSE 'giris' END,NEW.tutar,NEW.cek_no,'cek_senet',CASE WHEN NEW.yon='verilen' THEN 'Çek/Senet ödemesi' ELSE 'Çek/Senet tahsilatı' END)
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'banka_hareketleri',v_id,'yansima');
    ELSIF v_settled AND NEW.kasa_id IS NOT NULL THEN
      INSERT INTO public.kasa_hareketleri(kasa_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
      VALUES(NEW.kasa_id,NEW.cari_id,COALESCE(NEW.tahsil_tarihi,NEW.vade_tarihi,CURRENT_DATE),CASE WHEN NEW.yon='verilen' THEN 'cikis' ELSE 'giris' END,NEW.tutar,NEW.cek_no,'cek_senet',CASE WHEN NEW.yon='verilen' THEN 'Çek/Senet ödemesi' ELSE 'Çek/Senet tahsilatı' END)
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'kasa_hareketleri',v_id,'yansima');
    END IF;

  ELSIF v_type='cari_hareketleri' THEN
    IF NEW.banka_hesap_id IS NOT NULL THEN
      INSERT INTO public.banka_hareketleri(banka_hesap_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
      VALUES(NEW.banka_hesap_id,NEW.cari_id,NEW.tarih,CASE WHEN NEW.tip='alacak' THEN 'giris' ELSE 'cikis' END,NEW.tutar,NEW.belge_no,NEW.odeme_yontemi,COALESCE(NEW.aciklama,'Cari hareket'))
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'banka_hareketleri',v_id,'yansima');
    ELSIF NEW.kasa_id IS NOT NULL THEN
      INSERT INTO public.kasa_hareketleri(kasa_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
      VALUES(NEW.kasa_id,NEW.cari_id,NEW.tarih,CASE WHEN NEW.tip='alacak' THEN 'giris' ELSE 'cikis' END,NEW.tutar,NEW.belge_no,NEW.odeme_yontemi,COALESCE(NEW.aciklama,'Cari hareket'))
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'kasa_hareketleri',v_id,'yansima');
    END IF;

  ELSIF v_type='faturalar' THEN
    IF NEW.cari_id IS NOT NULL THEN
      INSERT INTO public.cari_hareketleri(cari_id,tip,tarih,vade_tarihi,tutar,belge_no,aciklama,odeme_yontemi,kaynak_turu,kaynak_id,banka_hesap_id,kasa_id)
      VALUES(NEW.cari_id,'borc',NEW.tarih,NEW.vade_tarihi,NEW.geneltoplam,NEW.fatura_no,'Fatura '||COALESCE(NEW.fatura_no,''),NEW.odeme_yontemi,v_type,NEW.id,NEW.banka_hesap_id,NEW.kasa_id)
      RETURNING id INTO v_id;
      PERFORM public.his_finans_link(v_group,'cari_hareketleri',v_id,'yansima');
    END IF;
    IF NEW.banka_hesap_id IS NOT NULL OR NEW.kasa_id IS NOT NULL THEN
      IF NEW.banka_hesap_id IS NOT NULL THEN
        INSERT INTO public.banka_hareketleri(banka_hesap_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
        VALUES(NEW.banka_hesap_id,NEW.cari_id,NEW.tarih,'giris',NEW.geneltoplam,NEW.fatura_no,NEW.odeme_yontemi,'Fatura peşin tahsilatı')
        RETURNING id INTO v_id;
        PERFORM public.his_finans_link(v_group,'banka_hareketleri',v_id,'yansima');
      ELSE
        INSERT INTO public.kasa_hareketleri(kasa_id,cari_id,tarih,tip,tutar,belge_no,odeme_yontemi,aciklama)
        VALUES(NEW.kasa_id,NEW.cari_id,NEW.tarih,'giris',NEW.geneltoplam,NEW.fatura_no,NEW.odeme_yontemi,'Fatura peşin tahsilatı')
        RETURNING id INTO v_id;
        PERFORM public.his_finans_link(v_group,'kasa_hareketleri',v_id,'yansima');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;