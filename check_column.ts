import { supabase } from './supabaseClient';

async function check() {
  const { data, error } = await supabase.from('requisitions').select('approved_at').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
check();
