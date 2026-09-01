import { Platform } from "react-native";

// No base64 encoder ships with React Native, and this is the one spot in the app that
// needs to turn raw bytes into a data/base64 string (for the native share sheet).
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? "=" : chars[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? "=" : chars[b2 & 63];
  }
  return result;
}

export async function downloadAndSharePdf(bytes: ArrayBuffer, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([bytes], { type: "application/pdf" });
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
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: filename });
  }
}
