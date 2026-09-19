import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { dayBoardApi } from "../../api/dayBoardApi";
import { eventsApi } from "../../api/eventsApi";
import { extractErrorMessage } from "../../api/errorMessage";
import type { DayBoardEvent } from "../../types/dayBoard";
import {
  categorizeEventType, CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_ICONS, type EventCategory,
} from "../../utils/eventCategory";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { PaymentFormScreen } from "./PaymentFormScreen";

type CalendarView =
  | { name: "calendar" }
  | { name: "recordPayment"; event: DayBoardEvent };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKey(): string {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function formatTime12h(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CalendarScreen() {
  const navigation = useNavigation<any>();
  const today = useMemo(() => new Date(), []);
  const queryClient = useQueryClient();
  const [viewedYear, setViewedYear] = useState(today.getFullYear());
  const [viewedMonth, setViewedMonth] = useState(today.getMonth() + 1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>({ name: "calendar" });
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar-month", viewedYear, viewedMonth],
    queryFn: () => dayBoardApi.getMonth(viewedYear, viewedMonth),
  });
  useRefetchOnFocus(refetch);

  const deleteMutation = useMutation({
    mutationFn: (eventId: number) => eventsApi.delete(eventId),
    onSuccess: () => {
      setPendingDeleteId(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      refetch();
    },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  });

  const backToCalendar = () => {
    setView({ name: "calendar" });
    refetch();
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, DayBoardEvent[]> = {};
    for (const day of data ?? []) {
      map[day.date.slice(0, 10)] = day.events;
    }
    return map;
  }, [data]);

  const allMonthEvents = useMemo(() => Object.values(eventsByDate).flat(), [eventsByDate]);

  const categoryCounts = useMemo(() => {
    const counts: Record<EventCategory, number> = { wedding: 0, preWedding: 0, portrait: 0, birthday: 0, corporate: 0, other: 0 };
    for (const e of allMonthEvents) {
      counts[categorizeEventType(e.eventTypeName)]++;
    }
    return counts;
  }, [allMonthEvents]);

  const monthlySummary = useMemo(() => {
    const totalValue = allMonthEvents.reduce((sum, e) => sum + (e.budget ?? 0), 0);
    return { totalEvents: allMonthEvents.length, totalValue };
  }, [allMonthEvents]);

  const busiestDay = useMemo(() => {
    const perWeekday = [0, 0, 0, 0, 0, 0, 0];
    for (const [key, events] of Object.entries(eventsByDate)) {
      const day = new Date(`${key}T00:00:00`).getDay();
      perWeekday[day] += events.length;
    }
    const max = Math.max(...perWeekday);
    const busiestIndex = max > 0 ? perWeekday.indexOf(max) : null;
    return { perWeekday, busiestIndex, max };
  }, [eventsByDate]);

  const goToMonth = (delta: number) => {
    let nextMonth = viewedMonth + delta;
    let nextYear = viewedYear;
    if (nextMonth < 1) { nextMonth = 12; nextYear -= 1; }
    else if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
    setViewedYear(nextYear);
    setViewedMonth(nextMonth);
    setSelectedKey(null);
  };

  const goToToday = () => {
    setViewedYear(today.getFullYear());
    setViewedMonth(today.getMonth() + 1);
    setSelectedKey(todayKey());
  };

  const firstOfMonth = new Date(viewedYear, viewedMonth - 1, 1);
  const daysInMonth = new Date(viewedYear, viewedMonth, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  const cells: { day: number | null; key: string | null }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const day = i - leadingBlanks + 1;
    cells.push(day < 1 || day > daysInMonth ? { day: null, key: null } : { day, key: dateKey(viewedYear, viewedMonth, day) });
  }

  const selectedEvents = selectedKey ? eventsByDate[selectedKey] ?? [] : [];
  const selectedLabel = selectedKey
    ? new Date(`${selectedKey}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;

  if (view.name === "recordPayment") {
    const e = view.event;
    return (
      <PaymentFormScreen
        initialCustomer={{ customerId: e.customerId, fullName: e.customerName, mobileNumber: e.customerMobileNumber }}
        initialEventId={e.eventId}
        initialAmount={e.balance > 0 ? e.balance : undefined}
        eventSummary={{ total: e.budget, advancePaid: e.amountPaid, balance: e.balance }}
        onDone={backToCalendar}
        onCancel={() => setView({ name: "calendar" })}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleIcon}>
              <Ionicons name="calendar" size={16} color="#7fc0e6" />
            </View>
            <View>
              <Text style={styles.title}>Calendar</Text>
              <Text style={styles.subtitle}>See all your booked events at a glance. Click on any date to view details.</Text>
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          <StatCard icon="calendar-outline" color="#7fc0e6" label="Total Events" value={monthlySummary.totalEvents} />
          {CATEGORY_ORDER.filter((c) => c !== "other").map((c) => (
            <StatCard key={c} icon={CATEGORY_ICONS[c]} color={CATEGORY_COLORS[c]} label={`${CATEGORY_LABELS[c]}s`} value={categoryCounts[c]} />
          ))}
          <StatCard icon={CATEGORY_ICONS.other} color={CATEGORY_COLORS.other} label="Others" value={categoryCounts.other} />
        </View>

        <View style={styles.columns}>
          <View style={styles.mainColumn}>
            <View style={styles.card}>
              <View style={styles.toolbar}>
                <View style={styles.toolbarNav}>
                  <Pressable style={styles.navButton} onPress={() => goToMonth(-1)}>
                    <Ionicons name="chevron-back" size={16} color="#a7b7cb" />
                  </Pressable>
                  <Text style={styles.monthLabel}>{MONTH_NAMES[viewedMonth - 1]} {viewedYear}</Text>
                  <Pressable style={styles.navButton} onPress={() => goToMonth(1)}>
                    <Ionicons name="chevron-forward" size={16} color="#a7b7cb" />
                  </Pressable>
                </View>
                <Pressable style={styles.todayButton} onPress={goToToday}>
                  <Text style={styles.todayButtonText}>Today</Text>
                </Pressable>
              </View>

              {isLoading ? (
                <ActivityIndicator color="#7fc0e6" style={{ marginTop: 40, marginBottom: 40 }} />
              ) : isError ? (
                <Text style={styles.error}>Couldn't load the calendar.</Text>
              ) : (
                <>
                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map((w) => (
                      <View key={w} style={styles.weekdaySlot}>
                        <Text style={[styles.weekdayLabel, (w === "Sun") && styles.weekendLabel]}>{w}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.grid}>
                    {cells.map((cell, i) => {
                      if (cell.day === null) return <View key={`blank-${i}`} style={styles.dayCellSlot} />;
                      const dayEvents = eventsByDate[cell.key!] ?? [];
                      const isToday = cell.key === todayKey();
                      const isSelected = cell.key === selectedKey;
                      return (
                        <View key={cell.key} style={styles.dayCellSlot}>
                          <Pressable
                            style={[styles.dayCell, isToday && !isSelected && styles.dayCellToday, isSelected && styles.dayCellSelected]}
                            onPress={() => setSelectedKey(cell.key)}
                          >
                            <View style={styles.dayCellTop}>
                              <Text style={[styles.dayNumber, isToday && !isSelected && styles.dayNumberToday, isSelected && styles.dayNumberSelected]}>
                                {cell.day}
                              </Text>
                              {dayEvents.length > 0 && (
                                <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                                  <Text style={[styles.countBadgeText, isSelected && styles.countBadgeTextSelected]}>{dayEvents.length}</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.chipStack}>
                              {dayEvents.slice(0, 2).map((e) => {
                                const cat = categorizeEventType(e.eventTypeName);
                                return (
                                  <View key={e.eventId} style={styles.eventChip}>
                                    <View style={[styles.eventChipDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                                    <Text style={[styles.eventChipText, isSelected && styles.eventChipTextSelected]} numberOfLines={1}>
                                      {CATEGORY_LABELS[cat]} - {e.customerName.split(" ")[0]}
                                    </Text>
                                  </View>
                                );
                              })}
                              {dayEvents.length > 2 && (
                                <Text style={[styles.moreLabel, isSelected && styles.moreLabelSelected]}>+{dayEvents.length - 2} more</Text>
                              )}
                            </View>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.legendRow}>
                    {CATEGORY_ORDER.map((c) => (
                      <View key={c} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[c] }]} />
                        <Text style={styles.legendLabel}>{CATEGORY_LABELS[c]}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.sideColumn}>
            <View style={styles.card}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Events on Selected Date</Text>
                <Pressable
                  style={styles.addButton}
                  onPress={() => navigation.navigate("Events", { create: true, date: selectedKey ?? undefined, returnTo: "Calendar" })}
                >
                  <Ionicons name="add" size={14} color="#0d1826" />
                  <Text style={styles.addButtonText}>Add Event</Text>
                </Pressable>
              </View>
              {selectedLabel ? (
                <Text style={styles.panelSubtitleAccent}>{selectedLabel}</Text>
              ) : (
                <Text style={styles.panelSubtitle}>Pick a date to see what's booked.</Text>
              )}

              {selectedKey === null ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-clear-outline" size={22} color="#3d5570" />
                  <Text style={styles.empty}>Click a date to see its events.</Text>
                </View>
              ) : selectedEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#3d5570" />
                  <Text style={styles.empty}>Nothing booked — this day is free.</Text>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 14 }}>
                  {selectedEvents.map((e) => {
                    const cat = categorizeEventType(e.eventTypeName);
                    const start = formatTime12h(e.startTime);
                    const end = formatTime12h(e.endTime);
                    return (
                      <View key={e.eventId} style={styles.eventCard}>
                        <View style={styles.eventCardTop}>
                          <View style={styles.eventCardTitleRow}>
                            <View style={[styles.eventDotSmall, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                            <Text style={styles.eventCardTitle} numberOfLines={1}>{CATEGORY_LABELS[cat]} - {e.customerName}</Text>
                          </View>
                          {pendingDeleteId !== e.eventId && (
                            <Pressable
                              hitSlop={8}
                              onPress={() => { setPendingDeleteId(e.eventId); setDeleteError(null); }}
                            >
                              <Ionicons name="trash-outline" size={15} color="#6f83a0" />
                            </Pressable>
                          )}
                        </View>
                        <Text style={styles.eventCardTime}>
                          {start && end ? `${start} - ${end}` : "No time set"}
                        </Text>
                        <Text style={styles.eventCardMeta}>{e.customerMobileNumber}</Text>
                        <Text style={styles.eventCardMeta}>{e.customerName}</Text>
                        {e.venue && <Text style={styles.eventCardMeta}>{e.venue}</Text>}
                        <View style={[styles.categoryPill, { backgroundColor: `${CATEGORY_COLORS[cat]}22`, borderColor: CATEGORY_COLORS[cat] }]}>
                          <Text style={[styles.categoryPillText, { color: CATEGORY_COLORS[cat] }]}>{CATEGORY_LABELS[cat]}</Text>
                        </View>

                        {e.budget !== null && (
                          <>
                            <View style={styles.financeRow}>
                              <View style={styles.financeItem}>
                                <Text style={styles.financeLabel}>Total</Text>
                                <Text style={styles.financeValue}>{formatCurrency(e.budget)}</Text>
                              </View>
                              <View style={styles.financeItem}>
                                <Text style={styles.financeLabel}>Advance paid</Text>
                                <Text style={styles.financeValue}>{formatCurrency(e.amountPaid)}</Text>
                              </View>
                              <View style={styles.financeItem}>
                                <Text style={styles.financeLabel}>Balance</Text>
                                <Text style={[styles.financeValue, { color: e.balance > 0 ? "#f2bd5c" : "#4cc493" }]}>
                                  {formatCurrency(e.balance)}
                                </Text>
                              </View>
                            </View>
                            <Pressable style={styles.recordPaymentButton} onPress={() => setView({ name: "recordPayment", event: e })}>
                              <Ionicons name="cash-outline" size={13} color="#0d1826" />
                              <Text style={styles.recordPaymentButtonText}>
                                {e.balance > 0 ? "Record Payment" : "Add Payment"}
                              </Text>
                            </Pressable>
                          </>
                        )}

                        {pendingDeleteId === e.eventId && (
                          <View style={styles.deleteConfirmBox}>
                            <Text style={styles.deleteConfirmText}>Delete this event? This can't be undone.</Text>
                            {deleteError && <Text style={styles.deleteErrorText}>{deleteError}</Text>}
                            <View style={styles.deleteConfirmButtons}>
                              <Pressable
                                style={styles.deleteCancelButton}
                                onPress={() => { setPendingDeleteId(null); setDeleteError(null); }}
                                disabled={deleteMutation.isPending}
                              >
                                <Text style={styles.deleteCancelText}>Cancel</Text>
                              </Pressable>
                              <Pressable
                                style={styles.deleteConfirmButton}
                                onPress={() => deleteMutation.mutate(e.eventId)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? (
                                  <ActivityIndicator color="#ff7a72" size="small" />
                                ) : (
                                  <Text style={styles.deleteConfirmButtonText}>Confirm Delete</Text>
                                )}
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.panelTitle}>Monthly Summary</Text>
              <Text style={styles.panelSubtitle}>{MONTH_NAMES[viewedMonth - 1]} {viewedYear}</Text>
              <View style={styles.summaryGrid}>
                <SummaryTile icon="calendar-outline" label="Total Events" value={String(monthlySummary.totalEvents)} />
                <SummaryTile icon="cash-outline" label="Total Value" value={monthlySummary.totalValue > 0 ? formatCurrency(monthlySummary.totalValue) : "—"} />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.busiestHeader}>
                <Text style={styles.panelTitle}>Most Active Day</Text>
                {busiestDay.busiestIndex !== null && (
                  <Text style={styles.busiestDayName}>{WEEKDAYS[busiestDay.busiestIndex]}</Text>
                )}
              </View>
              {busiestDay.busiestIndex === null ? (
                <Text style={styles.empty}>No events yet this month.</Text>
              ) : (
                <>
                  <Text style={styles.panelSubtitle}>{busiestDay.max} {busiestDay.max === 1 ? "Event" : "Events"}</Text>
                  <View style={styles.barsRow}>
                    {busiestDay.perWeekday.map((count, i) => (
                      <View key={i} style={styles.barSlot}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: busiestDay.max > 0 ? Math.max((count / busiestDay.max) * 48, count > 0 ? 6 : 2) : 2,
                              backgroundColor: i === busiestDay.busiestIndex ? "#7fc0e6" : "#23405c",
                            },
                          ]}
                        />
                        <Text style={styles.barLabel}>{WEEKDAYS[i][0]}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function StatCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SummaryTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Ionicons name={icon as any} size={16} color="#7fc0e6" />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 28, maxWidth: 1300, width: "100%", alignSelf: "center" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" },
  headerLeft: { flexDirection: "row", gap: 12, flex: 1, minWidth: 260 },
  titleIcon: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(127, 192, 230, 0.14)",
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 3, maxWidth: 420 },
  addButton: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#7fc0e6",
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
  },
  addButtonText: { color: "#0d1826", fontSize: 12, fontWeight: "700" },
  panelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  statCard: { flexGrow: 1, minWidth: 130, backgroundColor: "#132540", borderRadius: 12, borderWidth: 1, borderColor: "#23405c", padding: 14 },
  statIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#e8edf3" },
  statLabel: { fontSize: 11, color: "#a7b7cb", marginTop: 2 },

  columns: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  mainColumn: { flexGrow: 2, flexBasis: 560, gap: 16 },
  sideColumn: { flexGrow: 1, flexBasis: 300, gap: 16 },

  card: { backgroundColor: "#132540", borderRadius: 14, borderWidth: 1, borderColor: "#23405c", padding: 18 },

  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  toolbarNav: { flexDirection: "row", alignItems: "center", gap: 12 },
  navButton: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: "#23405c", backgroundColor: "#0f1e30",
    alignItems: "center", justifyContent: "center",
  },
  monthLabel: { color: "#e8edf3", fontSize: 16, fontWeight: "700", minWidth: 150, textAlign: "center" },
  todayButton: { borderWidth: 1, borderColor: "#7fc0e6", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  todayButtonText: { color: "#7fc0e6", fontSize: 12, fontWeight: "700" },
  error: { color: "#ff7a72", marginTop: 40, marginBottom: 40, textAlign: "center" },

  weekdayRow: { flexDirection: "row" },
  weekdaySlot: { width: "14.2857%", alignItems: "center", paddingBottom: 10 },
  weekdayLabel: { color: "#6f83a0", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  weekendLabel: { color: "#ff7a72" },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCellSlot: { width: "14.2857%", aspectRatio: 0.95, padding: 3 },
  dayCell: {
    flex: 1, borderRadius: 10, backgroundColor: "#0f1e30", borderWidth: 1, borderColor: "#1b2c42",
    padding: 6, justifyContent: "flex-start",
  },
  dayCellToday: { borderColor: "#7fc0e6", borderWidth: 1.5, backgroundColor: "rgba(127, 192, 230, 0.08)" },
  dayCellSelected: { backgroundColor: "#7fc0e6", borderColor: "#7fc0e6" },
  dayCellTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  dayNumber: { color: "#c3d0e0", fontSize: 12, fontWeight: "600" },
  dayNumberToday: { color: "#7fc0e6", fontWeight: "800" },
  dayNumberSelected: { color: "#0d1826", fontWeight: "800" },
  countBadge: { backgroundColor: "#a78bfa", borderRadius: 100, minWidth: 15, height: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  countBadgeSelected: { backgroundColor: "#0d1826" },
  countBadgeText: { color: "#0d1826", fontSize: 9, fontWeight: "800" },
  countBadgeTextSelected: { color: "#7fc0e6" },
  chipStack: { gap: 2 },
  eventChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  eventChipDot: { width: 4, height: 4, borderRadius: 2 },
  eventChipText: { color: "#a7b7cb", fontSize: 8.5, flex: 1 },
  eventChipTextSelected: { color: "#0d1826" },
  moreLabel: { color: "#7fc0e6", fontSize: 8.5, fontWeight: "700" },
  moreLabelSelected: { color: "#0d1826" },

  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#1b2c42" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: "#a7b7cb", fontSize: 11, fontWeight: "600" },

  panelTitle: { fontSize: 15, fontWeight: "700", color: "#e8edf3" },
  panelSubtitle: { fontSize: 12, color: "#6f83a0", marginTop: 2, marginBottom: 4 },
  panelSubtitleAccent: { fontSize: 12, color: "#7fc0e6", fontWeight: "700", marginTop: 2, marginBottom: 4 },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 },
  empty: { color: "#6f83a0", fontSize: 13, textAlign: "center" },

  eventCard: { backgroundColor: "#0f1e30", borderRadius: 10, padding: 12, gap: 4 },
  eventCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  eventDotSmall: { width: 7, height: 7, borderRadius: 4 },
  eventCardTitle: { color: "#e8edf3", fontSize: 13, fontWeight: "700", flex: 1 },
  eventCardTime: { color: "#7fc0e6", fontSize: 11, fontWeight: "600" },
  eventCardMeta: { color: "#a7b7cb", fontSize: 11 },
  categoryPill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8, marginTop: 2 },
  categoryPillText: { fontSize: 10, fontWeight: "700" },

  deleteConfirmBox: {
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#1b2c42", gap: 8,
  },
  deleteConfirmText: { color: "#ff7a72", fontSize: 11.5, fontWeight: "600" },
  deleteErrorText: { color: "#ff7a72", fontSize: 11 },
  deleteConfirmButtons: { flexDirection: "row", gap: 8 },
  deleteCancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  deleteCancelText: { color: "#a7b7cb", fontSize: 11.5, fontWeight: "700" },
  deleteConfirmButton: {
    flex: 1, borderWidth: 1, borderColor: "#ff7a72", backgroundColor: "rgba(255, 122, 114, 0.14)",
    borderRadius: 8, paddingVertical: 8, alignItems: "center",
  },
  deleteConfirmButtonText: { color: "#ff7a72", fontSize: 11.5, fontWeight: "700" },

  financeRow: { flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#1b2c42" },
  financeItem: { flex: 1, gap: 1 },
  financeLabel: { color: "#6f83a0", fontSize: 9.5 },
  financeValue: { color: "#e8edf3", fontSize: 12, fontWeight: "700" },
  recordPaymentButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 8, marginTop: 8,
  },
  recordPaymentButtonText: { color: "#0d1826", fontSize: 11.5, fontWeight: "700" },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  summaryTile: { flexGrow: 1, minWidth: "45%", backgroundColor: "#0f1e30", borderRadius: 10, padding: 12, gap: 4 },
  summaryValue: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  summaryLabel: { color: "#6f83a0", fontSize: 10 },

  busiestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  busiestDayName: { color: "#7fc0e6", fontSize: 14, fontWeight: "700" },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14, height: 60 },
  barSlot: { alignItems: "center", gap: 4, flex: 1 },
  bar: { width: 10, borderRadius: 4 },
  barLabel: { color: "#6f83a0", fontSize: 9, fontWeight: "600" },
});
