import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "studio_os_access_token";
const REFRESH_TOKEN_KEY = "studio_os_refresh_token";

// expo-secure-store has no web implementation, so web falls back to AsyncStorage
// (which itself sits on localStorage there) — native keeps the token in the keychain/keystore.
const isNative = Platform.OS === "ios" || Platform.OS === "android";

async function getItem(key: string): Promise<string | null> {
  return isNative ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  await (isNative ? SecureStore.setItemAsync(key, value) : AsyncStorage.setItem(key, value));
}

async function removeItem(key: string): Promise<void> {
  await (isNative ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key));
}

export const tokenStorage = {
  getAccessToken: () => getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => setItem(ACCESS_TOKEN_KEY, token),

  getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => setItem(REFRESH_TOKEN_KEY, token),

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await setItem(ACCESS_TOKEN_KEY, accessToken);
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  async clear(): Promise<void> {
    await removeItem(ACCESS_TOKEN_KEY);
    await removeItem(REFRESH_TOKEN_KEY);
  },
};
