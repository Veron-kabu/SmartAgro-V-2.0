import { StyleSheet, Platform } from 'react-native';
import { COLORS } from '../../constants/colors';

export const userDashboardStyles = StyleSheet.create({
  // Modal styles
  editContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.card,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerAction: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  headerActionDisabled: {
    color: COLORS.textLight,
  },

  // Modal Content
  editContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    fontSize: 16,
    color: COLORS.text,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  // Password Section
  passwordSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  cancelPasswordText: {
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },

  // Modal Footer
  modalFooter: {
    padding: 20,
    backgroundColor: COLORS.card,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  button: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Utility styles
  muted: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  bold: {
    fontWeight: '700',
  },

  // Bottom sheet styles (if needed)
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetHandleWrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  sheetClose: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  sheetRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  sheetRowPrice: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
  },
  sheetEditBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
});

// Export THEME_COLORS for use in component
export { COLORS as THEME_COLORS };