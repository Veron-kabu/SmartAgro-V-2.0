import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useSignIn } from "@clerk/clerk-expo";
import { useState } from "react";
import { authStyles } from "../../assets/styles/auth.styles";
import { Image } from "expo-image";
import { COLORS } from "../../constants/colors";
import { Ionicons } from "@expo/vector-icons";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignInPress = async () => {
    if (!email || !password) return Alert.alert("Error", "Please fill in all fields");

    if (!isLoaded) return;

    setLoading(true);

    try {
      const result = await signIn.create({ identifier: email, password });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // Navigate explicitly to a valid route to avoid transient NotFound on some devices
        router.replace('/home');
      } else if (result.status === 'needs_first_factor') {
        // Prepare email code factor and navigate to verify with email in params
        try {
          await signIn.reload?.();
          const factors = Array.isArray(signIn.supportedFirstFactors) ? signIn.supportedFirstFactors : [];
          const emailCodeFactor = factors.find((f) => f?.strategy === 'email_code' && f?.emailAddressId);
          if (emailCodeFactor?.emailAddressId) {
            await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailCodeFactor.emailAddressId });
          } else {
            await signIn.prepareFirstFactor({ strategy: 'email_code' });
          }
        } catch (_e) {
          Alert.alert('Cannot send code', 'We could not prepare email verification. Please try again.');
          return;
        }
        router.push({ pathname: '/(auth)/verify', params: { mode: 'sign-in', email: email, sentAt: Date.now() } });
      }
    } catch (err) {
      console.error('Sign-in failed', err);
      Alert.alert('Sign-in failed', err?.errors?.[0]?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const onEmailCodeSignIn = async () => {
    if (!isLoaded) return;
    const emailTrimmed = String(email || '').trim();
    if (!emailTrimmed) {
      Alert.alert('Email required', 'Enter your email to receive a verification code');
      return;
    }

    setLoading(true);

    try {
      // Ensure we operate on the latest signIn object state
      await signIn.reload?.();

      // Only create if we don't already have the same identifier in the current flow
      const currentId = (signIn && signIn.identifier) ? String(signIn.identifier).toLowerCase() : '';
      if (!currentId || currentId !== emailTrimmed.toLowerCase()) {
        try {
          await signIn.create({ identifier: emailTrimmed });
        } catch (_e) {
          // If an older sign-in exists, reload and continue; do not hard-fail here
          // Common Clerk error: "Update operations are not allowed on older sign ins"
          await signIn.reload?.();
        }
      }

      // Prepare the email code factor (pass emailAddressId when possible)
      try {
        await signIn.reload?.();
        const factors = Array.isArray(signIn.supportedFirstFactors) ? signIn.supportedFirstFactors : [];
        const emailCodeFactor = factors.find((f) => f?.strategy === 'email_code' && f?.emailAddressId);
        if (emailCodeFactor?.emailAddressId) {
          await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailCodeFactor.emailAddressId });
        } else {
          await signIn.prepareFirstFactor({ strategy: 'email_code' });
        }
      } catch (_prepErr) {
        Alert.alert('Cannot send code', 'We could not send a verification code. Please try again.');
        return;
      }

      router.push({ pathname: '/(auth)/verify', params: { mode: 'sign-in', email: emailTrimmed, sentAt: Date.now() } });
    } catch (err) {
      console.error('Start email code sign-in failed', err);
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Please try again';
      Alert.alert('Email code sign-in failed', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={authStyles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        style={authStyles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={authStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image Container */}
          <View style={authStyles.imageContainer}>
            <Image
              source={require("../../assets/images/i1.png")}
              style={authStyles.image}
              contentFit="contain"
            />
          </View>

          <Text style={authStyles.title}>Welcome Back</Text>

          <View style={authStyles.formContainer}>
            {/* Email Input */}
            <View style={authStyles.inputContainer}>
              <TextInput
                style={authStyles.textInput}
                placeholder="Enter email"
                placeholderTextColor={COLORS.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <View style={authStyles.inputContainer}>
              <TextInput
                style={authStyles.textInput}
                placeholder="Enter password"
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={authStyles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={32}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[authStyles.authButton, loading && authStyles.buttonDisabled]}
              onPress={onSignInPress}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={authStyles.buttonText}>
                {loading ? "Signing In..." : "Sign In"}
              </Text>
            </TouchableOpacity>

            {/* Email Code Sign In */}
            <TouchableOpacity
              style={authStyles.linkContainer}
              onPress={onEmailCodeSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[authStyles.buttonText, { color: COLORS.primary }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <TouchableOpacity style={authStyles.linkContainer} onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={authStyles.linkText}>
                Don&apos;t have an account? <Text style={authStyles.link}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
