import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { HostScreen } from './src/screens/HostScreen';
import { GuestScreen } from './src/screens/GuestScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { COLORS, globalStyles } from './src/styles';
import { BACKEND_URL } from './src/config';

type ScreenState = 'Home' | 'Host' | 'Guest' | 'Gallery';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenState>('Home');
  const [eventId, setEventId] = useState<string | null>(null);

  // Guest State
  const [guestEventId, setGuestEventId] = useState<string | null>(null);
  const [guestParticipantName, setGuestParticipantName] = useState<string | null>(null);

  // Host Event Creation Handler
  const handleCreateEvent = async () => {
    try {
      console.log(`Sending POST to ${BACKEND_URL}/api/events`);
      const response = await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const data = await response.json();
      console.log('Created Event details:', data);

      if (!data.id) {
        throw new Error('No eventId returned from server');
      }

      setEventId(data.id);
      setActiveScreen('Host');
    } catch (error) {
      console.error('Failed to create event:', error);
      throw error;
    }
  };

  const handleGoHome = () => {
    setEventId(null);
    setGuestEventId(null);
    setGuestParticipantName(null);
    setActiveScreen('Home');
  };

  const handleJoinSuccess = (joinedId: string, participantName: string) => {
    setGuestEventId(joinedId);
    setGuestParticipantName(participantName);
  };

  const handleLeaveEvent = () => {
    setGuestEventId(null);
    setGuestParticipantName(null);
  };

  // Render active screen
  const renderScreen = () => {
    switch (activeScreen) {
      case 'Home':
        return (
          <HomeScreen
            onCreateEvent={handleCreateEvent}
            onNavigateToJoin={() => setActiveScreen('Guest')}
          />
        );
      case 'Host':
        return (
          <HostScreen
            eventId={eventId || ''}
            onNavigateToGallery={() => setActiveScreen('Gallery')}
            onGoBack={handleGoHome}
          />
        );
      case 'Guest':
        return (
          <GuestScreen
            guestEventId={guestEventId}
            guestParticipantName={guestParticipantName}
            onJoinSuccess={handleJoinSuccess}
            onLeaveEvent={handleLeaveEvent}
            onNavigateToGallery={() => setActiveScreen('Gallery')}
            onGoBack={handleGoHome}
          />
        );
      case 'Gallery':
        return (
          <GalleryScreen
            eventId={eventId || guestEventId || ''}
            onGoBack={() => {
              if (eventId) {
                setActiveScreen('Host');
              } else if (guestEventId) {
                setActiveScreen('Guest');
              } else {
                setActiveScreen('Home');
              }
            }}
          />
        );
      default:
        return (
          <HomeScreen
            onCreateEvent={handleCreateEvent}
            onNavigateToJoin={() => setActiveScreen('Guest')}
          />
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {renderScreen()}
    </SafeAreaView>
  );
}
