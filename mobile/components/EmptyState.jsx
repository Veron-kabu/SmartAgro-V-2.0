import { useRouter } from "expo-router"
import { View, Text, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { COLORS } from "../constants/colors"
import { favoritesStyles } from "@/assets/styles/(tabs)/favorites.styles"

/**
 * Generic empty state component.
 * Props:
 * - context: string key for the page context (e.g., 'favorites','orders','messages','listings','cart','search')
 * - title?: override heading text
 * - actionLabel?: button label
 * - icon?: Ionicons icon name
 * - actionIcon?: Ionicons icon name for the action button (defaults via context map)
 * - onAction?: custom action handler (default navigates to a suggested route)
 * - navigateTo?: path to navigate on action
 */
export default function EmptyState({
  context = 'generic',
  title,
  actionLabel,
  icon,
  actionIcon,
  onAction,
  navigateTo,
}) {
  const router = useRouter()

  const map = {
    favorites: {
      title: 'No favorites yet',
      icon: 'heart-outline',
      actionLabel: 'Explore Products',
      navigateTo: '/home',
      actionIcon: 'search',
    },
    orders: {
      title: 'No orders found',
      icon: 'cube-outline',
      actionLabel: 'Browse Products',
      navigateTo: '/home',
    },
    incomingOrders: {
      title: 'No incoming orders',
      icon: 'mail-open-outline',
      actionLabel: 'View Listings',
      navigateTo: '/products/my-listings',
    },
    cart: {
      title: 'Your cart is empty',
      icon: 'cart-outline',
      actionLabel: 'Add Items',
      navigateTo: '/home',
    },
    messages: {
      title: 'No messages yet',
      icon: 'chatbubble-ellipses-outline',
      actionLabel: 'Find Products',
      navigateTo: '/home',
    },
    listings: {
      title: 'No listings yet',
      icon: 'pricetag-outline',
      actionLabel: 'Post a Listing',
      navigateTo: '/products/post-listing',
    },
    products: {
      title: 'No products available',
      icon: 'leaf-outline',
      actionLabel: 'Refresh',
      navigateTo: '/home',
    },
    search: {
      title: 'No results found',
      icon: 'search-outline',
      actionLabel: 'Adjust Filters',
      navigateTo: '/(tabs)/search',
    },
    earnings: {
      title: 'No transactions yet',
      icon: 'wallet-outline',
      actionLabel: 'Explore Earnings',
      navigateTo: '/dashboard/earnings',
    },
    generic: {
      title: 'Nothing here yet',
      icon: 'ellipse-outline',
      actionLabel: 'Go Home',
      navigateTo: '/home',
      actionIcon: 'arrow-forward-circle',
    },
  }

  const cfg = map[context] || map.generic
  const finalTitle = title || cfg.title
  const finalIcon = icon || cfg.icon
  const finalLabel = actionLabel || cfg.actionLabel
  const finalRoute = navigateTo || cfg.navigateTo
  const finalActionIcon = actionIcon || cfg.actionIcon || 'arrow-forward-circle'

  const handlePress = () => {
    if (onAction) return onAction()
    if (finalRoute) router.push(finalRoute)
  }

  return (
    <View style={favoritesStyles.emptyState}>
      <View style={favoritesStyles.emptyIconContainer}>
        <Ionicons name={finalIcon} size={80} color={COLORS.textLight} />
      </View>
      <Text style={favoritesStyles.emptyTitle}>{finalTitle}</Text>
      {!!finalLabel && (
        <TouchableOpacity style={favoritesStyles.exploreButton} onPress={handlePress}>
          <Ionicons name={finalActionIcon} size={18} color={COLORS.white} />
          <Text style={favoritesStyles.exploreButtonText}>{finalLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
