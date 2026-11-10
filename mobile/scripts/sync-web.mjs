// Copy the customer web app (repo root) into mobile/www, the folder Capacitor bundles into the iOS app.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const www = join(here, '..', 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const p of ['index.html', 'manifest.webmanifest', 'css', 'js', 'img']) {
  if (!existsSync(join(root, p))) throw new Error('missing ' + p);
  cpSync(join(root, p), join(www, p), { recursive: true });
}
console.log('web app copied to mobile/www (no service worker: the app ships its files)');

// Google sign-in in the app needs the reversed iOS client ID as a URL scheme in Info.plist.
import { readFileSync, writeFileSync } from 'node:fs';
const cfg = readFileSync(join(root, 'js', 'config.js'), 'utf8');
const gid = (cfg.match(/GOOGLE_IOS_CLIENT_ID\s*=\s*'([^']*)'/) || [])[1] || '';
const plistPath = join(here, '..', 'ios', 'App', 'App', 'Info.plist');
if (existsSync(plistPath)) {
  let plist = readFileSync(plistPath, 'utf8');
  plist = plist.replace(/\s*<key>CFBundleURLTypes<\/key>\s*<array>[\s\S]*?<\/array>(?=\s*<key>|\s*<\/dict>\s*<\/plist>)/, '');
  if (gid) {
    const scheme = 'com.googleusercontent.apps.' + gid.replace(/\.apps\.googleusercontent\.com$/, '');
    plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${scheme}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>\n`);
    console.log('Google URL scheme set:', scheme);
  }
  writeFileSync(plistPath, plist);
}
