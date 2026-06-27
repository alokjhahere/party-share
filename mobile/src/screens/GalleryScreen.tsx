import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { io } from 'socket.io-client';
import { globalStyles, COLORS } from '../styles';
import { BACKEND_URL } from '../config';

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
}

export const GalleryScreen: React.FC<GalleryScreenProps> = ({ eventId, onGoBack }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      {/* Header and Back controls */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <Text style={globalStyles.header}>Event Gallery</Text>
        <Text style={globalStyles.subtitle}>
          Real-time photo stream. Photos appear automatically.
        </Text>

        <TouchableOpacity style={[globalStyles.buttonSecondary, { marginVertical: 8 }]} onPress={onGoBack}>
          <Text style={globalStyles.buttonSecondaryText}>Back to Dashboard</Text>
        </TouchableOpacity>
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
          renderItem={({ item }) => (
            <View style={localStyles.imageContainer}>
              <Image
                source={{ uri: `${BACKEND_URL}/uploads/${item.imagePath}` }}
                style={localStyles.image}
                resizeMode="cover"
              />
            </View>
          )}
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
});
