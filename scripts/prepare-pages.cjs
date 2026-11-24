// Build an isolated static artifact from public site files and public CI variables.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const destination = path.resolve(process.argv[2] || path.join(root,'dist'));
const url = (process.env.CAMPUSSTAY_SUPABASE_URL || '').trim();
const key = (process.env.CAMPUSSTAY_SUPABASE_PUBLISHABLE_KEY || '').trim();
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) {
  throw new Error('Set the original project URL and a Supabase publishable browser key in the Pages build variables.');
}
fs.mkdirSync(destination); // Refuse to overwrite another build or a working directory.
for (const file of fs.readdirSync(root)) {
  if (file.endsWith('.html') && !file.endsWith('-test.html')) fs.copyFileSync(path.join(root,file),path.join(destination,file));
}
for (const folder of ['js','css']) {
  fs.cpSync(path.join(root,folder),path.join(destination,folder),{recursive:true,
    filter:source => fs.statSync(source).isDirectory() || (/\.(js|css)$/.test(source) && !/runtime-config(\.example)?\.js$/.test(source))});
}
fs.writeFileSync(path.join(destination,'js/runtime-config.js'),
  'window.CAMPUSSTAY_RUNTIME_CONFIG = Object.freeze('+JSON.stringify({supabaseUrl:url,supabasePublishableKey:key})+');\n');
console.log('Prepared static Pages artifact with public browser configuration.');
