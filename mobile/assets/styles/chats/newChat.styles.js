import { StyleSheet } from "react-native";
import { COLORS } from "../../../constants/colors";

export const newChatStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 20,
  },

  // Form styles
  formSection: {
    marginBottom: 24,
  },
  
  // Label styles
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 20,
  },
  requiredLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 20,
  },
  requiredAsterisk: {
    color: "#ef4444",
  },

  // Input styles
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: "#ef4444",
    borderWidth: 2,
  },

  // Button styles
  createButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonDisabled: {
    backgroundColor: COLORS.textLight,
    opacity: 0.6,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  // Help text styles
  helpText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 24,
    textAlign: "center",
    lineHeight: 20,
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Error text styles
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    marginTop: 8,
  },

  // Instructions section
  instructionsSection: {
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  instructionsList: {
    marginLeft: 8,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  instructionBullet: {
    fontSize: 16,
    color: COLORS.primary,
    marginRight: 8,
    marginTop: 2,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textLight,
    flex: 1,
    lineHeight: 18,
  },

  // Recent contacts section
  recentContactsSection: {
    marginTop: 32,
  },
  recentContactsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 16,
  },
  recentContactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recentContactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recentContactAvatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  recentContactInfo: {
    flex: 1,
  },
  recentContactName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  recentContactEmail: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },

  // Loading overlay
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    backgroundColor: COLORS.card,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    minWidth: 150,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
    marginTop: 12,
    fontWeight: "500",
  },
});
