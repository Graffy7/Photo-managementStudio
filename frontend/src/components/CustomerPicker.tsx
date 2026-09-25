import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "../api/customersApi";
import { extractErrorMessage } from "../api/errorMessage";
import { duplicateFrom, type DuplicateCustomer } from "../utils/customerValidation";

export interface PickedCustomer {
  customerId: number;
  fullName: string;
  mobileNumber: string;
}

export function CustomerPicker({
  selected,
  onSelect,
}: {
  selected: PickedCustomer | null;
  onSelect: (customer: PickedCustomer) => void;
}) {
  const [open, setOpen] = useState(!selected);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateCustomer | null>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["customers-picker", query],
    queryFn: () => customersApi.search({ search: query || undefined, page: 1, pageSize: 8 }),
    enabled: open && !creating,
  });

  const createMutation = useMutation({
    mutationFn: () => customersApi.create({ fullName: newName.trim(), mobileNumber: newMobile.trim() }),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onSelect({ customerId: customer.customerId, fullName: customer.fullName, mobileNumber: customer.mobileNumber });
      setOpen(false);
      setCreating(false);
      setNewName("");
      setNewMobile("");
      setCreateError(null);
    },
    onError: (err) => {
      const dup = duplicateFrom(err);
      setDuplicate(dup);
      setCreateError(dup ? dup.message : extractErrorMessage(err));
    },
  });

  if (!open && selected) {
    return (
      <View style={styles.pickedRow}>
        <View>
          <Text style={styles.pickedName}>{selected.fullName}</Text>
          <Text style={styles.pickedMeta}>{selected.mobileNumber}</Text>
        </View>
        <Pressable onPress={() => setOpen(true)}>
          <Text style={styles.changeLink}>Change</Text>
        </Pressable>
      </View>
    );
  }

  if (creating) {
    const canCreate = newName.trim().length > 0 && newMobile.trim().length > 0;
    return (
      <View style={styles.createBox}>
        <Text style={styles.createTitle}>New customer</Text>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Full name"
          placeholderTextColor="#6f83a0"
        />
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          value={newMobile}
          onChangeText={setNewMobile}
          placeholder="Mobile number"
          placeholderTextColor="#6f83a0"
          keyboardType="phone-pad"
        />
        {createError ? <Text style={styles.createError}>{createError}</Text> : null}
        {duplicate?.isActive && (
          <Pressable
            onPress={() => {
              onSelect({ customerId: duplicate.customerId, fullName: duplicate.fullName, mobileNumber: newMobile.trim() });
              setOpen(false);
              setCreating(false);
              setDuplicate(null);
              setCreateError(null);
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.changeLink, { marginTop: 6 }]}>Use {duplicate.fullName} instead →</Text>
          </Pressable>
        )}
        <View style={styles.createButtonRow}>
          <Pressable
            style={styles.createCancelButton}
            onPress={() => { setCreating(false); setCreateError(null); }}
          >
            <Text style={styles.createCancelText}>Back to search</Text>
          </Pressable>
          <Pressable
            style={styles.createSaveButton}
            disabled={!canCreate || createMutation.isPending}
            onPress={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#0d1826" size="small" />
            ) : (
              <Text style={styles.createSaveText}>Create & select</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search customer by name or mobile number"
        placeholderTextColor="#6f83a0"
      />
      <View style={styles.pickerList}>
        <Pressable style={styles.newCustomerRow} onPress={() => setCreating(true)}>
          <Text style={styles.newCustomerText}>+ Add new customer</Text>
        </Pressable>
        {(data?.items ?? []).map((c) => (
          <Pressable
            key={c.customerId}
            style={styles.pickerRow}
            onPress={() => {
              onSelect({ customerId: c.customerId, fullName: c.fullName, mobileNumber: c.mobileNumber });
              setOpen(false);
            }}
          >
            <Text style={styles.pickerRowName}>{c.fullName}</Text>
            <Text style={styles.pickerRowMeta}>{c.mobileNumber}</Text>
          </Pressable>
        ))}
        {data?.items.length === 0 && <Text style={styles.pickerEmpty}>No customers match.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#132540",
  },
  pickedRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#132540",
  },
  pickedName: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  pickedMeta: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  changeLink: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  pickerList: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, backgroundColor: "#132540", marginTop: 8, overflow: "hidden" },
  newCustomerRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  newCustomerText: { color: "#7fc0e6", fontSize: 14, fontWeight: "700" },
  pickerRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  pickerRowName: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  pickerRowMeta: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  pickerEmpty: { color: "#6f83a0", fontSize: 12, padding: 14, textAlign: "center" },

  createBox: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, backgroundColor: "#132540", padding: 14, marginTop: 8 },
  createTitle: { color: "#e8edf3", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  createError: { color: "#ff7a72", fontSize: 12, marginTop: 8 },
  createButtonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  createCancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  createCancelText: { color: "#a7b7cb", fontSize: 13, fontWeight: "600" },
  createSaveButton: { flex: 1, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  createSaveText: { color: "#0d1826", fontSize: 13, fontWeight: "700" },
});
