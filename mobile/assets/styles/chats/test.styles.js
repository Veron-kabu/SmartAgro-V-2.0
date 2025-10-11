import { StyleSheet } from "react-native";
import { COLORS } from "../../../constants/colors";

export const testStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.background,
  },

  // Header styles
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 24,
    color: COLORS.text,
  },

  // Status container styles
  statusContainer: {
    marginBottom: 32,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  
  // Status text styles
  statusText: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.text,
  },
  statusSuccess: {
    color: "#059669",
    fontWeight: "600",
  },
  statusError: {
    color: "#dc2626",
    fontWeight: "600",
  },
  statusWarning: {
    color: "#d97706",
    fontWeight: "600",
  },

  // Button styles
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
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
  buttonSecondary: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonDanger: {
    backgroundColor: "#dc2626",
  },
  buttonText: {
    color: COLORS.white,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  buttonTextSecondary: {
    color: COLORS.text,
  },

  // Info sections
  infoSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 18,
  },

  // Test results
  testResultContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  testResultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  testResultItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  testResultIcon: {
    marginRight: 8,
  },
  testResultText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },

  // Log section
  logSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 200,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  logText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontFamily: "monospace",
    lineHeight: 16,
  },

  // Warning box
  warningBox: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: "#92400e",
    lineHeight: 18,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: 16,
  },

  // Debug info
  debugSection: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
    lineHeight: 16,
  },
});
