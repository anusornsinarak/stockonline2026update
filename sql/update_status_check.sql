ALTER TABLE requisitions DROP CONSTRAINT IF EXISTS requisitions_status_check;
ALTER TABLE requisitions ADD CONSTRAINT requisitions_status_check CHECK (status IN ('Draft', 'Submitted', 'PartiallyApproved', 'Rejected', 'Ready', 'Completed', 'Picking', 'Cancelled'));
