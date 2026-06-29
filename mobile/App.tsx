import React, { useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { HostScreen } from './src/screens/HostScreen';
import { GuestScreen } from './src/screens/GuestScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { PastEventsScreen } from './src/screens/PastEventsScreen';
import { COLORS } from './src/styles';
import { BACKEND_URL } from './src/config';
import { getStringPreference, setStringPreference } from './src/native/CameraMonitor';

type ScreenState = 'Home' | 'Host' | 'Guest' | 'Gallery' | 'PastEvents';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenState>('Home');
  const [eventId, setEventId] = useState<string | null>(null);

  // Guest State
  const [guestEventId, setGuestEventId] = useState<string | null>(null);
  const [guestParticipantName, setGuestParticipantName] = useState<string | null>(null);

  // Helper to add a created/joined event to history list in local storage
  const addEventToHistory = async (id: string, name: string, role: 'host' | 'guest') => {
    try {
      const currentHistoryStr = await getStringPreference('past_events');
      let history = [];
      if (currentHistoryStr) {
        try {
          history = JSON.parse(currentHistoryStr);
          if (!Array.isArray(history)) {
            history = [];
          }
        } catch (e) {
          history = [];
        }
      }
      
      // Prevent duplicates
      if (!history.some((e: any) => e.id === id)) {
        history.push({
          id,
          name,
          role,
          date: new Date().toISOString(),
        });
        await setStringPreference('past_events', JSON.stringify(history));
        console.log(`Saved event to history locally: ${name} (${id})`);
      }
    } catch (err) {
      console.error('Failed to add event to local history:', err);
    }
  };

  // Host Event Creation Handler
  const handleCreateEvent = async (eventName: string) => {
    try {
      console.log(`Sending POST to ${BACKEND_URL}/api/events with name: ${eventName}`);
      const response = await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: eventName }),
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
      await addEventToHistory(data.id, data.name || 'Hosted Event', 'host');
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

  const handleJoinSuccess = async (joinedId: string, participantName: string) => {
    setGuestEventId(joinedId);
    setGuestParticipantName(participantName);
    setActiveScreen('Guest');

    // Retrieve event details to add actual name to local storage
    try {
      const response = await fetch(`${BACKEND_URL}/api/events/${joinedId}`);
      if (response.ok) {
        const data = await response.json();
        await addEventToHistory(joinedId, data.name || 'Joined Event', 'guest');
      } else {
        await addEventToHistory(joinedId, 'Joined Event', 'guest');
      }
    } catch (err) {
      await addEventToHistory(joinedId, 'Joined Event', 'guest');
    }
  };

  const handleLeaveEvent = () => {
    setGuestEventId(null);
    setGuestParticipantName(null);
    setActiveScreen('Home');
  };

  // Render active screen
  const renderScreen = () => {
    switch (activeScreen) {
      case 'Home':
        return (
          <HomeScreen
            onCreateEvent={handleCreateEvent}
            onNavigateToJoin={() => setActiveScreen('Guest')}
            onNavigateToPastEvents={() => setActiveScreen('PastEvents')}
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
      case 'PastEvents':
        return (
          <PastEventsScreen
            onSelectEvent={(selectedId) => {
              setGuestEventId(selectedId);
              setEventId(null); // Mark as non-host mode
              setGuestParticipantName(null); // Mark as history reader mode
              setActiveScreen('Gallery');
            }}
            onGoBack={handleGoHome}
          />
        );
      case 'Gallery':
        return (
          <GalleryScreen
            eventId={eventId || guestEventId || ''}
            onKickToHome={handleGoHome}
            onGoBack={() => {
              if (eventId) {
                setActiveScreen('Host');
              } else if (guestEventId) {
                if (guestParticipantName) {
                  setActiveScreen('Guest');
                } else {
                  setActiveScreen('PastEvents');
                }
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
            onNavigateToPastEvents={() => setActiveScreen('PastEvents')}
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
