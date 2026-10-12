import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { expensesApi } from "../api/expensesApi";
import { expenseCategoriesApi } from "../api/expenseCategoriesApi";
import { extractErrorMessage } from "../api/errorMessage";
import type { Expense, ExpensePaymentStatus } from "../types/expense";
import { STANDARD_EXPENSE_CATEGORIES } from "../types/expense";
import { MiniDatePicker } from "./MiniDatePicker";
import { StatusPill } from "./StatusPill";
import { SubscriptionLock, useCanWrite } from "./SubscriptionLock";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { Field, FieldRow, TextField, ChoiceChips } from "../ui/Form";
import { InfoCard, EmptyLine } from "../ui/Detail";
import { useBreakpoint } from "../ui/useBreakpoint";
import { localDateString } from "../utils/localDate";
import { colors, radius, space, type } from "../ui/theme";

function formatCurrency(value: number): string {
  const amount = `₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return value < 0 ? `−${amount}` : amount;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

type Editing = { mode: "add" } | { mode: "edit"; expense: Expense } | null;

// The "Expenses & profit" card of an event page: what the event was agreed for, what it cost, the
// profit on the agreed price - and, kept apart, what the customer still owes and what the studio
// still owes. Expenses are added, edited and deleted right here.
export function EventExpenses({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
  const { isPhone } = useBreakpoint();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["event-expenses", eventId],
    queryFn: () => expensesApi.forEvent(eventId),
  });

  const refreshEverything = () => {
    queryClient.invalidateQueries({ queryKey: ["event-expenses", eventId] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    queryClient.invalidateQueries({ queryKey: ["profit-report"] });
    queryClient.invalidateQueries({ queryKey: ["studio-dashboard-summary"] });
  };

  const say = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage((m) => (m === text ? null : m)), 3000);
  };

  const remove = useMutation({
    mutationFn: (expenseId: number) => expensesApi.remove(expenseId),
    onSuccess: () => { setConfirmDeleteId(null); setRowError(null); refreshEverything(); say("Expense deleted"); },
    onError: (err) => setRowError(extractErrorMessage(err, "Couldn't delete the expense. Please try again.")),
  });

  const markPaid = useMutation({
    mutationFn: (e: Expense) => expensesApi.update(e.expenseId, {
      expenseCategoryId: e.expenseCategoryId,
      eventId: e.eventId ?? undefined,
      workerId: e.workerId ?? undefined,
      expenseDate: e.expenseDate.slice(0, 10),
      amount: e.amount,
      description: e.description ?? undefined,
      paymentMethod: e.paymentMethod ?? undefined,
      referenceNumber: e.referenceNumber ?? undefined,
      vendorName: e.vendorName ?? undefined,
      paymentStatus: "Paid",
    }),
    onSuccess: () => { setRowError(null); refreshEverything(); say("Marked as paid"); },
    onError: (err) => setRowError(extractErrorMessage(err, "Couldn't update the expense. Please try again.")),
  });

  const addButton = editing ? null : (
    <SubscriptionLock compact>
      <Button label="Add expense" icon="add" onPress={() => { setEditing({ mode: "add" }); setConfirmDeleteId(null); }} style={styles.smallButton} />
    </SubscriptionLock>
  );

  return (
    <InfoCard title="Expenses & profit" action={addButton}>
      {isPending ? (
        <View style={{ gap: space.sm }}><Skeleton height={76} /><Skeleton height={52} /></View>
      ) : isError || !data ? (
        <View style={{ gap: space.sm, alignItems: "flex-start" }}>
          <Text style={styles.error}>Couldn't load the expenses for this event.</Text>
          <Button label="Try again" onPress={() => refetch()} style={styles.smallButton} />
        </View>
      ) : (
        <>
          {/* Three across where there is room; on phones one per line so no amount is ever cut short. */}
          <View style={[styles.headline, isPhone && styles.headlinePhone]}>
            <Stat row={isPhone} label="Event total" value={formatCurrency(data.totalEventAmount)} hint="Agreed price" />
            <Stat row={isPhone} label="Expenses" value={formatCurrency(data.totalExpenses)} hint={`${data.expenses.length} item${data.expenses.length === 1 ? "" : "s"}`} />
            <Stat
              row={isPhone}
              label={data.netProfit < 0 ? "Net loss" : "Net profit"}
              value={formatCurrency(Math.abs(data.netProfit))}
              tone={data.netProfit > 0 ? colors.success : data.netProfit < 0 ? colors.danger : undefined}
              hint={data.profitMarginPercent === null ? "No event total set" : `${data.profitMarginPercent}% margin`}
            />
          </View>

          <View style={styles.split}>
            <View style={styles.splitBox}>
              <Text style={styles.splitTitle}>From the customer</Text>
              <Line label="Received" value={formatCurrency(data.amountReceived)} tone={colors.success} />
              <Line
                label={data.outstandingBalance < 0 ? "Overpaid" : "Still to receive"}
                value={formatCurrency(Math.abs(data.outstandingBalance))}
                tone={data.outstandingBalance > 0 ? colors.warning : data.outstandingBalance < 0 ? colors.danger : undefined}
              />
            </View>
            <View style={styles.splitBox}>
              <Text style={styles.splitTitle}>Your expenses</Text>
              <Line label="Paid" value={formatCurrency(data.paidExpenses)} />
              <Line label="Still to pay" value={formatCurrency(data.pendingExpenses)} tone={data.pendingExpenses > 0 ? colors.warning : undefined} />
            </View>
          </View>

          {message ? (
            <View style={styles.message} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}
          {rowError ? <Text style={styles.error}>{rowError}</Text> : null}

          {editing?.mode === "add" && (
            <ExpenseEditor
              eventId={eventId}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); refreshEverything(); say("Expense added"); }}
            />
          )}

          {data.expenses.length === 0 && !editing ? (
            <EmptyLine>No expenses recorded for this event yet. Add what you spend on crew, travel, albums and so on to see the real profit.</EmptyLine>
          ) : (
            <View>
              {data.expenses.map((e) =>
                editing?.mode === "edit" && editing.expense.expenseId === e.expenseId ? (
                  <ExpenseEditor
                    key={e.expenseId}
                    eventId={eventId}
                    expense={e}
                    onCancel={() => setEditing(null)}
                    onSaved={() => { setEditing(null); refreshEverything(); say("Expense updated"); }}
                  />
                ) : (
                  <View key={e.expenseId} style={styles.row}>
                    <View style={styles.rowMain}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{e.expenseCategoryName}{e.vendorName ? ` · ${e.vendorName}` : ""}</Text>
                        <Text style={styles.rowSub} numberOfLines={2}>{formatDate(e.expenseDate)}{e.description ? ` · ${e.description}` : ""}</Text>
                      </View>
                      <View style={styles.rowAmount}>
                        <Text style={styles.amount}>{formatCurrency(e.amount)}</Text>
                        <StatusPill label={e.paymentStatus} tone={e.paymentStatus === "Paid" ? "good" : "warn"} />
                      </View>
                    </View>
                    {confirmDeleteId === e.expenseId ? (
                      <View style={styles.confirm}>
                        <Text style={styles.confirmText}>Delete this expense? This can't be undone.</Text>
                        <View style={styles.rowActions}>
                          <Button label="Keep it" onPress={() => { setConfirmDeleteId(null); setRowError(null); }} disabled={remove.isPending} style={styles.smallButton} />
                          <Button label="Delete" variant="danger" onPress={() => remove.mutate(e.expenseId)} loading={remove.isPending} style={styles.smallButton} />
                        </View>
                      </View>
                    ) : canWrite ? (
                      <View style={styles.rowActions}>
                        {e.paymentStatus === "Pending" && (
                          <Button label="Mark paid" variant="link" onPress={() => markPaid.mutate(e)} disabled={markPaid.isPending} style={styles.linkButton} />
                        )}
                        <Button label="Edit" variant="link" onPress={() => { setEditing({ mode: "edit", expense: e }); setConfirmDeleteId(null); }} style={styles.linkButton} />
                        <Button label="Delete" variant="link" onPress={() => { setConfirmDeleteId(e.expenseId); setRowError(null); }} style={styles.linkButton} />
                      </View>
                    ) : null}
                  </View>
                ))}
            </View>
          )}
        </>
      )}
    </InfoCard>
  );
}

function Stat({ label, value, hint, tone, row }: { label: string; value: string; hint?: string; tone?: string; row?: boolean }) {
  if (row) {
    return (
      <View style={styles.statRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.statRowLabel}>{label}</Text>
          {hint ? <Text style={styles.statHint} numberOfLines={1}>{hint}</Text> : null}
        </View>
        <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      </View>
    );
  }
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {hint ? <Text style={styles.statHint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

// Add / edit form, shown in place inside the card.
function ExpenseEditor({ eventId, expense, onCancel, onSaved }: {
  eventId: number;
  expense?: Expense;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { isPhone } = useBreakpoint();
  const [category, setCategory] = useState<string | null>(expense?.expenseCategoryName ?? null);
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [date, setDate] = useState(expense?.expenseDate.slice(0, 10) ?? localDateString());
  const [vendor, setVendor] = useState(expense?.vendorName ?? "");
  const [status, setStatus] = useState<ExpensePaymentStatus>(expense?.paymentStatus ?? "Paid");
  const [notes, setNotes] = useState(expense?.description ?? "");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: categories, isPending: categoriesLoading } = useQuery({ queryKey: ["expense-categories"], queryFn: expenseCategoriesApi.getAll });

  // The studio's own categories first, then the standard ones it doesn't have yet (created on first use).
  const own = (categories ?? []).filter((c) => c.isActive || c.categoryName === expense?.expenseCategoryName).map((c) => c.categoryName);
  const shown = new Set(own.map((n) => n.toLowerCase()));
  const options = [...own, ...STANDARD_EXPENSE_CATEGORIES.filter((n) => !shown.has(n.toLowerCase()))];

  const amountNumber = Number(amount);
  const categoryError = tried && !category ? "Choose what the money was for." : null;
  const amountError = tried && !(amountNumber > 0) ? "Enter an amount above 0." : tried && amountNumber > 999999999 ? "That amount is too large." : null;
  const dateError = tried && !date ? "Choose the date." : null;

  const save = useMutation({
    mutationFn: async () => {
      // Resolve the chosen name to a category of this studio, adding or re-activating it if needed.
      const match = (categories ?? []).find((c) => c.categoryName.toLowerCase() === category!.toLowerCase());
      let expenseCategoryId: number;
      if (!match) {
        expenseCategoryId = (await expenseCategoriesApi.create({ categoryName: category! })).expenseCategoryId;
        queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      } else {
        if (!match.isActive && match.expenseCategoryId !== expense?.expenseCategoryId) {
          await expenseCategoriesApi.activate(match.expenseCategoryId);
          queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
        }
        expenseCategoryId = match.expenseCategoryId;
      }
      const payload = {
        expenseCategoryId,
        eventId,
        workerId: expense?.workerId ?? undefined,
        expenseDate: date,
        amount: amountNumber,
        description: notes.trim() || undefined,
        paymentMethod: expense?.paymentMethod ?? undefined,
        referenceNumber: expense?.referenceNumber ?? undefined,
        vendorName: vendor.trim() || undefined,
        paymentStatus: status,
      };
      return expense ? expensesApi.update(expense.expenseId, payload) : expensesApi.create(payload);
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the expense. Check your connection and try again.")),
  });

  const submit = () => {
    setTried(true);
    if (!category || !(amountNumber > 0) || amountNumber > 999999999 || !date) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);
    save.mutate();
  };

  return (
    <View style={styles.editor}>
      <Text style={styles.editorTitle}>{expense ? "Edit expense" : "New expense"}</Text>
      <Field label="Category" required error={categoryError}>
        {categoriesLoading ? <Skeleton height={40} /> : (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {options.map((name) => {
              const on = category?.toLowerCase() === name.toLowerCase();
              return (
                <Pressable key={name} style={[styles.chip, on && styles.chipOn]} onPress={() => { setCategory(name); setError(null); }} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Field>
      <FieldRow>
        <Field label="Amount (₹)" required error={amountError} flex>
          <TextField invalid={!!amountError} value={amount} onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")); setError(null); }} placeholder="2500" keyboardType="numeric" maxLength={12} />
        </Field>
        <Field label="Date" required error={dateError} flex>
          <MiniDatePicker variant="form" value={date} onChange={setDate} placeholder="Select date" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Paid to (vendor)" flex>
          <TextField value={vendor} onChangeText={setVendor} placeholder="Ravi Drone Services" maxLength={150} />
        </Field>
        <Field label="Payment status" required flex>
          <ChoiceChips<ExpensePaymentStatus>
            options={[{ value: "Paid", label: "Paid" }, { value: "Pending", label: "Pending" }]}
            value={status}
            onChange={setStatus}
          />
        </Field>
      </FieldRow>
      <Field label="Notes">
        <TextField value={notes} onChangeText={setNotes} placeholder="Second camera for the reception" maxLength={500} />
      </Field>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={[styles.editorActions, isPhone && { justifyContent: "flex-start" }]}>
        <Button label="Cancel" onPress={onCancel} disabled={save.isPending} />
        <Button label={expense ? "Save changes" : "Add expense"} variant="primary" onPress={submit} loading={save.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  smallButton: { minHeight: 36, paddingHorizontal: space.md },
  linkButton: { minHeight: 36, paddingHorizontal: space.sm },
  error: { ...type.small, color: colors.danger },

  headline: { flexDirection: "row", backgroundColor: colors.cardRaised, borderRadius: radius.control },
  headlinePhone: { flexDirection: "column", paddingVertical: space.xs },
  statRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  statRowLabel: { ...type.small, fontWeight: "600", color: colors.text },
  stat: { flex: 1, minWidth: 0, paddingVertical: space.md, paddingHorizontal: space.md, gap: 2 },
  statLabel: { ...type.caption, color: colors.textMuted },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  statHint: { ...type.caption, color: colors.textFaint },

  split: (Platform.OS === "web"
    ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: space.md }
    : { gap: space.md }) as object,
  splitBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: space.md, gap: 6 },
  splitTitle: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.md },
  lineLabel: { ...type.small, color: colors.text },
  lineValue: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },

  message: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.successSoft, borderRadius: radius.control, paddingVertical: space.sm, paddingHorizontal: space.md },
  messageText: { ...type.small, fontWeight: "600", color: colors.success },

  row: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: space.sm, gap: 2 },
  rowMain: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  rowTitle: { ...type.body, fontWeight: "600", color: colors.text },
  rowSub: { ...type.small, color: colors.textMuted },
  rowAmount: { alignItems: "flex-end", gap: 4 },
  amount: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  rowActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: space.xs },
  confirm: { backgroundColor: colors.dangerSoft, borderRadius: radius.control, padding: space.md, gap: space.sm, marginTop: space.xs },
  confirmText: { ...type.small, fontWeight: "600", color: colors.text },

  editor: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control, backgroundColor: colors.page, padding: space.md, gap: space.md, marginVertical: space.xs },
  editorTitle: { ...type.heading, fontSize: 15, color: colors.text },
  editorActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: space.md, backgroundColor: colors.card },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.small, fontWeight: "600", color: colors.textMuted },
  chipTextOn: { color: colors.primary },
});
