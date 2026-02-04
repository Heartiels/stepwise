import 'react-native-get-random-values';
import { Stack } from "expo-router";
import { useEffect } from "react";
import { initDb } from "../src/db/schema";

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
