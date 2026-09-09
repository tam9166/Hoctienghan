import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Camera } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { createClient } from '@supabase/supabase-js';

window.KLearnNativePlugins = Object.freeze({
  App, Browser, Camera, Filesystem, Directory, Encoding,
  LocalNotifications, Network, Preferences, PushNotifications, createSupabaseClient: createClient
});
