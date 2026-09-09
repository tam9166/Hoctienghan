import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
assert.ok(['android', 'ios'].includes(target), 'usage: configure-generated.mjs android|ios');

if (target === 'android') {
  const properties = path.join(mobileRoot, 'android', 'gradle.properties');
  const manifestPath = path.join(mobileRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  assert.ok(fs.existsSync(properties) && fs.existsSync(manifestPath), 'generate Android with cap add android first');
  let props = fs.readFileSync(properties, 'utf8');
  if (!/android\.overridePathCheck=true/.test(props)) props = `${props.trimEnd()}\nandroid.overridePathCheck=true\n`;
  fs.writeFileSync(properties, props);
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const permissions = [
    'android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.POST_NOTIFICATIONS',
    'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'
  ].filter((name) => !manifest.includes(`android:name="${name}"`)).map((name) => `    <uses-permission android:name="${name}" />`).join('\n');
  if (permissions) manifest = manifest.replace('<application', `${permissions}\n\n    <application`);
  manifest = manifest.replace(/<application(?![^>]*usesCleartextTraffic)/, '<application android:usesCleartextTraffic="false"');
  if (!manifest.includes('android:scheme="com.tamhoanq.korean"')) {
    const deepLink = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="com.tamhoanq.korean" android:host="auth" android:pathPrefix="/callback" />\n            </intent-filter>`;
    manifest = manifest.replace('</activity>', `${deepLink}\n        </activity>`);
  }
  fs.writeFileSync(manifestPath, manifest);
}

if (target === 'ios') {
  const plistPath = path.join(mobileRoot, 'ios', 'App', 'App', 'Info.plist');
  assert.ok(fs.existsSync(plistPath), 'generate iOS with cap add ios first');
  let plist = fs.readFileSync(plistPath, 'utf8');
  const entries = [];
  if (!plist.includes('<key>NSCameraUsageDescription</key>')) entries.push('<key>NSCameraUsageDescription</key>\n\t<string>Quét chữ Hàn, menu và biển báo khi bạn yêu cầu.</string>');
  if (!plist.includes('<key>NSMicrophoneUsageDescription</key>')) entries.push('<key>NSMicrophoneUsageDescription</key>\n\t<string>Thu âm tạm thời để luyện phát âm và hội thoại.</string>');
  if (!plist.includes('<key>UIBackgroundModes</key>')) entries.push('<key>UIBackgroundModes</key>\n\t<array><string>audio</string></array>');
  if (!plist.includes('<string>com.tamhoanq.korean</string>')) entries.push('<key>CFBundleURLTypes</key>\n\t<array><dict><key>CFBundleURLName</key><string>com.tamhoanq.korean.auth</string><key>CFBundleURLSchemes</key><array><string>com.tamhoanq.korean</string></array></dict></array>');
  if (entries.length) plist = plist.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n\t${entries.join('\n\t')}\n</dict>\n</plist>\n`);
  fs.writeFileSync(plistPath, plist);
  fs.copyFileSync(path.join(mobileRoot, 'native', 'ios', 'PrivacyInfo.xcprivacy'), path.join(mobileRoot, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'));
}

console.log(`Configured generated ${target} project without adding credentials.`);
