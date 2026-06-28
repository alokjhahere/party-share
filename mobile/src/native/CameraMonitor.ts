import { NativeModules, PermissionsAndroid, Platform, DeviceEventEmitter } from 'react-native';

const { CameraMonitor } = NativeModules;

export interface PhotoDetectedEvent {
  path: string;
}

// Request all required Android runtime permissions
export async function requestCameraMonitorPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const permissionsToRequest = [
      PermissionsAndroid.PERMISSIONS.CAMERA,
    ];

    // Check Android SDK level for storage permissions
    const sdkVersion = Platform.Version as number;
    
    if (sdkVersion >= 33) {
      permissionsToRequest.push(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        // Post notifications permission is required for Android 13+ foreground services
        'android.permission.POST_NOTIFICATIONS' as any
      );
    } else {
      permissionsToRequest.push(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
    }

    const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);
    
    const allGranted = Object.values(granted).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED
    );
    
    console.log('Permissions request results:', granted, 'allGranted:', allGranted);
    return allGranted;
  } catch (err) {
    console.warn('Error requesting permissions:', err);
    return false;
  }
}

// Start Camera Live Monitoring Service
export async function startCameraMonitoring(
  eventId: string,
  backendUrl: string,
  startTimeMs: number = Date.now()
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const permissionsGranted = await requestCameraMonitorPermissions();
  if (!permissionsGranted) {
    console.warn('Cannot start camera monitoring: permissions not granted');
    return false;
  }

  try {
    CameraMonitor.startMonitoring(eventId, backendUrl, startTimeMs);
    return true;
  } catch (error) {
    console.error('Failed to start native camera monitoring service:', error);
    return false;
  }
}

// Stop Camera Live Monitoring Service
export function stopCameraMonitoring(): void {
  if (Platform.OS !== 'android') return;
  try {
    CameraMonitor.stopMonitoring();
  } catch (error) {
    console.error('Failed to stop native camera monitoring service:', error);
  }
}

// Query running status
export async function isCameraMonitoring(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await CameraMonitor.isMonitoring();
  } catch (error) {
    console.error('Failed to query service status:', error);
    return false;
  }
}

// Subscribe to new photo detection events
export function subscribeToPhotoDetections(callback: (event: PhotoDetectedEvent) => void) {
  const subscription = DeviceEventEmitter.addListener('onPhotoDetected', callback);
  return () => {
    subscription.remove();
  };
}

// Save a remote photo to the device gallery
export async function savePhotoToLocalGallery(imageUrl: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await CameraMonitor.saveImageToGallery(imageUrl);
    console.log('Saved photo to native gallery:', result);
    return true;
  } catch (error) {
    console.error('Failed to save photo to native gallery:', error);
    return false;
  }
}

// Save the auto-save configuration preference
export async function setAutoSavePreference(enabled: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await CameraMonitor.setAutoSavePreference(enabled);
  } catch (error) {
    console.error('Failed to save auto-save preference:', error);
  }
}

// Get the saved auto-save configuration preference
export async function getAutoSavePreference(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await CameraMonitor.getAutoSavePreference();
  } catch (error) {
    console.error('Failed to load auto-save preference:', error);
    return false;
  }
}
