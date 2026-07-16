import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppNav from '../components/AppNav';
import PressableScale from '../components/PressableScale';
import { colors } from '../constants/theme';
import { api, type KanbanCard, type KanbanColumn } from '../lib/api';

export default function KanbanScreen() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const refresh = async () => {
    const data = await api.getKanban();
    setColumns(data.columns);
    setCards(data.cards);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const cardsFor = (columnId: string) =>
    cards.filter((c) => c.columnId === columnId).sort((a, b) => a.order - b.order);

  const moveCard = async (card: KanbanCard, direction: -1 | 1) => {
    const index = columns.findIndex((c) => c.id === card.columnId);
    const targetColumn = columns[index + direction];
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

  return (
    <View style={styles.page}>
      <AppNav />
      <View style={styles.header}>
        <Text style={styles.heading}>Funeral Arrangements</Text>
        <Text style={styles.subheading}>A helpful starting template — add, remove, and move cards as you plan.</Text>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : (
        <ScrollView horizontal contentContainerStyle={styles.board} showsHorizontalScrollIndicator={false}>
          {columns.map((column, columnIndex) => (
            <View key={column.id} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle}>{column.title}</Text>
                <Text style={styles.columnCount}>{cardsFor(column.id).length}</Text>
              </View>

              <ScrollView contentContainerStyle={styles.cardList}>
                {cardsFor(column.id).map((card) => (
                  <View key={card.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{card.title}</Text>
                      <PressableScale onPress={() => deleteCard(card)} hitSlop={8} scaleTo={0.9}>
                        <Text style={styles.cardDelete}>&times;</Text>
                      </PressableScale>
                    </View>
                    {!!card.description && <Text style={styles.cardDescription}>{card.description}</Text>}
                    <View style={styles.cardMoveRow}>
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
                    </View>
                  </View>
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
                    <Text style={styles.addCardButtonText}>+ Add card</Text>
                  </PressableScale>
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  header: {
    padding: 32,
    paddingBottom: 16,
  },
  heading: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 28,
    color: colors.white,
  },
  subheading: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    marginTop: 6,
  },
  emptyText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFaintest,
    padding: 32,
  },
  board: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    gap: 20,
  },
  column: {
    width: 300,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    maxHeight: 620,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  columnTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: colors.white,
  },
  columnCount: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: colors.textFaintest,
  },
  cardList: {
    gap: 10,
  },
  card: {
    backgroundColor: colors.dark,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
  },
  cardDelete: {
    fontSize: 18,
    lineHeight: 18,
    color: colors.textFaintest,
  },
  cardDescription: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textFainter,
  },
  cardMoveRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  moveButton: {
    width: 32,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButtonDisabled: {
    opacity: 0.25,
  },
  moveButtonText: {
    fontSize: 14,
    color: colors.textFainter,
  },
  addCardButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addCardButtonText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: colors.textFaintest,
  },
  addForm: {
    gap: 8,
    marginTop: 4,
  },
  addInput: {
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    color: colors.white,
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
  },
  addFormButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addFormCancel: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addFormCancelText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: colors.textFainter,
  },
  addFormConfirm: {
    flex: 1,
    height: 34,
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
});
