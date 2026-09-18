import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(mobileRoot, '..');
const target = process.argv[2];
assert.ok(['android', 'ios'].includes(target), 'usage: configure-generated.mjs android|ios');
const release = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const versionName = String(release.version || '1.0.0').replace(/[^0-9A-Za-z.+-]/g, '');
const buildNumber = Math.max(1, Number(process.env.MOBILE_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || 1));

if (target === 'android') {
  const properties = path.join(mobileRoot, 'android', 'gradle.properties');
  const manifestPath = path.join(mobileRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const gradlePath = path.join(mobileRoot, 'android', 'app', 'build.gradle');
  assert.ok(fs.existsSync(properties) && fs.existsSync(manifestPath) && fs.existsSync(gradlePath), 'generate Android with cap add android first');
  let props = fs.readFileSync(properties, 'utf8');
  if (!/android\.overridePathCheck=true/.test(props)) props = `${props.trimEnd()}\nandroid.overridePathCheck=true\n`;
  fs.writeFileSync(properties, props);
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const permissions = [
    'android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.POST_NOTIFICATIONS',
    'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.USE_BIOMETRIC', 'android.permission.ACCESS_NETWORK_STATE'
  ].filter((name) => !manifest.includes(`android:name="${name}"`)).map((name) => `    <uses-permission android:name="${name}" />`).join('\n');
  if (permissions) manifest = manifest.replace('<application', `${permissions}\n\n    <application`);
  manifest = manifest.replace(/<application(?![^>]*usesCleartextTraffic)/, '<application android:usesCleartextTraffic="false"');
  if (!manifest.includes('android:scheme="com.tamhoanq.korean" android:host="auth"')) {
    const deepLink = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="com.tamhoanq.korean" android:host="auth" android:pathPrefix="/callback" />\n            </intent-filter>`;
    manifest = manifest.replace('</activity>', `${deepLink}\n        </activity>`);
  }
  if (!manifest.includes('android:scheme="tamhoanq"')) {
    const learningLinks = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="tamhoanq" />\n                <data android:scheme="com.tamhoanq.korean" />\n            </intent-filter>`;
    manifest = manifest.replace('</activity>', `${learningLinks}\n        </activity>`);
  }
  fs.writeFileSync(manifestPath, manifest);
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`).replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
  fs.writeFileSync(gradlePath, gradle);
}

if (target === 'ios') {
  const plistPath = path.join(mobileRoot, 'ios', 'App', 'App', 'Info.plist');
  assert.ok(fs.existsSync(plistPath), 'generate iOS with cap add ios first');
  let plist = fs.readFileSync(plistPath, 'utf8');
  const entries = [];
  if (!plist.includes('<key>NSCameraUsageDescription</key>')) entries.push('<key>NSCameraUsageDescription</key>\n\t<string>Quét chữ Hàn, menu và biển báo khi bạn yêu cầu.</string>');
  if (!plist.includes('<key>NSMicrophoneUsageDescription</key>')) entries.push('<key>NSMicrophoneUsageDescription</key>\n\t<string>Thu âm tạm thời để luyện phát âm và hội thoại.</string>');
  if (!plist.includes('<key>NSFaceIDUsageDescription</key>')) entries.push('<key>NSFaceIDUsageDescription</key>\n\t<string>Dùng Face ID để mở lại phiên học đã đăng nhập trên thiết bị này.</string>');
  if (!plist.includes('<key>UIBackgroundModes</key>')) entries.push('<key>UIBackgroundModes</key>\n\t<array><string>audio</string></array>');
  if (!plist.includes('<string>com.tamhoanq.korean</string>')) entries.push('<key>CFBundleURLTypes</key>\n\t<array><dict><key>CFBundleURLName</key><string>com.tamhoanq.korean.links</string><key>CFBundleURLSchemes</key><array><string>com.tamhoanq.korean</string><string>tamhoanq</string></array></dict></array>');
  if (!plist.includes('<key>NSAppTransportSecurity</key>')) entries.push('<key>NSAppTransportSecurity</key>\n\t<dict><key>NSAllowsArbitraryLoads</key><false/></dict>');
  if (entries.length) plist = plist.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n\t${entries.join('\n\t')}\n</dict>\n</plist>\n`);
  plist = plist.replace(/(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/, `$1${versionName}$2`);
  plist = plist.replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/, `$1${buildNumber}$2`);
  fs.writeFileSync(plistPath, plist);
  fs.copyFileSync(path.join(mobileRoot, 'native', 'ios', 'PrivacyInfo.xcprivacy'), path.join(mobileRoot, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'));
}

console.log(`Configured generated ${target} project without adding credentials.`);
