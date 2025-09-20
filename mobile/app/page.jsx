import { Redirect } from "expo-router"

export default function Page() {
  // Redirect to the main tab navigation
  return <Redirect href="/(tabs)" />
}
