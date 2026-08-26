const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.example', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key) acc[key.trim()] = val?.trim();
  return acc;
}, {});
// Since we don't have the real env file, maybe we can run a node script inside the container using vite or tsx?
