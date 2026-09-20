import { memo } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { photoUrl } from "../../api/photoSelectionApi";
import type { PublicPhoto, SelectionType } from "../../types/photoSelection";

export const NORMAL_COLOR = "#7fc0e6";
export const BIG_COLOR = "#ff9a4d";
export const colorFor = (type: SelectionType | null) => (type === 2 ? BIG_COLOR : NORMAL_COLOR);

interface Props {
  photo: PublicPhoto;
  selection: SelectionType | null;
  width: number;
  disabled: boolean;
  onOpen: (photo: PublicPhoto) => void;
  onChange: (photo: PublicPhoto, next: SelectionType | null) => void;
}

// One photo in the grid: tap the picture to see it large, tap "Select" to choose it (Normal by
// default), then flip between Normal and Big. The check in the corner removes it again.
function PublicPhotoCardBase({ photo, selection, width, disabled, onOpen, onChange }: Props) {
  const selected = selection !== null;
  const accent = colorFor(selection);

  return (
    <View style={[styles.card, { width }, selected && { borderColor: accent }]}>
      <Pressable onPress={() => onOpen(photo)} accessibilityRole="button" accessibilityLabel={`View ${photo.fileName}`}>
        <View style={[styles.imageBox, { height: Math.round(width * 0.75) }]}>
          <Image
            source={{ uri: photoUrl(photo.thumbnailUrl) }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={photo.fileName}
          />
          <View style={styles.nameChip}>
            <Text style={styles.nameText} numberOfLines={1}>{photo.fileName}</Text>
          </View>
        </View>
      </Pressable>

      {selected && (
        <Pressable
          style={[styles.check, { backgroundColor: accent }]}
          disabled={disabled}
          onPress={() => onChange(photo, null)}
          accessibilityRole="button"
          accessibilityLabel={`Unselect ${photo.fileName}`}
        >
          <Text style={styles.checkText}>✓</Text>
        </Pressable>
      )}

      <View style={styles.controls}>
        {!selected ? (
          <Pressable
            style={[styles.selectButton, disabled && styles.disabled]}
            disabled={disabled}
            onPress={() => onChange(photo, 1)}
            accessibilityRole="button"
          >
            <Text style={styles.selectText}>Select</Text>
          </Pressable>
        ) : (
          <View style={styles.radioRow}>
            {([1, 2] as SelectionType[]).map((type) => {
              const active = selection === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.radio, active && { borderColor: colorFor(type), backgroundColor: "rgba(255,255,255,0.06)" }, disabled && styles.disabled]}
                  disabled={disabled}
                  onPress={() => onChange(photo, type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.dot, active && { borderColor: colorFor(type) }]}>
                    {active && <View style={[styles.dotFill, { backgroundColor: colorFor(type) }]} />}
                  </View>
                  <Text style={[styles.radioText, active && { color: "#e8edf3" }]}>{type === 1 ? "Normal" : "Big"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

export const PublicPhotoCard = memo(PublicPhotoCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#132540",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1b2c42",
    overflow: "hidden",
  },
  imageBox: { backgroundColor: "#0a1320", width: "100%" },
  image: { width: "100%", height: "100%" },
  nameChip: {
    position: "absolute", left: 6, bottom: 6, maxWidth: "80%",
    backgroundColor: "rgba(13,24,38,0.78)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  nameText: { color: "#e8edf3", fontSize: 10 },
  check: {
    position: "absolute", top: 6, right: 6, width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  checkText: { color: "#0d1826", fontSize: 16, fontWeight: "800" },
  controls: { padding: 6 },
  selectButton: {
    borderWidth: 1, borderColor: "#7fc0e6", borderRadius: 8, paddingVertical: 8, alignItems: "center",
  },
  selectText: { color: "#7fc0e6", fontWeight: "700", fontSize: 13 },
  radioRow: { flexDirection: "row", gap: 6 },
  radio: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 7,
  },
  radioText: { color: "#a7b7cb", fontSize: 12, fontWeight: "700" },
  dot: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#6f83a0",
    alignItems: "center", justifyContent: "center",
  },
  dotFill: { width: 6, height: 6, borderRadius: 3 },
  disabled: { opacity: 0.45 },
});
