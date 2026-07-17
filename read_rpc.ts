import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://olfabhkhyfibanhsxwpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getRpcDefinition() {
  const { data, error } = await supabase.rpc('get_function_definition', { func_name: 'process_requisition_approval' });
  if (error) {
    console.error('Error fetching RPC definition via custom RPC:', error);
  } else {
    console.log('RPC Definition:', data);
  }
}

getRpcDefinition();
