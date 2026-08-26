const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_product_transactions', { p_product_id: '9f2604ed-3f32-475a-a434-6330ebdeccb0', p_end_date: '2030-01-01' });
  console.log(data ? data.slice(0, 5) : error);
}
run();
