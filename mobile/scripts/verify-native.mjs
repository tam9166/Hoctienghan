import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(mobileRoot, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageJson = JSON.parse(read('mobile/package.json'));
const capacitor = JSON.parse(read('mobile/capacitor.config.json'));
const contract = JSON.parse(read('mobile/mobile-app.config.json'));

assert.equal(packageJson.dependencies['@capacitor/core'].split('.')[0], packageJson.devDependencies['@capacitor/cli'].split('.')[0]);
assert.equal(packageJson.dependencies['@capacitor/android'], packageJson.dependencies['@capacitor/ios']);
assert.equal(capacitor.appId, contract.appId);
assert.equal(capacitor.webDir, 'www');
assert.equal(capacitor.android.allowMixedContent, false);
assert.ok(fs.existsSync(path.join(mobileRoot, 'www/index.html')), 'run npm run build first');
const builtIndex = fs.readFileSync(path.join(mobileRoot, 'www/index.html'), 'utf8');
assert.match(builtIndex, /mobile-runtime-config\.js/);
assert.match(builtIndex, /mobile-native-plugins\.js/);
assert.match(read('data/platform-runtime.js'), /Only application API paths are allowed/);
assert.match(read('data/mobile-native.js'), /exchangeCodeForSession/);
assert.match(read('supabase/migrations/20260909_mobile_native_ecosystem.sql'), /mobile_push_devices/);
console.log('P56 native doctor: Capacitor versions, web bundle, API boundary, deep-link auth and push storage contract passed');
