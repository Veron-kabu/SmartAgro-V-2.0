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
import { useSignUp } from "@clerk/clerk-expo";
import { useState } from "react";
import { authStyles } from "../../assets/styles/auth.styles";
import { Image } from "expo-image";
import { COLORS } from "../../constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { ROLES, ROLE_DESCRIPTIONS } from "../../constants/roles";

const SignUpScreen = () => {
  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const roleOptions = [
    { value: ROLES.buyer, label: "Buyer", description: ROLE_DESCRIPTIONS[ROLES.buyer] },
    { value: ROLES.farmer, label: "Farmer", description: ROLE_DESCRIPTIONS[ROLES.farmer] }
  ];

  const handleSignUp = async () => {
    if (!email || !password) return Alert.alert("Error", "Please fill in all fields");
    if (!selectedRole) return Alert.alert("Error", "Please select a role");
    if (password.length < 6) return Alert.alert("Error", "Password must be at least 6 characters");

    if (!isLoaded) return;

    setLoading(true);

    try {
      console.log('Creating sign-up for email:', email, 'with role:', selectedRole);
      
      // Create sign-up with role in unsafeMetadata
      await signUp.create({ 
        emailAddress: email, 
        password,
        unsafeMetadata: {
          role: selectedRole
        }
      });

      // Reload to ensure we have the latest state
      await signUp.reload?.();
      console.log('Sign-up created, emailAddressId:', signUp.emailAddressId);

      // Prepare email verification
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      console.log('Email verification prepared successfully');

      // Navigate to verify screen with parameters
      router.push({ 
        pathname: '/(auth)/verify', 
        params: { 
          mode: 'sign-up', 
          email: email, 
          sentAt: Date.now() 
        } 
      });
    } catch (err) {
      console.error('Sign-up failed:', err);
      Alert.alert("Error", err.errors?.[0]?.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const RoleDropdown = () => {
    const selectedOption = roleOptions.find(option => option.value === selectedRole);
    
    return (
      <View style={authStyles.inputContainer}>
        <TouchableOpacity
          style={authStyles.dropdownButton}
          onPress={() => setShowRoleDropdown(!showRoleDropdown)}
          activeOpacity={0.7}
        >
          <Text style={[
            authStyles.dropdownText,
            !selectedOption && authStyles.dropdownPlaceholder
          ]}>
            {selectedOption ? selectedOption.label : "Select Role"}
          </Text>
          <Ionicons
            name={showRoleDropdown ? "chevron-up" : "chevron-down"}
            size={20}
            color={COLORS.textLight}
          />
        </TouchableOpacity>

        {showRoleDropdown && (
          <View style={authStyles.dropdownMenu}>
            {roleOptions.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  authStyles.dropdownOption,
                  selectedRole === option.value && authStyles.dropdownOptionSelected,
                  index === roleOptions.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => {
                  setSelectedRole(option.value);
                  setShowRoleDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  authStyles.dropdownOptionLabel,
                  selectedRole === option.value && authStyles.dropdownOptionLabelSelected
                ]}>
                  {option.label}
                </Text>
                {selectedRole === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={COLORS.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
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
              source={require("../../assets/images/i2.png")}
              style={authStyles.image}
              contentFit="contain"
            />
          </View>

          <Text style={authStyles.title}>Create Account</Text>

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
                  size={25}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            </View>

            {/* Role Selection */}
            <RoleDropdown />

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[authStyles.authButton, loading && authStyles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={authStyles.buttonText}>
                {loading ? "Creating Account..." : "Sign Up"}
              </Text>
            </TouchableOpacity>

            {/* Sign In Link */}
            <TouchableOpacity style={authStyles.linkContainer} onPress={() => router.push('/(auth)/sign-in')}>
              <Text style={authStyles.linkText}>
                Already have an account? <Text style={authStyles.link}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default SignUpScreen;
