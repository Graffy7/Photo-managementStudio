import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quotationsApi } from "../../api/quotationsApi";
import { servicesApi } from "../../api/servicesApi";
import type { Quotation } from "../../types/quotation";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";

interface Props {
  quotation?: Quotation;
  onDone: () => void;
  onCancel: () => void;
}

interface ItemDraft {
  key: string;
  serviceId: number;
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
  const [items, setItems] = useState<ItemDraft[]>(
    quotation
      ? quotation.items.map((i) => ({
          key: nextKey(),
          serviceId: i.serviceId,
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
  const grandTotal = subtotal - discountNum + taxNum;

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
        items: items.map((i) => ({
          serviceId: i.serviceId,
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
    items.every((i) => Number(i.quantity) > 0 && Number(i.unitPrice) >= 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? `Edit ${quotation!.quotationNumber}` : "New quotation"}</Text>

      <Text style={styles.label}>Customer</Text>
      <CustomerPicker selected={customer} onSelect={setCustomer} />

      <Text style={styles.label}>Quotation date</Text>
      <TextInput style={styles.input} value={quotationDate} onChangeText={setQuotationDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Valid until</Text>
      <TextInput style={styles.input} value={validUntil} onChangeText={setValidUntil} placeholder="YYYY-MM-DD (optional)" placeholderTextColor="#6f83a0" />

      <Text style={styles.sectionLabel}>Line items</Text>

      {items.map((item) => (
        <View key={item.key} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemServiceName}>{item.serviceName}</Text>
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
          <Text style={styles.smallLabel}>Choose a service</Text>
          <View style={styles.chipRow}>
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

      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalLabel}>Grand total</Text>
        <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
      </View>

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
