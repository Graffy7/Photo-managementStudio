import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quotationsApi } from "../../api/quotationsApi";
import { servicesApi } from "../../api/servicesApi";
import { eventsApi } from "../../api/eventsApi";
import type { PriceDisplay, Quotation } from "../../types/quotation";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { FormScreen, FormSection, FieldRow, Field, TextField, FormNote } from "../../ui/Form";
import { Button } from "../../ui/Button";
import { colors, radius, space, type } from "../../ui/theme";

interface Props {
  quotation?: Quotation;
  onDone: () => void;
  onCancel: () => void;
}

interface ItemDraft {
  key: string;
  // null = a custom line typed in by hand (serviceName is then its editable name)
  serviceId: number | null;
  serviceName: string;
  quantity: string;
  unitPrice: string;
  notes: string;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Today on this device (not UTC) - a new quotation is dated today unless changed.
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `item-${keySeq}`;
}

export function QuotationFormScreen({ quotation, onDone, onCancel }: Props) {
  const isEdit = !!quotation;
  const queryClient = useQueryClient();

  // Editing is still allowed, but an accepted quotation — or one belonging to a finished event — is
  // what the customer was actually given, so saying so up front keeps history from being rewritten
  // by accident.
  const { data: linkedEvent } = useQuery({
    queryKey: ["event", quotation?.eventId],
    queryFn: () => eventsApi.getById(quotation!.eventId!),
    enabled: isEdit && quotation?.eventId != null,
  });
  const historyWarning = !isEdit
    ? null
    : linkedEvent?.eventStatus === "Completed"
      ? "Its event is already completed, so these amounts and its PDF are the studio's record of what was agreed."
      : quotation?.status === "Accepted"
        ? "The customer has accepted it, so this amount and its PDF are what they agreed to."
        : null;

  const [customer, setCustomer] = useState<PickedCustomer | null>(
    quotation ? { customerId: quotation.customerId, fullName: quotation.customerName, mobileNumber: quotation.customerMobileNumber } : null
  );
  const [quotationDate, setQuotationDate] = useState(quotation?.quotationDate?.slice(0, 10) ?? localToday());
  const [validUntil, setValidUntil] = useState(quotation?.validUntil?.slice(0, 10) ?? "");
  const [discount, setDiscount] = useState(quotation ? String(quotation.discount) : "0");
  const [taxAmount, setTaxAmount] = useState(quotation ? String(quotation.taxAmount) : "0");
  // New quotations always start life as Draft; an existing quotation's status is changed
  // from the list screen instead (not this form), so editing here never alters it.
  const status = quotation?.status ?? "Draft";
  const [termsAndConditions, setTermsAndConditions] = useState(quotation?.termsAndConditions ?? "");
  const [priceDisplay, setPriceDisplay] = useState<PriceDisplay>(quotation?.priceDisplay ?? "Detailed");
  const [manualTotal, setManualTotal] = useState(quotation?.manualTotal != null ? String(quotation.manualTotal) : "");
  const [items, setItems] = useState<ItemDraft[]>(
    quotation
      ? quotation.items.map((i) => ({
          key: nextKey(),
          serviceId: i.isCustom ? null : i.serviceId,
          serviceName: i.serviceName,
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice),
          notes: i.notes ?? "",
        }))
      : []
  );
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: services } = useQuery({
    queryKey: ["services-active"],
    queryFn: () => servicesApi.search({ isActive: true, pageSize: 100 }),
  });

  const addItem = (service: { serviceId: number; serviceName: string; defaultPrice: number }) => {
    setItems((prev) => [
      ...prev,
      { key: nextKey(), serviceId: service.serviceId, serviceName: service.serviceName, quantity: "1", unitPrice: String(service.defaultPrice), notes: "" },
    ]);
    setShowServicePicker(false);
  };

  // A line that isn't in the service catalog: its own name and price.
  const addCustomItem = () => {
    setItems((prev) => [...prev, { key: nextKey(), serviceId: null, serviceName: "", quantity: "1", unitPrice: "", notes: "" }]);
    setShowServicePicker(false);
  };

  const updateItem = (key: string, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const lineTotal = (item: ItemDraft) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const subtotal = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const discountNum = Number(discount) || 0;
  const taxNum = Number(taxAmount) || 0;
  const calculatedTotal = subtotal - discountNum + taxNum;
  // "Total only" can take a total typed by hand; it then becomes the quotation's real total.
  const manualTotalNum = priceDisplay === "TotalOnly" && manualTotal.trim() !== "" ? Number(manualTotal) : null;
  const grandTotal = manualTotalNum != null && manualTotalNum > 0 ? manualTotalNum : calculatedTotal;

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        customerId: customer!.customerId,
        quotationDate: quotationDate.trim(),
        validUntil: validUntil.trim() || undefined,
        discount: discountNum,
        taxAmount: taxNum,
        status,
        termsAndConditions: termsAndConditions.trim() || undefined,
        priceDisplay,
        manualTotal: manualTotalNum != null && manualTotalNum > 0 ? manualTotalNum : undefined,
        items: items.map((i) => ({
          serviceId: i.serviceId ?? undefined,
          customName: i.serviceId == null ? i.serviceName.trim() : undefined,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          notes: i.notes.trim() || undefined,
        })),
      };
      return isEdit ? quotationsApi.update(quotation!.quotationId, payload) : quotationsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the quotation. Please try again.")),
  });

  const canSave =
    customer !== null &&
    quotationDate.trim().length > 0 &&
    items.length > 0 &&
    items.every((i) => Number(i.quantity) > 0 && Number(i.unitPrice) >= 0 && i.unitPrice.trim() !== "" && (i.serviceId != null || i.serviceName.trim().length > 0)) &&
    (manualTotalNum == null || manualTotalNum > 0);

  const [tried, setTried] = useState(false);
  const itemProblem = (i: ItemDraft): string | null => {
    if (i.serviceId == null && !i.serviceName.trim()) return "Give this item a name.";
    if (!(Number(i.quantity) > 0)) return "Quantity must be at least 1.";
    if (i.unitPrice.trim() === "" || Number(i.unitPrice) < 0) return "Enter the price.";
    return null;
  };
  const customerError = tried && !customer ? "Choose the customer." : null;
  const dateError = tried && !quotationDate.trim() ? "Choose the quotation date." : null;
  const itemsError = tried && items.length === 0 ? "Add at least one item." : null;
  const manualTotalError = manualTotalNum != null && !(manualTotalNum > 0) ? "Enter an amount above zero, or leave it empty." : null;

  const submit = () => {
    setTried(true);
    if (!canSave) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <FormScreen
      title={isEdit ? `Edit ${quotation!.quotationNumber}` : "New quotation"}
      subtitle={isEdit ? quotation!.customerName : "Pick the customer, add the services, and the PDF is ready."}
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : "Create quotation"}
      saving={mutation.isPending}
      error={error}
      above={historyWarning ? (
        <View style={{ marginTop: space.lg }}>
          <FormNote>
            This quotation is part of a permanent record. {historyWarning} If the price has changed, raise a new quotation
            for this event instead — it becomes the next version and the old one stays exactly as the customer received it.
          </FormNote>
        </View>
      ) : undefined}
    >
      <FormSection title="Customer and dates">
        <Field label="Customer" required error={customerError}>
          <CustomerPicker selected={customer} onSelect={(c) => { setCustomer(c); setError(null); }} />
        </Field>
        <FieldRow>
          <Field label="Quotation date" required error={dateError} flex>
            <MiniDatePicker variant="form" value={quotationDate} onChange={(v) => { setQuotationDate(v); setError(null); }} placeholder="Select date" />
          </Field>
          <Field label="Valid until" flex>
            <MiniDatePicker variant="form" clearable value={validUntil} onChange={setValidUntil} placeholder="Select date" />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="Items" description="Services from your list, or your own lines (travel, prints…).">
        {items.map((item) => {
          const problem = tried ? itemProblem(item) : null;
          return (
            <View key={item.key} style={[styles.item, problem && { borderColor: colors.danger }]}>
              <View style={styles.itemHeader}>
                {item.serviceId == null ? (
                  <TextField
                    style={{ flex: 1 }}
                    value={item.serviceName}
                    onChangeText={(v) => updateItem(item.key, { serviceName: v })}
                    placeholder="Item name, e.g. Travel and stay"
                    maxLength={200}
                    accessibilityLabel="Custom item name"
                  />
                ) : (
                  <Text style={styles.itemName} numberOfLines={2}>{item.serviceName}</Text>
                )}
                <Button label="Remove" variant="link" onPress={() => removeItem(item.key)} accessibilityLabel={`Remove ${item.serviceName || "item"}`} />
              </View>
              <View style={styles.itemRow}>
                <Field label="Qty" required flex>
                  <TextField value={item.quantity} onChangeText={(v) => updateItem(item.key, { quantity: v.replace(/[^0-9.]/g, "") })} keyboardType="numeric" />
                </Field>
                <Field label="Price" required flex>
                  <TextField value={item.unitPrice} onChangeText={(v) => updateItem(item.key, { unitPrice: v.replace(/[^0-9.]/g, "") })} keyboardType="numeric" placeholder="25000" />
                </Field>
                <View style={styles.lineTotalBox}>
                  <Text style={styles.lineTotalLabel}>Line total</Text>
                  <Text style={styles.lineTotal}>{formatCurrency(lineTotal(item))}</Text>
                </View>
              </View>
              <TextField value={item.notes} onChangeText={(v) => updateItem(item.key, { notes: v })} placeholder="Note for this line (optional)" />
              {problem && <Text style={styles.itemError}>{problem}</Text>}
            </View>
          );
        })}
        {itemsError && <Text style={styles.itemError}>{itemsError}</Text>}

        {showServicePicker ? (
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Choose a service, or add your own line</Text>
            <View style={styles.chips}>
              <Pressable style={[styles.chip, styles.chipCustom]} onPress={addCustomItem} accessibilityRole="button">
                <Text style={[styles.chipText, { color: colors.primary }]}>+ Your own item</Text>
              </Pressable>
              {(services?.items ?? []).map((s) => (
                <Pressable key={s.serviceId} style={styles.chip} onPress={() => addItem(s)} accessibilityRole="button">
                  <Text style={styles.chipText}>{s.serviceName} · {formatCurrency(s.defaultPrice)}</Text>
                </Pressable>
              ))}
              {services?.items.length === 0 && <Text style={styles.hint}>No active services yet. Add them under Services.</Text>}
            </View>
            <Button label="Cancel" variant="link" onPress={() => setShowServicePicker(false)} style={{ alignSelf: "flex-start", marginLeft: -10 }} />
          </View>
        ) : (
          <Button label="Add item" icon="add" onPress={() => setShowServicePicker(true)} style={{ alignSelf: "flex-start" }} />
        )}
      </FormSection>

      <FormSection title="Price and PDF">
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Items add up to</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
        </View>
        <FieldRow>
          <Field label="Discount" flex>
            <TextField value={discount} onChangeText={(v) => setDiscount(v.replace(/[^0-9.]/g, ""))} placeholder="0" keyboardType="numeric" />
          </Field>
          <Field label="Tax amount" flex>
            <TextField value={taxAmount} onChangeText={(v) => setTaxAmount(v.replace(/[^0-9.]/g, ""))} placeholder="0" keyboardType="numeric" />
          </Field>
        </FieldRow>

        <Field label="Prices on the PDF" required hint="Every line and price is still saved — this only changes what the PDF shows.">
          <View style={styles.options}>
            {([
              ["Detailed", "Detailed prices", "Each service with its price"],
              ["TotalOnly", "Total only", "Services listed, one total amount"],
            ] as const).map(([key, title, text]) => {
              const on = priceDisplay === key;
              return (
                <Pressable key={key} style={[styles.option, on && styles.optionOn]} onPress={() => setPriceDisplay(key)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <Text style={[styles.optionTitle, on && { color: colors.primary }]}>{title}</Text>
                  <Text style={styles.optionText}>{text}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {priceDisplay === "TotalOnly" && (
          <Field
            label="Total amount to quote"
            error={manualTotalError}
            hint="Becomes this quotation's total everywhere — the approved amount, the event's balance and reports."
          >
            <TextField
              invalid={!!manualTotalError}
              value={manualTotal}
              onChangeText={(v) => setManualTotal(v.replace(/[^0-9.]/g, ""))}
              placeholder={`Leave empty to use ${formatCurrency(calculatedTotal)}`}
              keyboardType="numeric"
            />
          </Field>
        )}

        <View style={styles.grand}>
          <Text style={styles.grandLabel}>{manualTotalNum != null && manualTotalNum > 0 ? "Total amount" : "Grand total"}</Text>
          <Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text>
        </View>
        {manualTotalNum != null && manualTotalNum > 0 && manualTotalNum !== calculatedTotal && (
          <Text style={styles.hint}>Entered by hand · the items add up to {formatCurrency(calculatedTotal)}</Text>
        )}
      </FormSection>

      <FormSection title="Terms">
        <Field label="Terms and conditions">
          <TextField value={termsAndConditions} onChangeText={setTermsAndConditions} placeholder="50% advance to confirm the date; balance on delivery" multiline numberOfLines={3} />
        </Field>
      </FormSection>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.page, padding: space.md, gap: space.md },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  itemName: { ...type.body, fontWeight: "600", color: colors.text, flex: 1 },
  itemRow: { flexDirection: "row", gap: space.md, alignItems: "flex-end" },
  lineTotalBox: { flex: 1, minWidth: 0, paddingBottom: 12 },
  lineTotalLabel: { ...type.caption, color: colors.textMuted },
  lineTotal: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  itemError: { ...type.small, color: colors.danger },
  picker: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.md, gap: space.sm, backgroundColor: colors.page },
  pickerTitle: { ...type.small, fontWeight: "600", color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: 40, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: space.md, backgroundColor: colors.card },
  chipCustom: { borderColor: colors.primary },
  chipText: { ...type.small, fontWeight: "600", color: colors.text },
  hint: { ...type.caption, color: colors.textFaint },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { ...type.body, color: colors.textMuted },
  totalValue: { ...type.body, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  option: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.card, padding: space.md, backgroundColor: colors.page, gap: 2 },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { ...type.body, fontWeight: "700", color: colors.text },
  optionText: { ...type.small, color: colors.textMuted },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  grandLabel: { ...type.heading, color: colors.text },
  grandValue: { fontSize: 22, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
});
