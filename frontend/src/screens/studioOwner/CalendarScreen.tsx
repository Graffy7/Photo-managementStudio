import { useEffect, useMemo, useRef, useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { transition } from "../../ui/theme";
import { useNavigation, useRoute } from "@react-navigation/native";
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
import { hoverGlow, hoverLift } from "../../ui/webHover";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import type { EventListPreset } from "./EventListScreen";

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

const withFallback = (ids: number[]) => (ids.length > 0 ? ids : [0]);

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
  const narrow = useWindowDimensions().width < 600;
  const navigation = useNavigation<any>();
  const today = useMemo(() => new Date(), []);
  const queryClient = useQueryClient();
  const [viewedYear, setViewedYear] = useState(today.getFullYear());
  const [viewedMonth, setViewedMonth] = useState(today.getMonth() + 1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>({ name: "calendar" });

  // Coming back from an event's page ("View event"): reopen the day that was selected.
  const route = useRoute<any>();
  const selectDate = (route.params as { selectDate?: string } | undefined)?.selectDate;
  useEffect(() => {
    if (!selectDate) return;
    const [y, m] = selectDate.split("-").map(Number);
    setViewedYear(y);
    setViewedMonth(m);
    setSelectedKey(selectDate);
    navigation.setParams({ selectDate: undefined });
  }, [selectDate, navigation]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // On phones the day's events sit under the calendar: picking a date scrolls down to them.
  const scroller = useRef<ScrollView>(null);
  const panelY = useRef(0);
  const selectDay = (key: string | null) => {
    setSelectedKey(key);
    if (narrow && key) setTimeout(() => scroller.current?.scrollTo({ y: Math.max(panelY.current - 8, 0), animated: true }), 50);
  };

  const { data, isPending, isError, refetch } = useQuery({
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
    const counts: Record<EventCategory, number> = { wedding: 0, reception: 0, preWedding: 0, portrait: 0, birthday: 0, corporate: 0, other: 0 };
    for (const e of allMonthEvents) {
      counts[categorizeEventType(e.eventTypeName)]++;
    }
    return counts;
  }, [allMonthEvents]);

  // A tile opens the Events list for the month on screen - all of it, or one kind of event. The
  // type ids come from this month's own events, so the list holds exactly what the tile counted.
  const openEvents = (category?: EventCategory) => {
    const lastDay = new Date(viewedYear, viewedMonth, 0).getDate();
    const monthLabel = `${MONTH_NAMES[viewedMonth - 1]} ${viewedYear}`;
    const inCategory = category ? allMonthEvents.filter((e) => categorizeEventType(e.eventTypeName) === category) : [];
    const preset: EventListPreset = {
      label: category ? `${category === "other" ? "Others" : `${CATEGORY_LABELS[category]}s`} · ${monthLabel}` : `All events · ${monthLabel}`,
      dateFrom: dateKey(viewedYear, viewedMonth, 1),
      dateTo: dateKey(viewedYear, viewedMonth, lastDay),
      // An empty list would read as "no filter" on the server, so a group with no events sends 0 (no
      // event type has that id) and the list correctly shows nothing.
      eventTypeIds: category ? withFallback([...new Set(inCategory.map((e) => e.eventTypeId).filter((id): id is number => id !== null))]) : undefined,
      includeUntyped: category ? inCategory.some((e) => e.eventTypeId === null) : undefined,
      returnTo: "Calendar",
    };
    navigation.navigate("Events", { preset });
  };

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
        eventSummary={{ total: e.budget, advancePaid: e.amountPaid, balance: e.balance }}
        onDone={backToCalendar}
        onCancel={() => setView({ name: "calendar" })}
      />
    );
  }

  return (
    <ScrollView ref={scroller} style={styles.screen} contentContainerStyle={[styles.content, narrow && styles.contentNarrow]}>
        <View style={styles.header}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>{narrow ? "Tap a date to see its events." : "Click a date to see its events, add a booking or record a payment."}</Text>
        </View>

        {narrow ? (
          // Phones: the month's numbers in one compact card, so the calendar itself is on screen.
          <View style={styles.statStrip}>
            <Text style={styles.statStripTitle}>
              {monthlySummary.totalEvents} event{monthlySummary.totalEvents === 1 ? "" : "s"} in {MONTH_NAMES[viewedMonth - 1]}
            </Text>
            <View style={styles.statStripPills}>
              {CATEGORY_ORDER.filter((c) => categoryCounts[c] > 0).map((c) => (
                <View key={c} style={styles.statStripPill}>
                  <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[c] }]} />
                  <Text style={styles.statStripPillText}>{CATEGORY_LABELS[c]} {categoryCounts[c]}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.statRow}>
            <StatCard icon="calendar-outline" color="#5B9BFF" label="Total events" value={monthlySummary.totalEvents} onPress={() => openEvents()} />
            {CATEGORY_ORDER.filter((c) => c !== "other").map((c) => (
              <StatCard key={c} icon={CATEGORY_ICONS[c]} color={CATEGORY_COLORS[c]} label={`${CATEGORY_LABELS[c]}s`} value={categoryCounts[c]} onPress={() => openEvents(c)} />
            ))}
            <StatCard icon={CATEGORY_ICONS.other} color={CATEGORY_COLORS.other} label="Others" value={categoryCounts.other} onPress={() => openEvents("other")} />
          </View>
        )}

        <View style={styles.columns}>
          <View style={styles.mainColumn}>
            <View {...hoverGlow} style={styles.card}>
              <View style={styles.toolbar}>
                <View style={styles.toolbarNav}>
                  <Pressable style={styles.navButton} onPress={() => goToMonth(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
                    <Ionicons name="chevron-back" size={16} color="#A4AFCF" />
                  </Pressable>
                  <Text style={styles.monthLabel}>{MONTH_NAMES[viewedMonth - 1]} {viewedYear}</Text>
                  <Pressable style={styles.navButton} onPress={() => goToMonth(1)} accessibilityRole="button" accessibilityLabel="Next month">
                    <Ionicons name="chevron-forward" size={16} color="#A4AFCF" />
                  </Pressable>
                </View>
                <Pressable style={styles.todayButton} onPress={goToToday}>
                  <Text style={styles.todayButtonText}>Today</Text>
                </Pressable>
              </View>

              {isPending ? (
                <ActivityIndicator color="#5B9BFF" style={{ marginTop: 40, marginBottom: 40 }} />
              ) : isError ? (
                <Text style={styles.error}>Couldn't load the calendar.</Text>
              ) : (
                <>
                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map((w) => (
                      <View key={w} style={styles.weekdaySlot}>
                        <Text style={[styles.weekdayLabel, (w === "Sun") && styles.weekendLabel]}>{narrow ? w[0] : w}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.grid}>
                    {cells.map((cell, i) => {
                      if (cell.day === null) return <View key={`blank-${i}`} style={[styles.dayCellSlot, narrow && styles.dayCellSlotNarrow]} />;
                      const dayEvents = eventsByDate[cell.key!] ?? [];
                      const isToday = cell.key === todayKey();
                      const isSelected = cell.key === selectedKey;
                      return (
                        <View key={cell.key} style={[styles.dayCellSlot, narrow && styles.dayCellSlotNarrow]}>
                          <Pressable
                            {...hoverLift} style={[styles.dayCell, narrow && styles.dayCellNarrow, isToday && !isSelected && styles.dayCellToday, isSelected && styles.dayCellSelected]}
                            onPress={() => selectDay(cell.key)}
                            accessibilityRole="button"
                            accessibilityLabel={`${cell.day} ${MONTH_NAMES[viewedMonth - 1]}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                          >
                            <View style={styles.dayCellTop}>
                              <Text style={[styles.dayNumber, isToday && !isSelected && styles.dayNumberToday, isSelected && styles.dayNumberSelected]}>
                                {cell.day}
                              </Text>
                              {dayEvents.length > 0 && !narrow && (
                                <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                                  <Text style={[styles.countBadgeText, isSelected && styles.countBadgeTextSelected]}>{dayEvents.length}</Text>
                                </View>
                              )}
                            </View>
                            {narrow ? (
                              // Phone cells are too small for names: one dot per event, tap for details.
                              <View style={styles.dotRow}>
                                {dayEvents.slice(0, 3).map((e) => (
                                  <View key={e.eventId} style={[styles.dayDot, { backgroundColor: isSelected ? "#070F24" : CATEGORY_COLORS[categorizeEventType(e.eventTypeName)] }]} />
                                ))}
                                {dayEvents.length > 3 && <Text style={[styles.dotMore, isSelected && styles.moreLabelSelected]}>+</Text>}
                              </View>
                            ) : (
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
                            )}
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

          <View style={styles.sideColumn} onLayout={(e) => { panelY.current = e.nativeEvent.layout.y; }}>
            <View {...hoverGlow} style={styles.card}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>{selectedLabel ? "Events on this date" : "Events on a date"}</Text>
                <SubscriptionLock>
                  <Pressable
                    style={styles.addButton}
                    onPress={() => navigation.navigate("Events", { create: true, date: selectedKey ?? undefined, returnTo: "Calendar" })}
                  >
                    <Ionicons name="add" size={16} color="#070F24" />
                    <Text style={styles.addButtonText}>Add event</Text>
                  </Pressable>
                </SubscriptionLock>
              </View>
              {selectedLabel ? (
                <Text style={styles.panelSubtitleAccent}>{selectedLabel}</Text>
              ) : (
                <Text style={styles.panelSubtitle}>Pick a date to see what's booked.</Text>
              )}

              {selectedKey === null ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-clear-outline" size={22} color="#2E4377" />
                  <Text style={styles.empty}>{narrow ? "Tap a date in the calendar above." : "Click a date in the calendar."}</Text>
                </View>
              ) : selectedEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#2E4377" />
                  <Text style={styles.empty}>Nothing booked — this day is free.</Text>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 14 }}>
                  {selectedEvents.map((e) => {
                    const cat = categorizeEventType(e.eventTypeName);
                    const start = formatTime12h(e.startTime);
                    const end = formatTime12h(e.endTime);
                    return (
                      <View key={e.eventId} {...hoverLift} style={styles.eventCard}>
                        <View style={styles.eventCardTop}>
                          <View style={styles.eventCardTitleRow}>
                            <View style={[styles.eventDotSmall, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                            <Text style={styles.eventCardTitle} numberOfLines={1}>{CATEGORY_LABELS[cat]} - {e.customerName}</Text>
                          </View>
                          {pendingDeleteId !== e.eventId && (
                            <Pressable
                              hitSlop={12}
                              onPress={() => { setPendingDeleteId(e.eventId); setDeleteError(null); }}
                              accessibilityRole="button"
                              accessibilityLabel="Delete event"
                            >
                              <Ionicons name="trash-outline" size={18} color="#A4AFCF" />
                            </Pressable>
                          )}
                        </View>
                        <Text style={styles.eventCardTime}>
                          {start && end ? `${start} - ${end}` : "No time set"}
                        </Text>
                        <Text style={styles.eventCardMeta}>{e.customerMobileNumber}</Text>
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
                                <Text style={styles.financeLabel}>{e.balance < 0 ? "Overpaid" : "Balance"}</Text>
                                <Text style={[styles.financeValue, { color: e.balance === 0 ? "#22C58B" : "#FFA53D" }]}>
                                  {formatCurrency(Math.abs(e.balance))}
                                </Text>
                              </View>
                            </View>
                            <SubscriptionLock>
                              <Pressable style={styles.recordPaymentButton} onPress={() => setView({ name: "recordPayment", event: e })}>
                                <Ionicons name="cash-outline" size={16} color="#070F24" />
                                <Text style={styles.recordPaymentButtonText}>
                                  {e.balance > 0 ? "Record payment" : "Add payment"}
                                </Text>
                              </Pressable>
                            </SubscriptionLock>
                          </>
                        )}

                        <Pressable
                          style={(state) => [styles.viewEventButton, (state as { hovered?: boolean }).hovered && styles.viewEventButtonHover]}
                          onPress={() => navigation.navigate("Events", { eventId: e.eventId, returnTo: "Calendar", returnParams: { selectDate: selectedKey } })}
                          accessibilityRole="button"
                          accessibilityLabel={`View event for ${e.customerName}`}
                        >
                          <Ionicons name="eye-outline" size={16} color="#5B9BFF" />
                          <Text style={styles.viewEventButtonText}>View event</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View {...hoverGlow} style={styles.card}>
              <Text style={styles.panelTitle}>This month</Text>
              <Text style={styles.panelSubtitle}>{MONTH_NAMES[viewedMonth - 1]} {viewedYear}</Text>
              <View style={styles.summaryGrid}>
                <SummaryTile icon="calendar-outline" label="Events" value={String(monthlySummary.totalEvents)} />
                <SummaryTile icon="cash-outline" label="Total value" value={monthlySummary.totalValue > 0 ? formatCurrency(monthlySummary.totalValue) : "—"} />
              </View>
            </View>

            <View {...hoverGlow} style={styles.card}>
              <View style={styles.busiestHeader}>
                <Text style={styles.panelTitle}>Busiest weekday</Text>
                {busiestDay.busiestIndex !== null && (
                  <Text style={styles.busiestDayName}>{WEEKDAYS[busiestDay.busiestIndex]}</Text>
                )}
              </View>
              {busiestDay.busiestIndex === null ? (
                <Text style={styles.empty}>No events yet this month.</Text>
              ) : (
                <>
                  <Text style={styles.panelSubtitle}>{busiestDay.max} {busiestDay.max === 1 ? "event" : "events"} this month</Text>
                  <View style={styles.barsRow}>
                    {busiestDay.perWeekday.map((count, i) => (
                      <View key={i} style={styles.barSlot}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: busiestDay.max > 0 ? Math.max((count / busiestDay.max) * 48, count > 0 ? 6 : 2) : 2,
                              backgroundColor: i === busiestDay.busiestIndex ? "#5B9BFF" : "#2E4377",
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
      <ConfirmDialog
        visible={pendingDeleteId !== null}
        title="Delete event?"
        message={`${(() => { const ev = selectedEvents.find((x) => x.eventId === pendingDeleteId); return ev ? `${ev.eventTypeName ?? "The event"} for ${ev.customerName}` : "This event"; })()} will be removed. This can't be undone.`}
        confirmLabel="Delete"
        busy={deleteMutation.isPending}
        error={deleteError}
        onCancel={() => { setPendingDeleteId(null); setDeleteError(null); }}
        onConfirm={() => pendingDeleteId !== null && deleteMutation.mutate(pendingDeleteId)}
      />
    </ScrollView>
  );
}

// Same look as the Dashboard's cards: tinted with its colour, solid icon with a soft glow.
function StatCard({ icon, color, label, value, onPress }: { icon: string; color: string; label: string; value: number; onPress: () => void }) {
  return (
    <Pressable {...hoverLift} style={styles.statCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Show these events`}>
      <LinearGradient colors={[`${color}4D`, `${color}12`, "#0C1733"]} locations={[0, 0.5, 1]} start={{ x: 1, y: 1 }} end={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.statIcon, { backgroundColor: color, boxShadow: `0 4px 14px ${color}66` }]}>
        <Ionicons name={icon as any} size={16} color="#FFFFFF" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function SummaryTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Ionicons name={icon as any} size={16} color="#5B9BFF" />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070F24" },
  content: { padding: 24, paddingBottom: 32, maxWidth: 1760, width: "100%", alignSelf: "center" },
  contentNarrow: { padding: 16, paddingBottom: 32 },

  header: { marginBottom: 16 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: "#F2F5FF" },
  subtitle: { fontSize: 13, lineHeight: 18, color: "#A4AFCF", marginTop: 2 },
  statStrip: { backgroundColor: "#0C1733", borderRadius: 12, borderWidth: 1, borderColor: "#1E2D57", padding: 12, gap: 8, marginBottom: 12 },
  statStripTitle: { color: "#F2F5FF", fontSize: 15, fontWeight: "700" },
  statStripPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statStripPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#111E3F", borderRadius: 100, paddingVertical: 4, paddingHorizontal: 10 },
  statStripPillText: { color: "#F2F5FF", fontSize: 13, fontWeight: "600" },
  addButton: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#5B9BFF",
    borderRadius: 8, minHeight: 36, paddingHorizontal: 12,
  },
  addButtonText: { color: "#070F24", fontSize: 13, fontWeight: "700" },
  panelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  statCard: { flexGrow: 1, flexBasis: 0, minWidth: 130, backgroundColor: "#0C1733", borderRadius: 14, borderWidth: 1, borderColor: "#1E2D57", padding: 14, overflow: "hidden" },
  statIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: "800", color: "#F2F5FF", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 14, fontWeight: "700", color: "#F2F5FF", marginTop: 2 },

  columns: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  mainColumn: { flexGrow: 2, flexShrink: 1, flexBasis: 560, minWidth: 0, gap: 16 },
  sideColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, gap: 16 },

  card: { backgroundColor: "#0C1733", borderRadius: 12, borderWidth: 1, borderColor: "#1E2D57", padding: 16 },

  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  toolbarNav: { flexDirection: "row", alignItems: "center", gap: 12 },
  navButton: {
    width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#2E4377", backgroundColor: "#111E3F",
    alignItems: "center", justifyContent: "center",
  },
  monthLabel: { color: "#F2F5FF", fontSize: 17, fontWeight: "700", minWidth: 132, textAlign: "center" },
  todayButton: { borderWidth: 1, borderColor: "#5B9BFF", borderRadius: 8, minHeight: 40, justifyContent: "center", paddingHorizontal: 14 },
  todayButtonText: { color: "#5B9BFF", fontSize: 14, fontWeight: "700" },
  error: { color: "#FF5C75", marginTop: 40, marginBottom: 40, textAlign: "center" },

  weekdayRow: { flexDirection: "row" },
  weekdaySlot: { width: "14.2857%", alignItems: "center", paddingBottom: 10 },
  weekdayLabel: { color: "#A4AFCF", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  weekendLabel: { color: "#FF5C75" },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCellSlot: { width: "14.2857%", aspectRatio: 1.15, padding: 3 },
  dayCellSlotNarrow: { aspectRatio: 0.9, padding: 2 },
  dayCell: {
    flex: 1, borderRadius: 10, backgroundColor: "#0A1530", borderWidth: 1, borderColor: "#1E2D57",
    padding: 6, justifyContent: "flex-start", overflow: "hidden",
  },
  dayCellNarrow: { padding: 4, alignItems: "center", borderRadius: 8 },
  dotRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 2 },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  dotMore: { color: "#5B9BFF", fontSize: 12, lineHeight: 12, fontWeight: "700" },
  dayCellToday: { borderColor: "#5B9BFF", borderWidth: 1.5, backgroundColor: "rgba(91,155,255,0.08)" },
  dayCellSelected: { backgroundColor: "#5B9BFF", borderColor: "#5B9BFF" },
  dayCellTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  dayNumber: { color: "#F2F5FF", fontSize: 14, fontWeight: "600" },
  dayNumberToday: { color: "#5B9BFF", fontWeight: "800" },
  dayNumberSelected: { color: "#070F24", fontWeight: "800" },
  countBadge: { backgroundColor: "#2F7BFF", borderRadius: 100, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  countBadgeSelected: { backgroundColor: "#070F24" },
  countBadgeText: { color: "#070F24", fontSize: 12, lineHeight: 14, fontWeight: "800" },
  countBadgeTextSelected: { color: "#5B9BFF" },
  chipStack: { gap: 2 },
  eventChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  eventChipDot: { width: 6, height: 6, borderRadius: 3 },
  eventChipText: { color: "#C8D2EE", fontSize: 12, lineHeight: 15, flex: 1 },
  eventChipTextSelected: { color: "#070F24" },
  moreLabel: { color: "#5B9BFF", fontSize: 12, lineHeight: 15, fontWeight: "700" },
  moreLabelSelected: { color: "#070F24" },

  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#1E2D57" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: "#F2F5FF", fontSize: 13, fontWeight: "700" },

  panelTitle: { fontSize: 17, fontWeight: "700", color: "#F2F5FF", flexShrink: 1 },
  panelSubtitle: { fontSize: 13, color: "#A4AFCF", marginTop: 2, marginBottom: 4 },
  panelSubtitleAccent: { fontSize: 14, color: "#5B9BFF", fontWeight: "700", marginTop: 2, marginBottom: 4 },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 },
  empty: { color: "#A4AFCF", fontSize: 14, textAlign: "center" },

  eventCard: { backgroundColor: "#111E3F", borderRadius: 10, padding: 12, gap: 4 },
  eventCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  eventDotSmall: { width: 8, height: 8, borderRadius: 4 },
  eventCardTitle: { color: "#F2F5FF", fontSize: 15, fontWeight: "700", flex: 1 },
  eventCardTime: { color: "#5B9BFF", fontSize: 13, fontWeight: "600" },
  eventCardMeta: { color: "#A4AFCF", fontSize: 13 },
  categoryPill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8, marginTop: 2 },
  categoryPillText: { fontSize: 12, fontWeight: "700" },

  financeRow: { flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#1E2D57" },
  financeItem: { flex: 1, gap: 1 },
  financeLabel: { color: "#A4AFCF", fontSize: 12 },
  financeValue: { color: "#F2F5FF", fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  recordPaymentButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#5B9BFF", borderRadius: 8, minHeight: 40, marginTop: 8,
  },
  recordPaymentButtonText: { color: "#070F24", fontSize: 14, fontWeight: "700" },
  viewEventButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#5B9BFF",
    backgroundColor: "rgba(91,155,255,0.08)", borderRadius: 8, minHeight: 40, marginTop: 8, ...transition,
  },
  viewEventButtonHover: { backgroundColor: "rgba(91,155,255,0.18)" },
  viewEventButtonText: { color: "#5B9BFF", fontSize: 14, fontWeight: "700" },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  summaryTile: { flexGrow: 1, minWidth: "45%", backgroundColor: "#111E3F", borderRadius: 10, padding: 12, gap: 4 },
  summaryValue: { color: "#F2F5FF", fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  summaryLabel: { color: "#F2F5FF", fontSize: 13, fontWeight: "700" },

  busiestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  busiestDayName: { color: "#5B9BFF", fontSize: 14, fontWeight: "700" },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14, height: 68 },
  barSlot: { alignItems: "center", gap: 4, flex: 1 },
  bar: { width: 10, borderRadius: 4 },
  barLabel: { color: "#A4AFCF", fontSize: 12, fontWeight: "600" },
});
