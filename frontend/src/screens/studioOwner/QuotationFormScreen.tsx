import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quotationsApi } from "../../api/quotationsApi";
import { servicesApi } from "../../api/servicesApi";
import { eventsApi } from "../../api/eventsApi";
import type { PriceDisplay, Quotation } from "../../types/quotation";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";
import { MiniDatePicker } from "../../components/MiniDatePicker";

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
  const [quotationDate, setQuotationDate] = useState(quotation?.quotationDate?.slice(0, 10) ?? "");
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
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave =
    customer !== null &&
    quotationDate.trim().length > 0 &&
    items.length > 0 &&
    items.every((i) => Number(i.quantity) > 0 && Number(i.unitPrice) >= 0 && i.unitPrice.trim() !== "" && (i.serviceId != null || i.serviceName.trim().length > 0)) &&
    (manualTotalNum == null || manualTotalNum > 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? `Edit ${quotation!.quotationNumber}` : "New quotation"}</Text>

      {historyWarning && (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>This quotation is part of a permanent record</Text>
          <Text style={styles.warningText}>{historyWarning}</Text>
          <Text style={styles.warningText}>
            If the price has changed, raise a new quotation for this event instead — it becomes the next
            version and the old one stays exactly as the customer received it.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Customer</Text>
      <CustomerPicker selected={customer} onSelect={setCustomer} />

      <Text style={styles.label}>Quotation date</Text>
      <MiniDatePicker variant="form" value={quotationDate} onChange={setQuotationDate} placeholder="Select quotation date" />

      <Text style={styles.label}>Valid until</Text>
      <MiniDatePicker variant="form" clearable value={validUntil} onChange={setValidUntil} placeholder="Select date (optional)" />

      <Text style={styles.sectionLabel}>Line items</Text>

      {items.map((item) => (
        <View key={item.key} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            {item.serviceId == null ? (
              <View style={styles.customNameRow}>
                <Text style={styles.customTag}>Custom</Text>
                <TextInput
                  style={[styles.input, styles.customNameInput]}
                  value={item.serviceName}
                  onChangeText={(v) => updateItem(item.key, { serviceName: v })}
                  placeholder="Item name, e.g. Travel & stay"
                  placeholderTextColor="#6f83a0"
                  maxLength={200}
                />
              </View>
            ) : (
              <Text style={styles.itemServiceName}>{item.serviceName}</Text>
            )}
            <Pressable onPress={() => removeItem(item.key)}>
              <Text style={styles.removeLink}>Remove</Text>
            </Pressable>
          </View>
          <View style={styles.itemRow}>
            <View style={styles.itemField}>
              <Text style={styles.smallLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={item.quantity}
                onChangeText={(v) => updateItem(item.key, { quantity: v })}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.itemField}>
              <Text style={styles.smallLabel}>Unit price</Text>
              <TextInput
                style={styles.input}
                value={item.unitPrice}
                onChangeText={(v) => updateItem(item.key, { unitPrice: v })}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text style={styles.lineTotal}>{formatCurrency(lineTotal(item))}</Text>
          <TextInput
            style={styles.input}
            value={item.notes}
            onChangeText={(v) => updateItem(item.key, { notes: v })}
            placeholder="Notes (optional)"
            placeholderTextColor="#6f83a0"
          />
        </View>
      ))}

      {showServicePicker ? (
        <View style={styles.servicePickerCard}>
          <Text style={styles.smallLabel}>Choose a service, or add your own line</Text>
          <View style={styles.chipRow}>
            <Pressable style={[styles.chip, styles.customChip]} onPress={addCustomItem}>
              <Text style={[styles.chipText, { color: "#ff9a4d" }]}>+ Custom item</Text>
            </Pressable>
            {(services?.items ?? []).map((s) => (
              <Pressable key={s.serviceId} style={styles.chip} onPress={() => addItem(s)}>
                <Text style={styles.chipText}>{s.serviceName}</Text>
              </Pressable>
            ))}
            {services?.items.length === 0 && <Text style={styles.pickerEmpty}>No active services — add one under Services first.</Text>}
          </View>
          <Pressable onPress={() => setShowServicePicker(false)} style={{ marginTop: 10 }}>
            <Text style={styles.removeLink}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.addItemTrigger} onPress={() => setShowServicePicker(true)}>
          <Text style={styles.addItemTriggerText}>+ Add line item</Text>
        </Pressable>
      )}

      <View style={styles.divider} />

      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal</Text>
        <Text style={styles.totalsValue}>{formatCurrency(subtotal)}</Text>
      </View>

      <Text style={styles.label}>Discount</Text>
      <TextInput style={styles.input} value={discount} onChangeText={setDiscount} placeholder="0" placeholderTextColor="#6f83a0" keyboardType="numeric" />

      <Text style={styles.label}>Tax amount</Text>
      <TextInput style={styles.input} value={taxAmount} onChangeText={setTaxAmount} placeholder="0" placeholderTextColor="#6f83a0" keyboardType="numeric" />

      <Text style={styles.label}>Prices on the PDF</Text>
      <View style={styles.priceDisplayRow}>
        {([
          ["Detailed", "Detailed prices", "Each service with its price"],
          ["TotalOnly", "Total only", "Services listed, one total amount"],
        ] as const).map(([key, title, text]) => (
          <Pressable key={key} style={[styles.priceOption, priceDisplay === key && styles.priceOptionOn]} onPress={() => setPriceDisplay(key)}
            accessibilityRole="radio" accessibilityState={{ checked: priceDisplay === key }}>
            <Text style={[styles.priceOptionTitle, priceDisplay === key && { color: "#ff9a4d" }]}>{title}</Text>
            <Text style={styles.priceOptionText}>{text}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.priceNote}>Every line and price is still saved — this only changes what the PDF shows.</Text>

      {priceDisplay === "TotalOnly" && (
        <>
          <Text style={styles.label}>Total amount</Text>
          <TextInput
            style={styles.input}
            value={manualTotal}
            onChangeText={(v) => setManualTotal(v.replace(/[^0-9.]/g, ""))}
            placeholder={`Leave empty to use ${formatCurrency(calculatedTotal)}`}
            placeholderTextColor="#6f83a0"
            keyboardType="numeric"
          />
          <Text style={styles.priceNote}>
            Type the amount to quote the customer. It becomes this quotation's total everywhere — the approved amount, the event's
            balance and reports.
          </Text>
        </>
      )}

      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalLabel}>{manualTotalNum != null && manualTotalNum > 0 ? "Total amount" : "Grand total"}</Text>
        <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
      </View>
      {manualTotalNum != null && manualTotalNum > 0 && manualTotalNum !== calculatedTotal && (
        <Text style={styles.priceNote}>Entered by hand · the lines add up to {formatCurrency(calculatedTotal)}</Text>
      )}

      <Text style={styles.label}>Terms & conditions</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={termsAndConditions}
        onChangeText={setTermsAndConditions}
        placeholder="Optional"
        placeholderTextColor="#6f83a0"
        multiline
        numberOfLines={3}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create quotation"}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 520, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3", marginBottom: 20 },
  warning: {
    borderWidth: 1, borderColor: "rgba(242, 189, 92, 0.45)", backgroundColor: "rgba(242, 189, 92, 0.08)",
    borderRadius: 10, padding: 14, marginBottom: 20, gap: 6,
  },
  warningTitle: { color: "#f2bd5c", fontSize: 13, fontWeight: "700" },
  warningText: { color: "#a7b7cb", fontSize: 12, lineHeight: 18 },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 14 },
  smallLabel: { fontSize: 11, color: "#6f83a0", marginBottom: 4 },
  sectionLabel: {
    fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 22, marginBottom: 10,
  },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#132540",
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  customNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 10 },
  customTag: { color: "#ff9a4d", fontSize: 10, fontWeight: "800", borderWidth: 1, borderColor: "rgba(255,154,77,0.5)", borderRadius: 100, paddingHorizontal: 7, paddingVertical: 1 },
  customNameInput: { flex: 1, paddingVertical: 7 },
  customChip: { borderColor: "rgba(255,154,77,0.6)" },
  priceDisplayRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  priceOption: { flexGrow: 1, flexBasis: 180, borderWidth: 1, borderColor: "#23405c", borderRadius: 10, padding: 12, backgroundColor: "#132540", gap: 2 },
  priceOptionOn: { borderColor: "#ff9a4d", backgroundColor: "rgba(255,154,77,0.08)" },
  priceOptionTitle: { color: "#e8edf3", fontSize: 13.5, fontWeight: "700" },
  priceOptionText: { color: "#6f83a0", fontSize: 12 },
  priceNote: { color: "#6f83a0", fontSize: 11.5, marginTop: 6 },
  itemCard: { borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", padding: 14, marginBottom: 10, gap: 8 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemServiceName: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  removeLink: { color: "#ff7a72", fontSize: 12, fontWeight: "600" },
  itemRow: { flexDirection: "row", gap: 10 },
  itemField: { flex: 1 },
  lineTotal: { color: "#7fc0e6", fontSize: 13, fontWeight: "700" },
  servicePickerCard: { borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 10, padding: 14, marginBottom: 10 },
  pickerEmpty: { color: "#6f83a0", fontSize: 12 },
  addItemTrigger: { borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  addItemTriggerText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  divider: { height: 1, backgroundColor: "#1b2c42", marginVertical: 14 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalsLabel: { color: "#a7b7cb", fontSize: 13 },
  totalsValue: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 4 },
  grandTotalLabel: { color: "#7fc0e6", fontSize: 15, fontWeight: "700" },
  grandTotalValue: { color: "#e8edf3", fontSize: 20, fontWeight: "700" },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
