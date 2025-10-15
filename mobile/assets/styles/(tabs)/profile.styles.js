import { StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

export const profileStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Loading states
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: 16,
    textAlign: 'center',
  },

  // Hero Section
  heroWrapper: {
    position: 'relative',
    width: '100%',
    height: 200,
    backgroundColor: COLORS.border,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerPlaceholderText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    alignItems: 'center',
    // Remove any dark shade over the banner
    backgroundColor: 'transparent',
  },
  bannerEditHint: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Avatar Section
  avatarWrapper: {
    position: 'absolute',
    bottom: -60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: COLORS.white,
    backgroundColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },

  // Profile Info Section
  profileInfo: {
    marginTop: 70,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  nameLarge: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  username: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: 20,
    textAlign: 'center',
  },
  editProfileBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  editProfileText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // Admin View Banner
  adminBanner: {
    backgroundColor: COLORS.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
  },
  adminBannerText: {
    color: COLORS.warningText,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Section Blocks
  sectionBlock: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  // Orders single button
  ordersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  ordersButtonIcon: {
    marginRight: 8,
  },
  ordersButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ordersButtonHint: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontSize: 12,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  chevron: {
    fontSize: 16,
    color: COLORS.text,
    marginRight: 8,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headingActionBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headingActionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Cards Container
  rowCards: {
    flexDirection: 'row',
    gap: 12,
  },

  // Listing Cards
  listingCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  listingImage: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.border,
  },
  listingCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  listingMetric: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Favorite/Order Cards
  favoriteCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  favoriteImage: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: COLORS.border,
  },
  favoriteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  favoriteMetrics: {
    gap: 8,
  },
  metricLine: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  metricValue: {
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Funds Section
  fundsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fundCard: {
    width: '47%',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  fundLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: 4,
  },
  fundValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  fundCardFull: {
    width: '100%',
    backgroundColor: COLORS.primary,
  },
  fundLabelLight: {
    color: COLORS.white,
  },
  fundValueLight: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 8,
  },

  // Logout Button
  logoutContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
});

// Export THEME_COLORS for use in component
export { COLORS as THEME_COLORS };
