ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
UPDATE requisitions SET approved_at = submitted_at WHERE status IN ('Ready', 'Completed', 'PartiallyApproved');
