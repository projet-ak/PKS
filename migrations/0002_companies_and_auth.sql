-- Firma ayrimi (ERN Holding / ERN Taahhut) ve panel kullanici girisi.

-- ------------------------------------------------------------------ firma
CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT        NOT NULL UNIQUE,   -- HOLDING, TAAHHUT
    name        TEXT        NOT NULL,
    -- Giris ekraninda ve sidebar'da gosterilecek logo yolu.
    logo_path   TEXT,
    sort_order  INT         NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO companies (code, name, logo_path, sort_order) VALUES
    ('HOLDING', 'ERN Holding',  '/logo/ern-holding.png',  1),
    ('TAAHHUT', 'ERN Taahhüt',  '/logo/ern-taahhut.png',  2);

ALTER TABLE employees
    ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX employees_company_idx ON employees(company_id);

-- Mevcut personeli varsayilan olarak Holding'e bagla; bos kalmasin.
UPDATE employees
   SET company_id = (SELECT id FROM companies WHERE code = 'HOLDING')
 WHERE company_id IS NULL;

-- Departmanlar da firmaya bagli olabilir.
ALTER TABLE departments
    ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- --------------------------------------------------------------- kullanici
-- users tablosu 0001'de olusturuldu; giris icin eksik alanlari tamamliyoruz.
ALTER TABLE users
    ADD COLUMN full_name  TEXT,
    ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN last_login TIMESTAMPTZ;

-- ------------------------------------------------------------ gecis noktasi
-- Kiosk cihazlari kullanici girisi yapmaz; her cihaz kendi anahtariyla
-- taninir. Anahtar sunucuda uretilir ve cihazda bir kez saklanir.
ALTER TABLE checkpoints
    ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN last_seen_at TIMESTAMPTZ;
