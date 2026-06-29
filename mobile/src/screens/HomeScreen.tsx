import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, TextInput, StyleSheet } from 'react-native';
import { globalStyles, COLORS } from '../styles';

interface HomeScreenProps {
  onCreateEvent: (eventName: string) => Promise<void>;
  onNavigateToJoin: () => void;
  onNavigateToPastEvents: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onCreateEvent,
  onNavigateToJoin,
  onNavigateToPastEvents,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [eventName, setEventName] = useState('');

  const handleOpenCreateModal = () => {
    setEventName('');
    setError(null);
    setModalVisible(true);
  };

  const handleConfirmCreateEvent = async () => {
    const trimmedName = eventName.trim();
    if (!trimmedName) {
      setError('Please enter a valid event name.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onCreateEvent(trimmedName);
      setModalVisible(false);
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
          Real-time photo sharing. Take photos with your default camera and watch them sync instantly!
        </Text>

        <View style={globalStyles.card}>
          <Text style={[globalStyles.infoTitle, { marginBottom: 16 }]}>Get Started</Text>

          <TouchableOpacity
            style={globalStyles.button}
            onPress={handleOpenCreateModal}
          >
            <Text style={globalStyles.buttonText}>Host: Create Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={globalStyles.buttonSecondary}
            onPress={onNavigateToJoin}
          >
            <Text style={globalStyles.buttonSecondaryText}>Guest: Join Event</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[globalStyles.buttonSecondary, { width: '100%', marginTop: 12 }]} 
          onPress={onNavigateToPastEvents}
        >
          <Text style={globalStyles.buttonSecondaryText}>🕒 View Past Events</Text>
        </TouchableOpacity>
      </View>

      {/* Host Create Event Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>Host New Event</Text>
            <Text style={localStyles.modalSubtitle}>Give your event a name (e.g. Wedding, Birthday Party)</Text>
            
            {error && (
              <Text style={localStyles.errorText}>{error}</Text>
            )}

            <TextInput
              style={localStyles.textInput}
              placeholder="Enter Event Name..."
              placeholderTextColor={COLORS.textSecondary}
              value={eventName}
              onChangeText={setEventName}
              maxLength={40}
              autoFocus={true}
            />

            <View style={localStyles.buttonRow}>
              <TouchableOpacity 
                style={[globalStyles.buttonSecondary, { flex: 1, marginVertical: 0 }]} 
                onPress={() => setModalVisible(false)}
                disabled={loading}
              >
                <Text style={globalStyles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[globalStyles.button, { flex: 1, marginVertical: 0 }]} 
                onPress={handleConfirmCreateEvent}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={globalStyles.buttonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const localStyles = StyleSheet.create({
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
    marginBottom: 20,
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
