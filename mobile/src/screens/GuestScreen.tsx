import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Alert, ScrollView, PermissionsAndroid, Platform } from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { globalStyles, COLORS } from '../styles';
import { BACKEND_URL } from '../config';
import { startCameraMonitoring, stopCameraMonitoring, subscribeToPhotoDetections } from '../native/CameraMonitor';

interface GuestScreenProps {
  onNavigateToGallery: () => void;
  onGoBack: () => void;
  guestEventId: string | null;
  guestParticipantName: string | null;
  onJoinSuccess: (eventId: string, name: string) => void;
  onLeaveEvent: () => void;
}

export const GuestScreen: React.FC<GuestScreenProps> = ({
  onNavigateToGallery,
  onGoBack,
  guestEventId,
  guestParticipantName,
  onJoinSuccess,
  onLeaveEvent,
}) => {
  const [manualId, setManualId] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  const handleOpenScanner = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Party Share needs access to your camera to scan the host QR code.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setShowScanner(true);
        } else {
          Alert.alert('Permission Denied', 'Camera permission is required to scan the QR code.');
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      setShowScanner(true);
    }
  };

  // Setup background camera monitoring for the Guest when joined
  useEffect(() => {
    if (!guestEventId) return;

    console.log('Starting Guest camera monitoring for event:', guestEventId);
    startCameraMonitoring(guestEventId, BACKEND_URL);

    const unsubscribe = subscribeToPhotoDetections((event) => {
      console.log('Guest detected photo event:', event);
      Alert.alert('Camera Observer', `New photo detected: ${event.path.split('/').pop()}`);
    });

    return () => {
      console.log('Stopping Guest camera monitoring');
      stopCameraMonitoring();
      unsubscribe();
    };
  }, [guestEventId]);

  // Poll for event info to update participant count once joined
  useEffect(() => {
    if (!guestEventId) return;

    let active = true;
    const fetchEventDetails = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/events/${guestEventId}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active) {
          setParticipantCount(data.participants?.length || 0);
        }
      } catch (err) {
        console.error('Error polling event info:', err);
      }
    };

    fetchEventDetails();
    const interval = setInterval(fetchEventDetails, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [guestEventId]);

  // Handle Event Join Request
  const joinEvent = async (id: string) => {
    const formattedId = id.trim();
    if (!formattedId) {
      Alert.alert('Error', 'Please enter a valid Event ID');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/events/${formattedId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found. Make sure the Event ID is correct.');
        }
        throw new Error(`Server error: status ${response.status}`);
      }

      const data = await response.json();
      console.log('Joined Event successfully:', data);

      onJoinSuccess(formattedId, data.name);
    } catch (err: any) {
      setError(err?.message || 'Failed to join event. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // Callback from QR Code barcode scanner
  const handleBarcodeScan = (event: any) => {
    // react-native-camera-kit provides barcode string in nativeEvent
    const scannedCode = event.nativeEvent.codeStringValue;
    if (scannedCode) {
      setShowScanner(false);
      joinEvent(scannedCode);
    }
  };

  // If scanner is active, render full-screen scanner view
  if (showScanner) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <Camera
          style={{ flex: 1, width: '100%', height: '100%' }}
          cameraType={CameraType.Back}
          scanBarcode={true}
          onReadCode={handleBarcodeScan}
          showFrame={false}
        />
        {/* Custom JS Overlay Frame */}
        <View style={localStyles.overlayContainer} pointerEvents="none">
          <View style={localStyles.overlaySquare} />
          <Text style={localStyles.overlayText}>Align QR code inside the box</Text>
        </View>
        <TouchableOpacity
          style={localStyles.closeScannerButton}
          onPress={() => setShowScanner(false)}
        >
          <Text style={globalStyles.buttonText}>Cancel Scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Dashboard View (if guest is already joined)
  if (guestEventId && guestParticipantName) {
    return (
      <View style={globalStyles.container}>
        <View style={globalStyles.scrollContainer}>
          <Text style={globalStyles.header}>Guest Dashboard</Text>
          <Text style={globalStyles.subtitle}>
            You are connected to the event! Photos you take with your default camera app will be shared in real time.
          </Text>

          <View style={globalStyles.badge}>
            <Text style={globalStyles.badgeText}>● Joined Successfully</Text>
          </View>

          <View style={globalStyles.card}>
            <Text style={globalStyles.infoTitle}>Your Assigned Name</Text>
            <Text style={globalStyles.infoValue}>{guestParticipantName}</Text>

            <Text style={globalStyles.infoTitle}>Connected Event ID</Text>
            <Text style={[globalStyles.infoValue, { fontSize: 15, color: COLORS.primary }]} numberOfLines={1}>
              {guestEventId}
            </Text>

            <Text style={globalStyles.infoTitle}>Total Participants</Text>
            <Text style={globalStyles.infoValue}>{participantCount}</Text>
          </View>

          <TouchableOpacity style={globalStyles.button} onPress={onNavigateToGallery}>
            <Text style={globalStyles.buttonText}>View Shared Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={globalStyles.buttonSecondary} onPress={onLeaveEvent}>
            <Text style={globalStyles.buttonSecondaryText}>Leave Event</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Join View (if not joined yet)
  return (
    <ScrollView style={globalStyles.container} contentContainerStyle={globalStyles.scrollContainer}>
      <Text style={globalStyles.header}>Join Event</Text>
      <Text style={globalStyles.subtitle}>
        Scan the host's QR code or enter the Event ID manually to join.
      </Text>

      <View style={globalStyles.card}>
        {error && (
          <Text style={{ color: COLORS.danger, marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>
            {error}
          </Text>
        )}

        {/* Scan via Camera */}
        <TouchableOpacity style={globalStyles.button} onPress={handleOpenScanner}>
          <Text style={globalStyles.buttonText}>Scan Host QR Code</Text>
        </TouchableOpacity>

        <View style={localStyles.dividerContainer}>
          <View style={localStyles.dividerLine} />
          <Text style={localStyles.dividerText}>OR</Text>
          <View style={localStyles.dividerLine} />
        </View>

        {/* Manual TextInput Entry */}
        <Text style={[globalStyles.infoTitle, { alignSelf: 'flex-start', marginBottom: 8 }]}>
          Enter Event ID
        </Text>
        <TextInput
          style={localStyles.textInput}
          placeholder="Paste UUID here..."
          placeholderTextColor={COLORS.textSecondary}
          value={manualId}
          onChangeText={setManualId}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={globalStyles.buttonSecondary}
          onPress={() => joinEvent(manualId)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textSecondary} />
          ) : (
            <Text style={globalStyles.buttonSecondaryText}>Join Manually</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={{ marginTop: 20 }} onPress={onGoBack}>
        <Text style={{ color: COLORS.textSecondary, fontWeight: '600', textDecorationLine: 'underline' }}>
          Back to Home
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  textInput: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSecondary,
    paddingHorizontal: 12,
    fontWeight: '700',
    fontSize: 13,
  },
  closeScannerButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: COLORS.danger,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  overlaySquare: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: COLORS.primary,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
});
