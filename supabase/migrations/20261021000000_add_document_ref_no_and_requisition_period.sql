-- Migration to add document_ref_no and requisition_period to requisitions table
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS document_ref_no TEXT;
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS requisition_period TEXT;

COMMENT ON COLUMN requisitions.document_ref_no IS 'เลขที่หนังสืออ้างอิง/เลขที่หนังสือเบิก (Optional)';
COMMENT ON COLUMN requisitions.requisition_period IS 'รอบเดือนที่เบิก เช่น มกราคม 2569 (Required)';
