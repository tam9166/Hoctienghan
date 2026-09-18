import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Camera } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createClient } from '@supabase/supabase-js';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const SecureStorageAdapter = Object.freeze({
  getItem: (key) => SecureStorage.getItem(key),
  setItem: (key, value) => SecureStorage.setItem(key, value),
  removeItem: (key) => SecureStorage.removeItem(key)
});

window.KLearnNativePlugins = Object.freeze({
  App, Browser, Camera, Filesystem, Directory, Encoding,
  Haptics, ImpactStyle, LocalNotifications, Network, Preferences, PushNotifications,
  SplashScreen, StatusBar, StatusBarStyle: Style, BiometricAuth, BiometryType,
  SecureStorage, SecureStorageAdapter, createSupabaseClient: createClient
});
