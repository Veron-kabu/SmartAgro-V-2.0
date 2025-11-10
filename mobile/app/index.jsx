import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  // While auth state loading, do nothing (SplashGate handles splash elsewhere)
  if (!isLoaded) return null;
  // Unauthenticated users go to sign-up; authenticated go to home
  return <Redirect href={isSignedIn ? "/home" : "/(auth)/sign-up"} />;
}
