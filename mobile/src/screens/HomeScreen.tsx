import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { globalStyles, COLORS } from '../styles';

interface HomeScreenProps {
  onCreateEvent: () => Promise<void>;
  onNavigateToJoin: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onCreateEvent, onNavigateToJoin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateEvent = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCreateEvent();
    } catch (err: any) {
      setError(err?.message || 'Failed to create event. Is backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.scrollContainer}>
        <Text style={globalStyles.header}>Party Share</Text>
        <Text style={globalStyles.subtitle}>
          Real-time photo sharing MVP. Take photos with your default camera and see them instantly.
        </Text>

        <View style={globalStyles.card}>
          <Text style={[globalStyles.infoTitle, { marginBottom: 16 }]}>Get Started</Text>

          {error && (
            <Text style={{ color: COLORS.danger, marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            style={globalStyles.button}
            onPress={handleCreateEvent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={globalStyles.buttonText}>Host: Create Event</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={globalStyles.buttonSecondary}
            onPress={onNavigateToJoin}
            disabled={loading}
          >
            <Text style={globalStyles.buttonSecondaryText}>Guest: Join Event</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
