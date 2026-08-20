-- PTS - Personel Kontrol Sistemi
-- Cekirdek sema: personel, ArUco kart eslesmesi, mesai, izin, vardiya.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- departman
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- personel
CREATE TABLE employees (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_no    TEXT        NOT NULL UNIQUE,      -- sicil numarasi
    first_name     TEXT        NOT NULL,
    last_name      TEXT        NOT NULL,
    national_id    TEXT        UNIQUE,               -- TC kimlik no
    email          TEXT        UNIQUE,
    phone          TEXT,
    title          TEXT,
    department_id  UUID        REFERENCES departments(id) ON DELETE SET NULL,
    hired_on       DATE        NOT NULL,
    terminated_on  DATE,
    annual_leave_entitlement_days INT NOT NULL DEFAULT 14,
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX employees_department_idx ON employees(department_id);
CREATE INDEX employees_active_idx     ON employees(is_active);

-- ------------------------------------------------------------ ArUco kartlar
-- Bir personelin ayni anda tek aktif karti olur; kart kaybolursa eskisi
-- revoked_at ile kapatilir, yeni marker_id ile yeni satir acilir.
CREATE TABLE aruco_cards (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marker_id    INT         NOT NULL,               -- sozlukteki ArUco ID
    dictionary   TEXT        NOT NULL DEFAULT 'ARUCO_MIP_36h12',
    employee_id  UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at   TIMESTAMPTZ
);

-- Ayni sozlukte ayni marker_id yalnizca bir kez aktif olabilir.
CREATE UNIQUE INDEX aruco_cards_active_marker_idx
    ON aruco_cards(dictionary, marker_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX aruco_cards_active_employee_idx
    ON aruco_cards(employee_id) WHERE revoked_at IS NULL;

-- ------------------------------------------------------------------- nokta
-- Kart okutulan fiziksel gecis noktasi (kapi, turnike, kiosk).
CREATE TABLE checkpoints (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT        NOT NULL UNIQUE,          -- ornek: ANA-GIRIS
    name       TEXT        NOT NULL,
    api_key    TEXT        NOT NULL UNIQUE,          -- kiosk cihazinin kimligi
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------- giris-cikis kaydi
CREATE TYPE attendance_direction AS ENUM ('in', 'out');

CREATE TABLE attendance_events (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    checkpoint_id UUID        REFERENCES checkpoints(id) ON DELETE SET NULL,
    direction     attendance_direction NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    marker_id     INT,                                -- okunan ham ArUco ID
    is_manual     BOOLEAN     NOT NULL DEFAULT FALSE, -- yonetici elle girdiyse
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX attendance_employee_time_idx ON attendance_events(employee_id, occurred_at DESC);
CREATE INDEX attendance_time_idx          ON attendance_events(occurred_at DESC);

-- ----------------------------------------------------------------- vardiya
CREATE TABLE shifts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL UNIQUE,      -- ornek: Gunduz 08-17
    starts_at      TIME        NOT NULL,
    ends_at        TIME        NOT NULL,
    break_minutes  INT         NOT NULL DEFAULT 60,
    grace_minutes  INT         NOT NULL DEFAULT 10,  -- gec kalma toleransi
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personelin belirli bir gundeki vardiya atamasi.
CREATE TABLE shift_assignments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id     UUID NOT NULL REFERENCES shifts(id)    ON DELETE CASCADE,
    work_date    DATE NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, work_date)
);

CREATE INDEX shift_assignments_date_idx ON shift_assignments(work_date);

-- -------------------------------------------------------------------- izin
CREATE TYPE leave_type   AS ENUM ('annual', 'sick', 'excuse', 'unpaid', 'maternity');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE leave_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type   leave_type   NOT NULL,
    status       leave_status NOT NULL DEFAULT 'pending',
    starts_on    DATE        NOT NULL,
    ends_on      DATE        NOT NULL,
    reason       TEXT,
    decided_by   UUID        REFERENCES employees(id) ON DELETE SET NULL,
    decided_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_on >= starts_on)
);

CREATE INDEX leave_requests_employee_idx ON leave_requests(employee_id, starts_on DESC);
CREATE INDEX leave_requests_status_idx   ON leave_requests(status);

-- ----------------------------------------------------------- panel kullanici
CREATE TYPE user_role AS ENUM ('admin', 'hr', 'manager', 'viewer');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role          user_role   NOT NULL DEFAULT 'viewer',
    employee_id   UUID        REFERENCES employees(id) ON DELETE SET NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
