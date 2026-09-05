-- Onboarding processes table
CREATE TABLE IF NOT EXISTS onboarding_processes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  assigned_hr       TEXT,
  buddy             TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding tasks (checklist items) per process
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_process_id UUID NOT NULL REFERENCES onboarding_processes(id) ON DELETE CASCADE,
  sequence              INT NOT NULL DEFAULT 0,
  task_name             TEXT NOT NULL,
  responsible_department TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  completed_at          TIMESTAMPTZ,
  completed_by          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Offboarding processes table
CREATE TABLE IF NOT EXISTS offboarding_processes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'initiated',
  resignation_date        DATE,
  last_working_date       DATE NOT NULL,
  reason                  TEXT,
  exit_interview_completed BOOLEAN NOT NULL DEFAULT false,
  exit_interview_notes    TEXT,
  access_revoked          BOOLEAN NOT NULL DEFAULT false,
  assets_returned         BOOLEAN NOT NULL DEFAULT false,
  final_settlement_status TEXT NOT NULL DEFAULT 'pending',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Offboarding clearance tasks per process
CREATE TABLE IF NOT EXISTS offboarding_clearance_tasks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_process_id  UUID NOT NULL REFERENCES offboarding_processes(id) ON DELETE CASCADE,
  department              TEXT NOT NULL,
  task_name               TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending',
  completed_by            TEXT,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_employee ON onboarding_processes(employee_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_employee ON offboarding_processes(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_process ON onboarding_tasks(onboarding_process_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_clearance_process ON offboarding_clearance_tasks(offboarding_process_id);
