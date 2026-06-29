import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { globalStyles, COLORS } from '../styles';
import { getStringPreference, setStringPreference } from '../native/CameraMonitor';

interface PastEvent {
  id: string;
  name: string;
  role: 'host' | 'guest';
  date: string;
}

interface PastEventsScreenProps {
  onSelectEvent: (eventId: string) => void;
  onGoBack: () => void;
}

export const PastEventsScreen: React.FC<PastEventsScreenProps> = ({ onSelectEvent, onGoBack }) => {
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPastEvents = async () => {
      try {
        const dataStr = await getStringPreference('past_events');
        if (dataStr) {
          const parsed = JSON.parse(dataStr) as PastEvent[];
          // Sort by date descending
          parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setPastEvents(parsed);
        }
      } catch (error) {
        console.error('Failed to parse past events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPastEvents();
  }, []);

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear your local past events history? This will not delete any files from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await setStringPreference('past_events', '');
            setPastEvents([]);
          },
        },
      ]
    );
  };

  return (
    <View style={globalStyles.container}>
      <View style={{ flex: 1, width: '100%' }}>
        <Text style={globalStyles.header}>Past Events</Text>
        <Text style={globalStyles.subtitle}>
          Select a previous event to view its shared gallery.
        </Text>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={pastEvents}
            keyExtractor={(item) => `${item.id}-${item.date}`}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={localStyles.eventItem}
                onPress={() => onSelectEvent(item.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={localStyles.eventName}>{item.name}</Text>
                  <Text style={localStyles.eventId} numberOfLines={1} ellipsizeMode="middle">
                    ID: {item.id}
                  </Text>
                  <Text style={localStyles.eventDate}>
                    {new Date(item.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={[
                  localStyles.roleBadge,
                  item.role === 'host' ? localStyles.hostBadge : localStyles.guestBadge
                ]}>
                  <Text style={localStyles.roleText}>
                    {item.role.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={localStyles.emptyContainer}>
                <Text style={localStyles.emptyText}>No past events found.</Text>
                <Text style={localStyles.emptySubtext}>
                  Events you host or join will appear here automatically!
                </Text>
              </View>
            }
          />
        )}

        <View style={{ paddingVertical: 16 }}>
          {pastEvents.length > 0 && (
            <TouchableOpacity style={globalStyles.buttonSecondary} onPress={handleClearHistory}>
              <Text style={[globalStyles.buttonSecondaryText, { color: COLORS.danger }]}>Clear History</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={globalStyles.button} onPress={onGoBack}>
            <Text style={globalStyles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  eventItem: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  eventId: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
    width: '80%',
  },
  eventDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  roleBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  hostBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  guestBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 30,
    fontStyle: 'italic',
  },
});
