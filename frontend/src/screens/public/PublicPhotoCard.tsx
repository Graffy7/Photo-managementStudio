import { memo } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { photoUrl } from "../../api/photoSelectionApi";
import type { PublicPhoto, SelectionType } from "../../types/photoSelection";
import { colors, radius } from "../../ui/theme";

export const NORMAL_COLOR = colors.normal;
export const BIG_COLOR = colors.big;
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
                  <Text style={[styles.radioText, active && { color: colors.text }]}>{type === 1 ? "Normal" : "Big"}</Text>
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
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imageBox: { backgroundColor: "#070e17", width: "100%" },
  image: { width: "100%", height: "100%" },
  nameChip: {
    position: "absolute", left: 6, bottom: 6, maxWidth: "80%",
    backgroundColor: "rgba(11,21,34,0.8)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  nameText: { color: colors.text, fontSize: 11 },
  check: {
    position: "absolute", top: 6, right: 6, width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  checkText: { color: colors.onPrimary, fontSize: 16, fontWeight: "800" },
  // Both states are the same height, so a card never changes size when a photo is picked.
  controls: { padding: 6 },
  selectButton: {
    height: 40, borderWidth: 1, borderColor: colors.normal, borderRadius: radius.control, alignItems: "center", justifyContent: "center",
  },
  selectText: { color: colors.normal, fontWeight: "700", fontSize: 14 },
  radioRow: { flexDirection: "row", gap: 6 },
  radio: {
    flex: 1, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control,
  },
  radioText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  dot: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.textFaint,
    alignItems: "center", justifyContent: "center",
  },
  dotFill: { width: 7, height: 7, borderRadius: 4 },
  disabled: { opacity: 0.45 },
});
