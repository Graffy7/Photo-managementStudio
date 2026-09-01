import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { featuresApi } from "../../api/featuresApi";
import { Toggle } from "../../components/Toggle";
import type { Studio } from "../../types/studio";

export function StudioFeaturesScreen({ studio, onBack }: { studio: Studio; onBack: () => void }) {
  const queryClient = useQueryClient();

  const { data: features, isLoading, isError } = useQuery({
    queryKey: ["studio-features", studio.studioId],
    queryFn: () => featuresApi.getForStudio(studio.studioId),
  });

  const toggle = useMutation({
    mutationFn: ({ featureCode, isEnabled }: { featureCode: string; isEnabled: boolean }) =>
      isEnabled ? featuresApi.enable(studio.studioId, featureCode) : featuresApi.disable(studio.studioId, featureCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-features", studio.studioId] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Studios</Text>
      </Pressable>

      <Text style={styles.title}>Modules</Text>
      <Text style={styles.subtitle}>{studio.studioName} — switch modules on or off for this studio.</Text>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load modules.</Text>
      ) : (
        <View style={styles.list}>
          {features?.map((feature) => (
            <View key={feature.featureId} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.featureName}>{feature.featureName}</Text>
                {feature.description ? <Text style={styles.featureDescription}>{feature.description}</Text> : null}
              </View>
              <Toggle
                value={feature.isEnabled}
                onValueChange={(value) => toggle.mutate({ featureCode: feature.featureCode, isEnabled: value })}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 560, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 4, marginBottom: 22 },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  list: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#1b2c42",
  },
  rowText: { flex: 1, paddingRight: 12 },
  featureName: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  featureDescription: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
});
