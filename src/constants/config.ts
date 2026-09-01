// localhost works for Web and the iOS simulator; an Android emulator needs 10.0.2.2,
// and a physical device needs your machine's LAN IP — override EXPO_PUBLIC_API_BASE_URL
// in .env (or an EAS build's environment) for those targets and for production deploys.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:5237";
