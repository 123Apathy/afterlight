import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import BottomTabBar from '../components/BottomTabBar';
import PressableScale from '../components/PressableScale';
import { colors, images } from '../constants/theme';
import { api, type KanbanCard, type KanbanColumn } from '../lib/api';

export default function KanbanScreen() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  const refresh = async () => {
    const data = await api.getKanban();
    setColumns(data.columns);
    setCards(data.cards);
    setActiveColumnId((current) => current || data.columns[0]?.id || null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const totalCount = cards.length;
  const doneColumnId = columns[columns.length - 1]?.id;
  const doneCount = cards.filter((c) => c.columnId === doneColumnId).length;

  const visibleCards = useMemo(
    () =>
      cards
        .filter((c) => c.columnId === activeColumnId)
        .sort((a, b) => a.order - b.order),
    [cards, activeColumnId]
  );

  const columnIndex = columns.findIndex((c) => c.id === activeColumnId);

  const moveCard = async (card: KanbanCard, direction: -1 | 1) => {
    const targetColumn = columns[columnIndex + direction];
    if (!targetColumn) return;
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, columnId: targetColumn.id } : c)));
    await api.updateCard(card.id, { columnId: targetColumn.id });
  };

  const deleteCard = async (card: KanbanCard) => {
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    await api.deleteCard(card.id);
  };

  const submitNewCard = async () => {
    if (!draftTitle.trim() || !activeColumnId) {
      setAddingCard(false);
      return;
    }
    const card = await api.createCard(activeColumnId, draftTitle.trim(), '');
    setCards((prev) => [...prev, card]);
    setDraftTitle('');
    setAddingCard(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: images.portrait }} style={styles.hero} resizeMode="cover" />
        <View style={styles.heroOverlay} />
        <View style={styles.progressRing}>
          <Text style={styles.progressCount}>
            {doneCount}/{totalCount}
          </Text>
          <Text style={styles.progressLabel}>confirmed</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.darkBand}>
          <Text style={styles.sectionTitle}>Arrangements</Text>
          <View style={styles.pills}>
            {columns.map((column) => (
              <PressableScale
                key={column.id}
                style={[styles.pill, activeColumnId === column.id && styles.pillActive]}
                onPress={() => setActiveColumnId(column.id)}
                scaleTo={0.95}
              >
                <Text style={[styles.pillText, activeColumnId === column.id && styles.pillTextActive]}>
                  {column.title}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.cardsList}>
            {visibleCards.map((card, index) => (
              <Animated.View key={card.id} entering={FadeIn.duration(200).delay(index * 40)} style={styles.cardRow}>
                <View style={styles.statusBox}>
                  <Text style={styles.statusIndex}>{index + 1}</Text>
                  <Text style={styles.statusLabel}>
                    {columns.find((c) => c.id === card.columnId)?.title.slice(0, 4).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  {!!card.description && (
                    <Text style={styles.cardDescription} numberOfLines={2}>
                      {card.description}
                    </Text>
                  )}
                  <View style={styles.cardActions}>
                    <PressableScale
                      onPress={() => moveCard(card, -1)}
                      style={[styles.moveButton, columnIndex === 0 && styles.moveButtonDisabled]}
                      scaleTo={0.9}
                      disabled={columnIndex === 0}
                    >
                      <Text style={styles.moveButtonText}>&larr;</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={() => moveCard(card, 1)}
                      style={[
                        styles.moveButton,
                        columnIndex === columns.length - 1 && styles.moveButtonDisabled,
                      ]}
                      scaleTo={0.9}
                      disabled={columnIndex === columns.length - 1}
                    >
                      <Text style={styles.moveButtonText}>&rarr;</Text>
                    </PressableScale>
                    <PressableScale onPress={() => deleteCard(card)} hitSlop={8} scaleTo={0.9}>
                      <Text style={styles.cardDelete}>&times;</Text>
                    </PressableScale>
                  </View>
                </View>
              </Animated.View>
            ))}

            {addingCard ? (
              <View style={styles.addForm}>
                <TextInput
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="Task title..."
                  placeholderTextColor={colors.textFaintest}
                  style={styles.addInput}
                  autoFocus
                  onSubmitEditing={submitNewCard}
                />
                <View style={styles.addFormButtons}>
                  <PressableScale
                    onPress={() => {
                      setAddingCard(false);
                      setDraftTitle('');
                    }}
                    style={styles.addFormCancel}
                    scaleTo={0.95}
                  >
                    <Text style={styles.addFormCancelText}>Cancel</Text>
                  </PressableScale>
                  <PressableScale onPress={submitNewCard} style={styles.addFormConfirm} scaleTo={0.95}>
                    <Text style={styles.addFormConfirmText}>Add</Text>
                  </PressableScale>
                </View>
              </View>
            ) : (
              <PressableScale onPress={() => setAddingCard(true)} style={styles.addCardButton} scaleTo={0.97}>
                <Text style={styles.addCardButtonText}>+ Add card</Text>
              </PressableScale>
            )}
          </ScrollView>
        )}
      </View>

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  heroWrap: {
    height: 260,
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  progressRing: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: 'rgba(22,19,18,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCount: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 20,
    color: colors.white,
  },
  progressLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    color: colors.textFainter,
  },
  body: {
    flex: 1,
    marginTop: -28,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  darkBand: {
    backgroundColor: colors.dark,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    gap: 14,
  },
  sectionTitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 30,
    letterSpacing: -0.6,
    color: colors.white,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.gold,
  },
  pillText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: colors.textFainter,
  },
  pillTextActive: {
    color: colors.ink,
  },
  emptyText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#999999',
    padding: 20,
  },
  cardsList: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 18,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 14,
  },
  statusBox: {
    width: 60,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#F6F1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndex: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 22,
    color: '#1a1a1a',
  },
  statusLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    color: '#888888',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 18,
    lineHeight: 23,
    color: '#1a1a1a',
  },
  cardDescription: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 19,
    color: '#888888',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  moveButton: {
    width: 30,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#F1EDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
  moveButtonText: {
    fontSize: 13,
    color: '#888888',
  },
  cardDelete: {
    marginLeft: 4,
    fontSize: 18,
    lineHeight: 18,
    color: '#bbbbbb',
  },
  addForm: {
    gap: 8,
  },
  addInput: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F6F1EA',
    paddingHorizontal: 14,
    color: '#1a1a1a',
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
  },
  addFormButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addFormCancel: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1EDE6',
  },
  addFormCancelText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#888888',
  },
  addFormConfirm: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  addFormConfirmText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: colors.ink,
  },
  addCardButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F6F1EA',
  },
  addCardButtonText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#999999',
  },
});
