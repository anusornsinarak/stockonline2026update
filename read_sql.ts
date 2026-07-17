import fs from 'fs';
import zlib from 'zlib';

const content = fs.readFileSync('database_triggers.sql');
try {
  const decompressed = zlib.gunzipSync(content);
  console.log('Decompressed content:', decompressed.toString('utf8'));
} catch (e) {
  console.log('Not a GZIP file');
}
