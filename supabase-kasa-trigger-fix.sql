-- HİS Finans — Kasa hareketi / cari yansıma düzeltmesi
-- Hata: 42601 INSERT has more expressions than target columns
-- Nedeni: his_finans_sync() içindeki kasa_hareketleri -> cari_hareketleri
-- INSERT'inde hedef kolon sayısından bir fazla NULL değeri bulunuyordu.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='his_finans_sync'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'his_finans_sync function not found';
  END IF;

  v_def := replace(
    v_def,
    'NEW.odeme_yontemi,v_type,NEW.id,NULL,NEW.kasa_id)',
    'NEW.odeme_yontemi,v_type,NEW.id,NEW.kasa_id)'
  );

  EXECUTE v_def;
END $$;
