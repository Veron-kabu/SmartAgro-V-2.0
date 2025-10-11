import { StyleSheet } from "react-native";
import { COLORS } from "../../../constants/colors";

export const favoritesStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Enhanced Cart Section Styles
  cartSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
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
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cartHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cartIcon: {
    marginHorizontal: 8,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  cartActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cartTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  clearText: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "600",
  },
  cartContent: {
    padding: 16,
  },
  cartItemContainer: {
    overflow: "hidden",
    marginBottom: 12,
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "flex-start",
  },
  quantityBtn: {
    padding: 8,
    minWidth: 32,
    alignItems: "center",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 8,
  },
  cartItemRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  cartItemSubtotal: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  checkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  checkoutIcon: {
    marginRight: 8,
  },
  checkoutText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  swipeDeleteLayer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  deleteBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
    marginTop: 4,
  },

  // Products Section
  productsSection: {
    paddingHorizontal: 20,
    flex: 1,
  },
  productsGrid: {
    gap: 16,
    paddingBottom: 32,
  },
  row: {
    justifyContent: "space-between",
  },

  // Error State
  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: "600",
  },

  // Skeleton Loading States
  skeletonCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: "47%",
  },
  skeletonImage: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonContent: {
    gap: 8,
  },
  skeletonTitle: {
    height: 16,
    borderRadius: 8,
    width: "70%",
  },
  skeletonPrice: {
    height: 14,
    borderRadius: 8,
    width: "40%",
  },
  skeletonBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  skeletonBadge: {
    height: 24,
    width: 60,
    borderRadius: 12,
  },

  // Enhanced Undo Snackbar
  undoSnackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  undoContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  undoText: {
    color: COLORS.text,
    fontSize: 14,
    marginLeft: 8,
  },
  undoButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  undoButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 12,
  },

  // Legacy styles for compatibility
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 24,
  },
  exploreButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
});
