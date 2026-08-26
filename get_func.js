const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_product_transactions', { p_product_id: '...', p_end_date: '2030-01-01' });
  console.log(data);
}
run();
