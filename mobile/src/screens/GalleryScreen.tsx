import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, Dimensions, StyleSheet, Modal, TouchableWithoutFeedback, Alert, Switch } from 'react-native';
import { io } from 'socket.io-client';
import { globalStyles, COLORS } from '../styles';
import { BACKEND_URL } from '../config';
import { 
  savePhotoToLocalGallery, 
  setAutoSavePreference, 
  getAutoSavePreference 
} from '../native/CameraMonitor';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3;

interface Photo {
  id: string;
  eventId: string;
  imagePath: string;
  createdAt: string;
}

interface GalleryScreenProps {
  eventId: string;
  onGoBack: () => void;
  onKickToHome?: () => void;
}

export const GalleryScreen: React.FC<GalleryScreenProps> = ({ eventId, onGoBack, onKickToHome }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Auto-save and download states
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [savingSingle, setSavingSingle] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingSelected, setDownloadingSelected] = useState(false);

  // Ref to always access the latest autoSaveEnabled value in the socket listener
  const autoSaveEnabledRef = useRef(autoSaveEnabled);
  useEffect(() => {
    autoSaveEnabledRef.current = autoSaveEnabled;
  }, [autoSaveEnabled]);

  // Load saved preference on mount
  useEffect(() => {
    const loadPref = async () => {
      const pref = await getAutoSavePreference();
      setAutoSaveEnabled(pref);
    };
    loadPref();
  }, []);

  const handleToggleAutoSave = async (value: boolean) => {
    setAutoSaveEnabled(value);
    await setAutoSavePreference(value);
  };

  const handleSavePhoto = async () => {
    if (!selectedPhoto) return;
    setSavingSingle(true);
    const success = await savePhotoToLocalGallery(selectedPhoto);
    setSavingSingle(false);
    if (success) {
      Alert.alert('Saved!', 'The photo has been saved to your gallery inside the "PartyShare" folder.');
    } else {
      Alert.alert('Error', 'Failed to save the photo to your gallery.');
    }
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) return;
    setDownloadingAll(true);
    let successCount = 0;
    for (const photo of photos) {
      const url = `${BACKEND_URL}/uploads/${photo.imagePath}`;
      const success = await savePhotoToLocalGallery(url);
      if (success) successCount++;
    }
    setDownloadingAll(false);
    Alert.alert('Download Complete', `Saved ${successCount} of ${photos.length} photos to your gallery folder "PartyShare".`);
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotoIds.length === 0) return;
    setDownloadingSelected(true);
    let successCount = 0;
    for (const id of selectedPhotoIds) {
      const photo = photos.find(p => p.id === id);
      if (photo) {
        const url = `${BACKEND_URL}/uploads/${photo.imagePath}`;
        const success = await savePhotoToLocalGallery(url);
        if (success) successCount++;
      }
    }
    setDownloadingSelected(false);
    setSelectedPhotoIds([]);
    setSelectMode(false);
    Alert.alert('Download Complete', `Successfully saved ${successCount} of ${selectedPhotoIds.length} selected photos.`);
  };

  const handleToggleSelectPhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      if (prev.includes(photoId)) {
        return prev.filter((id) => id !== photoId);
      } else {
        return [...prev, photoId];
      }
    });
  };

  // Setup Socket.IO subscription for new photo events
  useEffect(() => {
    console.log('Connecting to Socket.IO server at:', BACKEND_URL);
    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      console.log('Socket.IO connected. Joining event room:', eventId);
      socket.emit('join-event', { eventId });
    });

    socket.on('new-photo', (newPhoto: Photo) => {
      console.log('Socket received new-photo event:', newPhoto);
      // Prepend the new photo so it instantly displays at the top of the grid
      setPhotos((prev) => {
        // Prevent duplication if REST API fetch overlaps with the socket broadcast
        if (prev.some((p) => p.id === newPhoto.id)) return prev;
        return [newPhoto, ...prev];
      });

      // Auto-save if enabled
      if (autoSaveEnabledRef.current) {
        const url = `${BACKEND_URL}/uploads/${newPhoto.imagePath}`;
        console.log('Auto-saving new incoming photo:', url);
        savePhotoToLocalGallery(url);
      }
    });

    socket.on('event-ended', () => {
      console.log('Socket received event-ended event');
      Alert.alert('Event Ended', 'The host has ended this event. Auto-upload of new photos is now stopped.');
    });

    socket.on('event-deleted', () => {
      console.log('Socket received event-deleted event');
      Alert.alert('Event Deleted', 'The host has deleted this event. You will be redirected to the Home screen.', [
        { text: 'OK', onPress: () => { if (onKickToHome) onKickToHome(); else onGoBack(); } }
      ]);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
    });

    return () => {
      console.log('Cleaning up Socket.IO subscription');
      socket.disconnect();
    };
  }, [eventId]);

  // Poll for photos list every 5 seconds as a fallback
  useEffect(() => {
    let active = true;

    const fetchPhotos = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/events/${eventId}/photos`);
        if (!response.ok) {
          throw new Error('Failed to load photos');
        }
        const data = await response.json();
        if (active) {
          setPhotos(data);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Fetch photos error:', err);
        if (active) {
          setError('Could not reach backend server');
          setLoading(false);
        }
      }
    };

    fetchPhotos();
    const interval = setInterval(fetchPhotos, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [eventId]);

  return (
    <View style={[globalStyles.container, { paddingHorizontal: 0 }]}>
      {/* Header and controls */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        {selectMode ? (
          <View>
            <Text style={globalStyles.header}>Selecting Photos</Text>
            <Text style={globalStyles.subtitle}>
              {selectedPhotoIds.length} photo{selectedPhotoIds.length !== 1 ? 's' : ''} selected
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8 }}>
              <TouchableOpacity 
                style={[globalStyles.button, { flex: 1, height: 44, marginVertical: 0 }]} 
                onPress={handleDownloadSelected}
                disabled={selectedPhotoIds.length === 0 || downloadingSelected}
              >
                {downloadingSelected ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={globalStyles.buttonText}>Download ({selectedPhotoIds.length})</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[globalStyles.buttonSecondary, { flex: 1, height: 44, marginVertical: 0 }]} 
                onPress={() => {
                  setSelectMode(false);
                  setSelectedPhotoIds([]);
                }}
              >
                <Text style={globalStyles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <Text style={globalStyles.header}>Event Gallery</Text>
            <Text style={globalStyles.subtitle}>
              Real-time photo stream. Photos appear automatically.
            </Text>

            <TouchableOpacity style={[globalStyles.buttonSecondary, { marginVertical: 8 }]} onPress={onGoBack}>
              <Text style={globalStyles.buttonSecondaryText}>Back to Dashboard</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <TouchableOpacity 
                style={[globalStyles.button, { flex: 1, height: 40, marginVertical: 0 }]} 
                onPress={() => setSelectMode(true)}
                disabled={photos.length === 0}
              >
                <Text style={globalStyles.buttonText}>Select Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[globalStyles.buttonSecondary, { flex: 1, height: 40, marginVertical: 0 }]} 
                onPress={handleDownloadAll}
                disabled={photos.length === 0 || downloadingAll}
              >
                {downloadingAll ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Text style={globalStyles.buttonSecondaryText}>Download All</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={localStyles.settingsRow}>
              <Text style={localStyles.settingsText}>Auto-save new photos to gallery</Text>
              <Switch
                value={autoSaveEnabled}
                onValueChange={handleToggleAutoSave}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={autoSaveEnabled ? '#ffffff' : '#f4f3f4'}
              />
            </View>
          </View>
        )}
      </View>

      {error && (
        <Text style={{ color: COLORS.danger, marginHorizontal: 24, marginVertical: 12, fontWeight: '600', textAlign: 'center' }}>
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 12 }}
          renderItem={({ item }) => {
            const isSelected = selectedPhotoIds.includes(item.id);
            return (
              <TouchableOpacity
                style={localStyles.imageContainer}
                onPress={() => {
                  if (selectMode) {
                    handleToggleSelectPhoto(item.id);
                  } else {
                    setSelectedPhoto(`${BACKEND_URL}/uploads/${item.imagePath}`);
                  }
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: `${BACKEND_URL}/uploads/${item.imagePath}` }}
                  style={[
                    localStyles.image,
                    isSelected && { borderColor: COLORS.primary, borderWidth: 3 }
                  ]}
                  resizeMode="cover"
                />
                {selectMode && (
                  <View style={[
                    localStyles.checkbox,
                    isSelected && { backgroundColor: COLORS.primary }
                  ]}>
                    {isSelected && <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 60 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', fontWeight: '500' }}>
                📸 No photos captured yet.
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
                Any photo you capture with the default camera app after joining this event will appear here automatically!
              </Text>
            </View>
          }
        />
      )}

      {/* Full-screen Photo Viewer Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent={true}
        onRequestClose={() => setSelectedPhoto(null)}
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={() => setSelectedPhoto(null)}>
          <View style={localStyles.modalContainer}>
            <View style={localStyles.modalContent}>
              {selectedPhoto && (
                <Image
                  source={{ uri: selectedPhoto }}
                  style={localStyles.fullImage}
                  resizeMode="contain"
                />
              )}
              <TouchableOpacity
                style={localStyles.closeButton}
                onPress={() => setSelectedPhoto(null)}
              >
                <Text style={localStyles.closeButtonText}>✕ Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={localStyles.saveButton}
                onPress={handleSavePhoto}
                disabled={savingSingle}
              >
                {savingSingle ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={localStyles.saveButtonText}>📥 Save to Gallery</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const localStyles = StyleSheet.create({
  imageContainer: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    padding: 2,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullImage: {
    width: '95%',
    height: '85%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingsText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
