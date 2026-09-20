import { Platform } from "react-native";
import { arrayBufferToBase64 } from "./downloadPdf";

// Saves bytes the API returned (a CSV export, say) as a file: a normal browser download on web, the
// native share sheet elsewhere. Same approach as downloadAndSharePdf, for any file type.
export async function downloadBytes(bytes: ArrayBuffer, filename: string, mimeType: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  const file = new File(Paths.cache, filename);
  file.write(arrayBufferToBase64(bytes), { encoding: "base64" });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  }
}
