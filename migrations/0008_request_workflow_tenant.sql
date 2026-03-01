-- Migration 0008: Add tenant context to request workflow records (Slice 3.1)

ALTER TABLE request_workflow_requests ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_rwr_tenant_principal ON request_workflow_requests(tenant_id, principal_id);
