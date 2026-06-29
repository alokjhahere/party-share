import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { globalStyles, COLORS } from '../styles';
import { BACKEND_URL } from '../config';
import { startCameraMonitoring, stopCameraMonitoring, subscribeToPhotoDetections } from '../native/CameraMonitor';

interface Participant {
  id: string;
  name: string;
}

interface HostScreenProps {
  eventId: string;
  onNavigateToGallery: () => void;
  onGoBack: () => void;
}

export const HostScreen: React.FC<HostScreenProps> = ({ eventId, onNavigateToGallery, onGoBack }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('Loading Event...');
  const [isActive, setIsActive] = useState(true);

  // Setup background camera monitoring for the Host
  useEffect(() => {
    if (!eventId || !isActive) return;

    console.log('Starting Host camera monitoring for event:', eventId);
    startCameraMonitoring(eventId, BACKEND_URL);

    const unsubscribe = subscribeToPhotoDetections((event) => {
      console.log('Host detected photo event:', event);
      Alert.alert('Camera Observer', `New photo detected: ${event.path.split('/').pop()}`);
    });

    return () => {
      console.log('Stopping Host camera monitoring');
      stopCameraMonitoring();
      unsubscribe();
    };
  }, [eventId, isActive]);

  // Poll for participants list every 5 seconds since Socket.IO real-time join updates aren't active yet
  useEffect(() => {
    let active = true;

    const fetchParticipants = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/events/${eventId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch event info');
        }
        const data = await response.json();
        if (active) {
          setEventName(data.name || 'Hosting Event');
          setIsActive(data.isActive !== undefined ? data.isActive : true);
          setParticipants(data.participants || []);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Fetch participants error:', err);
      }
    };

    fetchParticipants();
    const interval = setInterval(fetchParticipants, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [eventId]);

  const handleCopyEventId = () => {
    // Basic fallback alert showing eventId
    Alert.alert('Event ID', eventId);
  };

  const handleEndEvent = () => {
    Alert.alert(
      'End Event',
      'Are you sure you want to end this event? Auto-upload of new photos will stop for all guests.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Event',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/events/${eventId}/end`, {
                method: 'POST',
              });
              if (!response.ok) throw new Error('Failed to end event');
              setIsActive(false);
              Alert.alert('Event Ended', 'Automatic uploads are now disabled.');
            } catch (err) {
              Alert.alert('Error', 'Could not reach backend to end the event.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteEvent = () => {
    Alert.alert(
      'DELETE ALL DATA',
      'WARNING: This will permanently delete the event and all associated photos from the server. This cannot be undone. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/events/${eventId}`, {
                method: 'DELETE',
              });
              if (!response.ok) throw new Error('Failed to delete event');
              Alert.alert('Success', 'Event and photo data have been deleted.', [
                { text: 'OK', onPress: onGoBack }
              ]);
            } catch (err) {
              Alert.alert('Error', 'Could not reach backend to delete data.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={globalStyles.container}>
      <FlatList
        data={participants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 20, alignItems: 'center' }}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text style={globalStyles.header}>{eventName}</Text>
            <Text style={globalStyles.subtitle}>
              Host Dashboard (ID: {eventId})
            </Text>

            {isActive ? (
              <View style={globalStyles.badge}>
                <Text style={globalStyles.badgeText}>● Live Monitoring Active</Text>
              </View>
            ) : (
              <View style={[globalStyles.badge, { borderColor: COLORS.textSecondary, backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                <Text style={[globalStyles.badgeText, { color: COLORS.textSecondary }]}>● Event Ended</Text>
              </View>
            )}

            <View style={globalStyles.qrContainer}>
              {eventId ? (
                <QRCode value={eventId} size={200} quietZone={10} color={COLORS.background} />
              ) : (
                <ActivityIndicator color={COLORS.primary} size="large" />
              )}
            </View>

            <View style={[globalStyles.card, { alignItems: 'flex-start' }]}>
              <Text style={globalStyles.infoTitle}>Event ID</Text>
              <TouchableOpacity onPress={handleCopyEventId} style={{ width: '100%' }}>
                <Text style={[globalStyles.infoValue, { color: COLORS.primary }]} numberOfLines={1} ellipsizeMode="middle">
                  {eventId}
                </Text>
              </TouchableOpacity>

              <Text style={globalStyles.infoTitle}>Total Participants</Text>
              <Text style={globalStyles.infoValue}>{participants.length}</Text>
            </View>

            <TouchableOpacity style={globalStyles.button} onPress={onNavigateToGallery}>
              <Text style={globalStyles.buttonText}>View Shared Gallery</Text>
            </TouchableOpacity>

            {isActive && (
              <TouchableOpacity style={[globalStyles.buttonSecondary, { borderColor: COLORS.primary }]} onPress={handleEndEvent}>
                <Text style={[globalStyles.buttonSecondaryText, { color: COLORS.primary }]}>End Event</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[globalStyles.buttonSecondary, { borderColor: COLORS.danger }]} onPress={handleDeleteEvent}>
              <Text style={[globalStyles.buttonSecondaryText, { color: COLORS.danger }]}>Delete Event & All Data</Text>
            </TouchableOpacity>

            <TouchableOpacity style={globalStyles.buttonSecondary} onPress={onGoBack}>
              <Text style={globalStyles.buttonSecondaryText}>Exit Dashboard</Text>
            </TouchableOpacity>

            <Text style={globalStyles.listHeader}>
              Connected Guests ({participants.length})
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={globalStyles.participantItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={globalStyles.participantIndex}>{index + 1}</Text>
              <Text style={globalStyles.participantText}>{item.name}</Text>
            </View>
            <Text style={{ color: COLORS.success, fontSize: 13, fontWeight: '600' }}>Connected</Text>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: COLORS.textSecondary, fontStyle: 'italic', marginVertical: 20, textAlign: 'center' }}>
              No guests connected yet.
            </Text>
          ) : (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          )
        }
      />
    </View>
  );
};
