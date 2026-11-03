CREATE TABLE IF NOT EXISTS employee_microsoft_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE,
  microsoft_user_id VARCHAR(64) UNIQUE,
  upn VARCHAR(256) UNIQUE,
  account_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  license_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  mailbox_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  credential_email_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_error TEXT,
  provisioned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ms365_employee ON employee_microsoft_accounts (employee_id);
