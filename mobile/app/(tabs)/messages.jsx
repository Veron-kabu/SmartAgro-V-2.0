import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function MessagesTab() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the chat folder where all messages functionality is now located
    router.replace('/chat');
  }, [router]);

  // Return null since we're redirecting immediately
  return null;
}