import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
console.log("URL:", env.VITE_SUPABASE_URL ? "Exists" : "Missing");
