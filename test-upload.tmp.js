require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  console.log('url:', url);
  console.log('secret prefix:', secret ? secret.slice(0, 12) : 'MISSING');

  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { apikey: secret } },
  });

  console.log('\n--- getBucket ---');
  const bucketRes = await supabase.storage.getBucket('menu-images');
  console.log(JSON.stringify(bucketRes, null, 2));

  console.log('\n--- upload test ---');
  const buffer = Buffer.from('test-image-content');
  const uploadRes = await supabase.storage
    .from('menu-images')
    .upload(`diagnostic-test-${Date.now()}.txt`, buffer, { contentType: 'text/plain', upsert: true });
  console.log(JSON.stringify(uploadRes, null, 2));
}

main().catch((e) => console.error('THROWN:', e));
