import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://olfabhkhyfibanhsxwpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZmFiaGtoeWZpYmFuaHN4d3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzYwNzEsImV4cCI6MjA3MDA1MjA3MX0.6KBVmZl20SzfumzsTRy9RaRaj6ig8NZwBuOumarY8hg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    // First, let's login as a warehouse user or admin if we can? We can't without password.
    // Let's just query the pg_policies via RPC if it exists.
    const { data, error } = await supabase.rpc('get_policies' as any);
    console.log(data, error);
}
test();
