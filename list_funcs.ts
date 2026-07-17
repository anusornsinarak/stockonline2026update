import { supabase } from './supabaseClient';

async function listFunctions() {
  const { data, error } = await supabase
    .from('information_schema.routines' as any)
    .select('routine_name')
    .eq('routine_schema', 'public');
    
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Functions:', data);
  }
}

listFunctions();
