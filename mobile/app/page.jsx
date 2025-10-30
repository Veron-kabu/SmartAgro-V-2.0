import { Redirect } from "expo-router"

export default function Page() {
  // Redirect to the main tab navigation
  // Use the concrete route path (route groups are omitted in URLs)
  return <Redirect href="/home" />
}
