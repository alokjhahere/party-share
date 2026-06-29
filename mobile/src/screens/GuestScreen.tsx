import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Alert, ScrollView, PermissionsAndroid, Platform, Modal } from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { globalStyles, COLORS } from '../styles';
import { BACKEND_URL } from '../config';
import { startCameraMonitoring, stopCameraMonitoring, subscribeToPhotoDetections, getStringPreference, setStringPreference } from '../native/CameraMonitor';

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

  // Modal & Guest Name State
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);

  useEffect(() => {
    const loadSavedName = async () => {
      const saved = await getStringPreference('guest_name');
      if (saved) {
        setGuestName(saved);
      }
    };
    loadSavedName();
  }, []);

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

  // Handle Event Join Request - opens Name Modal
  const joinEvent = async (id: string) => {
    const formattedId = id.trim();
    if (!formattedId) {
      Alert.alert('Error', 'Please enter a valid Event ID');
      return;
    }
    setPendingEventId(formattedId);
    setNameModalVisible(true);
  };

  // Confirms and submits the join event request
  const confirmJoin = async () => {
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!pendingEventId) return;

    setLoading(true);
    setError(null);
    try {
      console.log(`Sending POST to ${BACKEND_URL}/api/events/${pendingEventId}/join with name: ${trimmedName}`);
      const response = await fetch(`${BACKEND_URL}/api/events/${pendingEventId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found. Make sure the Event ID is correct.');
        }
        if (response.status === 403) {
          throw new Error('This event is no longer active.');
        }
        throw new Error(`Server error: status ${response.status}`);
      }

      const data = await response.json();
      console.log('Joined Event successfully:', data);

      await setStringPreference('guest_name', trimmedName);
      setNameModalVisible(false);
      onJoinSuccess(pendingEventId, data.name);
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
    <>
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

      {/* Guest Name Modal */}
      <Modal
        visible={nameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>Join Event</Text>
            <Text style={localStyles.modalSubtitle}>Please enter your name so the host can identify you</Text>

            {error && (
              <Text style={localStyles.errorText}>{error}</Text>
            )}

            <TextInput
              style={localStyles.textInput}
              placeholder="Your Name (e.g. John Doe)..."
              placeholderTextColor={COLORS.textSecondary}
              value={guestName}
              onChangeText={setGuestName}
              maxLength={30}
              autoFocus={true}
            />

            <View style={localStyles.buttonRow}>
              <TouchableOpacity
                style={[globalStyles.buttonSecondary, { flex: 1, marginVertical: 0 }]}
                onPress={() => setNameModalVisible(false)}
                disabled={loading}
              >
                <Text style={globalStyles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[globalStyles.button, { flex: 1, marginVertical: 0 }]}
                onPress={confirmJoin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={globalStyles.buttonText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    ...StyleSheet.absoluteFill,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
});
