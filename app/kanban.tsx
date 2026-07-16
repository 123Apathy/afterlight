import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import BottomTabBar from '../components/BottomTabBar';
import CommentModal from '../components/CommentModal';
import HamburgerButton from '../components/HamburgerButton';
import MenuOverlay from '../components/MenuOverlay';
import PressableScale from '../components/PressableScale';
import { colors, images } from '../constants/theme';
import { api, type KanbanCard, type KanbanColumn } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import { useLocalStorage } from '../lib/useLocalStorage';

const STATUS_LABELS: Record<number, string> = { 0: 'TO DO', 1: 'WIP', 2: 'DONE' };

export default function KanbanScreen() {
  const { projectId } = useActiveProject();
  const [raterName] = useLocalStorage('afterlight.rater', '');
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesCardId, setNotesCardId] = useState<string | null>(null);

  const refresh = async () => {
    if (!projectId) return;
    const data = await api.getKanban(projectId);
    setColumns(data.columns);
    setCards(data.cards);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [projectId]);

  const notesCard = cards.find((c) => c.id === notesCardId) || null;

  const moveCard = async (card: KanbanCard, direction: -1 | 1) => {
    const columnIndex = columns.findIndex((c) => c.id === card.columnId);
    const targetColumn = columns[columnIndex + direction];
    if (!targetColumn) return;
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, columnId: targetColumn.id } : c)));
    await api.updateCard(card.id, { columnId: targetColumn.id });
  };

  const deleteCard = async (card: KanbanCard) => {
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    await api.deleteCard(card.id);
  };

  const submitNewCard = async (columnId: string) => {
    if (!draftTitle.trim()) {
      setAddingToColumn(null);
      return;
    }
    const card = await api.createCard(columnId, draftTitle.trim(), '');
    setCards((prev) => [...prev, card]);
    setDraftTitle('');
    setAddingToColumn(null);
  };

  const handleAddNote = async (text: string) => {
    if (!notesCard) return;
    const note = await api.addCardNote(notesCard.id, raterName || 'Anonymous', text);
    setCards((prev) => prev.map((c) => (c.id === notesCard.id ? { ...c, notes: [...c.notes, note] } : c)));
  };

  if (!projectId) {
    return (
      <View style={styles.screen}>
        <View style={styles.noProjectGate}>
          <Text style={styles.noProjectTitle}>No project selected</Text>
          <Text style={styles.noProjectSubtitle}>
            Go to Home to create a project or join one via an invite link.
          </Text>
        </View>
        <BottomTabBar />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: images.portrait }} style={styles.hero} resizeMode="cover" />
        <View style={styles.heroOverlay} />
        <View style={styles.heroHeader}>
          <HamburgerButton onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      <MenuOverlay visible={menuOpen} onClose={() => setMenuOpen(false)} />

      <View style={styles.body}>
        <View style={styles.darkBand}>
          <Text style={styles.sectionTitle}>Arrangements</Text>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.cardsList}>
            {columns.map((column, columnIndex) => {
              const columnCards = cards.filter((c) => c.columnId === column.id).sort((a, b) => a.order - b.order);
              return (
                <View key={column.id} style={styles.columnSection}>
                  <View style={styles.columnHeaderRow}>
                    <Text style={styles.columnHeaderText}>{column.title}</Text>
                    <Text style={styles.columnHeaderCount}>{columnCards.length}</Text>
                  </View>

                  {columnCards.map((card, index) => (
                    <Animated.View
                      key={card.id}
                      entering={FadeIn.duration(200).delay(index * 40)}
                      style={styles.cardRow}
                    >
                      <View
                        style={[styles.statusBox, columnIndex === 0 ? styles.statusBoxWhite : styles.statusBoxCream]}
                      >
                        <Text style={styles.statusTitle}>{STATUS_LABELS[columnIndex] ?? column.title}</Text>
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
                          <PressableScale
                            onPress={() => setNotesCardId(card.id)}
                            style={styles.notesButton}
                            scaleTo={0.95}
                          >
                            <Text style={styles.notesButtonText}>
                              {card.notes.length > 0 ? `${card.notes.length} note${card.notes.length === 1 ? '' : 's'}` : '+ Note'}
                            </Text>
                          </PressableScale>
                          <PressableScale onPress={() => deleteCard(card)} hitSlop={8} scaleTo={0.9}>
                            <Text style={styles.cardDelete}>&times;</Text>
                          </PressableScale>
                        </View>
                      </View>
                    </Animated.View>
                  ))}

                  {addingToColumn === column.id ? (
                    <View style={styles.addForm}>
                      <TextInput
                        value={draftTitle}
                        onChangeText={setDraftTitle}
                        placeholder="Task title..."
                        placeholderTextColor={colors.textFaintest}
                        style={styles.addInput}
                        autoFocus
                        onSubmitEditing={() => submitNewCard(column.id)}
                      />
                      <View style={styles.addFormButtons}>
                        <PressableScale
                          onPress={() => {
                            setAddingToColumn(null);
                            setDraftTitle('');
                          }}
                          style={styles.addFormCancel}
                          scaleTo={0.95}
                        >
                          <Text style={styles.addFormCancelText}>Cancel</Text>
                        </PressableScale>
                        <PressableScale
                          onPress={() => submitNewCard(column.id)}
                          style={styles.addFormConfirm}
                          scaleTo={0.95}
                        >
                          <Text style={styles.addFormConfirmText}>Add</Text>
                        </PressableScale>
                      </View>
                    </View>
                  ) : (
                    <PressableScale
                      onPress={() => {
                        setAddingToColumn(column.id);
                        setDraftTitle('');
                      }}
                      style={styles.addCardButton}
                      scaleTo={0.97}
                    >
                      <Text style={styles.addCardButtonText}>+ Add to {column.title}</Text>
                    </PressableScale>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <CommentModal
        visible={!!notesCard}
        comments={notesCard?.notes || []}
        onClose={() => setNotesCardId(null)}
        onSubmit={handleAddNote}
        title="Notes"
        placeholder="Add a note about this task..."
        emptyText="No notes yet."
      />

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  noProjectGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: colors.dark,
  },
  noProjectTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 22,
    color: colors.white,
    textAlign: 'center',
  },
  noProjectSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 300,
  },
  heroWrap: {
    height: 260,
  },
  heroHeader: {
    position: 'absolute',
    top: 20,
    right: 19,
    zIndex: 5,
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
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    paddingTop: 28,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 32,
    letterSpacing: -0.6,
    color: colors.white,
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
  },
  columnSection: {
    marginBottom: 28,
  },
  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  columnHeaderText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    letterSpacing: 0.4,
    color: '#1a1a1a',
    textTransform: 'uppercase',
  },
  columnHeaderCount: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#999999',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  statusBox: {
    width: 68,
    height: 90,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBoxWhite: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  statusBoxCream: {
    backgroundColor: '#F1EDE6',
  },
  statusTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    letterSpacing: 0.3,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
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
  notesButton: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#F1EDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
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
