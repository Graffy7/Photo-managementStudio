import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { customersApi } from "../api/customersApi";

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

  const { data } = useQuery({
    queryKey: ["customers-picker", query],
    queryFn: () => customersApi.search({ search: query || undefined, page: 1, pageSize: 8 }),
    enabled: open,
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
  pickerRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  pickerRowName: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  pickerRowMeta: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  pickerEmpty: { color: "#6f83a0", fontSize: 12, padding: 14, textAlign: "center" },
});
