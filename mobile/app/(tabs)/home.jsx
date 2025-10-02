"use client"

import { useEffect, useState } from "react"
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl, Alert } from "react-native"
import { router } from 'expo-router'
import BlurhashImage from "../../components/BlurhashImage"
import { useAuth } from "@clerk/clerk-expo"
import { useProfile } from "../../context/profile"
import { Ionicons } from "@expo/vector-icons"
import { getJSON } from "../../context/api"
import { useFavorites, subscribeAppEvents } from "../../context/favorites"
// Base URL is centralized in the API client; pass only paths

export default function MarketScreen() {
  const { isSignedIn } = useAuth()
  const { profile } = useProfile()
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const categories = [
    { id: "all", name: "All", icon: "grid" },
    { id: "vegetables", name: "Vegetables", icon: "leaf" },
    { id: "fruits", name: "Fruits", icon: "nutrition" },
    { id: "grains", name: "Grains", icon: "flower" },
    { id: "dairy", name: "Dairy", icon: "water" },
  ]

  const { toggleFavorite: toggleFavCtx, isFavorited } = useFavorites()

  const fetchProducts = async () => {
    try {
  const data = await getJSON(`/api/products`)
      setProducts(data || [])
      setFilteredProducts(data || [])
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isSignedIn) {
      fetchProducts()
    }
  }, [isSignedIn])

  // Real-time stock/status updates
  useEffect(() => {
    const unsub = subscribeAppEvents(evt => {
      if (evt.type === 'product:stockChanged') {
        const { productId, remaining, status } = evt.payload || {}
        if (!productId) return
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantityAvailable: typeof remaining === 'number' ? remaining : p.quantityAvailable, status: status || p.status } : p))
        setFilteredProducts(prev => prev.map(p => p.id === productId ? { ...p, quantityAvailable: typeof remaining === 'number' ? remaining : p.quantityAvailable, status: status || p.status } : p))
      }
    })
    return () => { unsub && unsub() }
  }, [])

  // Derive filtered products with robust location handling (location may be object {lat,lng,...})
  useEffect(() => {
    let filtered = products

    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) => product.category?.toLowerCase() === selectedCategory.toLowerCase())
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((product) => {
        const titleMatch = product.title?.toLowerCase().includes(query)
        const locRaw = product.location
        let locString = ''
        if (typeof locRaw === 'string') locString = locRaw
        else if (locRaw && typeof locRaw === 'object') {
          locString = locRaw.name || (locRaw.lat && locRaw.lng ? `${locRaw.lat},${locRaw.lng}` : '')
        }
        const locationMatch = locString.toLowerCase().includes(query)
        return titleMatch || locationMatch
      })
    }

    setFilteredProducts(filtered)
  }, [products, searchQuery, selectedCategory])

  const onRefresh = () => {
    setRefreshing(true)
    fetchProducts()
  }

  const handleAddToFavorites = async (product) => {
    if (profile?.id && product.farmerId === profile.id) {
      Alert.alert('Not allowed', 'You cannot favorite your own product')
      return
    }
    try {
      await toggleFavCtx(product.id)
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to toggle favorite')
    }
  }

  const handleContactFarmer = (product) => {
    Alert.alert("Contact Farmer", `Send a message to the farmer about ${product.title}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send Message",
        onPress: () => {
          // Navigate to messages with pre-filled data
          console.log("Navigate to messages with product:", product.id)
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      stickyHeaderIndices={[2]} // 0: header, 1: search, 2: categories wrapper
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Market</Text>
        <Text style={styles.headerSubtitle}>Fresh products from local farmers</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products or locations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      {/* Categories (sticky) */}
      <View style={styles.categoriesStickyWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer} contentContainerStyle={styles.categoriesContent}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryCard, selectedCategory === category.id && styles.categoryCardActive]}
              onPress={() => setSelectedCategory(category.id)}
              activeOpacity={0.75}
            >
              <Ionicons name={category.icon} size={20} color={selectedCategory === category.id ? "#ffffff" : "#16a34a"} />
              <Text style={[styles.categoryText, selectedCategory === category.id && styles.categoryTextActive]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Products Grid */}
      <View style={styles.productsContainer}>
        <View style={styles.productsGrid}>
          {filteredProducts.map((product) => {
            const isOwner = profile?.role === 'farmer' && profile?.id === product.farmerId
            const goTo = () => {
              if (isOwner) {
                router.push(`/products/edit/${product.id}`)
              } else {
                router.push(`/products/${product.id}`)
              }
            }
            return (
            <TouchableOpacity key={product.id} style={styles.productCard} activeOpacity={0.85} onPress={goTo}>
              <BlurhashImage uri={product.images?.[0] || "https://via.placeholder.com/200"} blurhash={product.imageBlurhashes?.[0]} style={styles.productImage} />

              {/* Favorite Button */}
              {!isOwner && (
                <TouchableOpacity style={styles.favoriteButton} onPress={() => handleAddToFavorites(product)}>
                  <Ionicons name={isFavorited(product.id) ? "heart" : "heart-outline"} size={20} color={isFavorited(product.id) ? "#ef4444" : "#ffffff"} />
                </TouchableOpacity>
              )}

              {/* Organic Badge */}
              {product.isOrganic && (
                <View style={styles.organicBadge}>
                  <Text style={styles.organicText}>Organic</Text>
                </View>
              )}

              {isOwner && (
                <View style={[styles.ownerBadge, product.isOrganic && { top: 36 }]}>
                  <Text style={styles.ownerText}>Yours</Text>
                </View>
              )}

              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {product.title}
                </Text>
                {/* Availability Status */}
                <View style={{ flexDirection:'row', flexWrap:'wrap', marginBottom:4, alignItems:'center', gap:4 }}>
                  {(() => {
                    const status = (product.status || '').toLowerCase()
                    const qty = Number(product.quantityAvailable||0)
                    let label = 'Active'
                    let bg = '#d1fae5'; let fg = '#065f46'
                    if (status && status !== 'active') {
                      if (status === 'sold') { label = 'Sold'; bg = '#fee2e2'; fg = '#991b1b' }
                      else if (status === 'expired') { label = 'Expired'; bg = '#e5e7eb'; fg = '#374151' }
                      else if (status === 'inactive') { label = 'Inactive'; bg = '#fef3c7'; fg = '#92400e' }
                      else { label = status }
                    }
                    if (qty === 0) { label = 'Out of Stock'; bg = '#fee2e2'; fg = '#991b1b' }
                    return <Text style={{ backgroundColor:bg, color:fg, fontSize:10, fontWeight:'700', paddingHorizontal:8, paddingVertical:3, borderRadius:8 }}>{label}</Text>
                  })()}
                </View>
                {!!product.description && (
                  <Text style={styles.productDescription} numberOfLines={2}>
                    {product.description}
                  </Text>
                )}

                <View style={styles.productDetails}>
                  <Text style={styles.productPrice}>
                    ${product.price}/{product.unit}
                  </Text>
                  <Text style={styles.productQuantity}>
                    {product.quantityAvailable} {product.unit} available
                  </Text>
                </View>

                <View style={styles.productLocation}>
                  <Ionicons name="location" size={14} color="#6b7280" />
                  <Text style={styles.locationText}>{(() => {
                    const loc = product.location
                    if (!loc) return 'Unknown'
                    if (typeof loc === 'string') return loc
                    if (typeof loc === 'object') {
                      if (loc.name) return loc.name
                      if (loc.lat && loc.lng) return `${loc.lat},${loc.lng}`
                    }
                    return 'Unknown'
                  })()}</Text>
                </View>

                <View style={[styles.productActions, isOwner && { justifyContent: 'flex-end' }]}>
                  {!isOwner && (
                    <TouchableOpacity style={styles.contactButton} onPress={() => handleContactFarmer(product)}>
                      <Ionicons name="chatbubble" size={16} color="#16a34a" />
                      <Text style={styles.contactText}>Contact</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.orderButton} onPress={goTo}>
                    <Text style={styles.orderText}>{isOwner ? 'Edit' : 'View'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>)})}
        </View>
        {filteredProducts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== "all"
                ? "Try adjusting your search or filters"
                : "Check back later for fresh products"}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  categoriesStickyWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width:0, height:1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    zIndex: 10,
  },
  categoriesContainer: {
    maxHeight: 56,
  },
  categoriesContent: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryCard: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 8,
    alignItems: "center",
    minWidth: 64,
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  categoryCardActive: {
    backgroundColor: "#16a34a",
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#16a34a",
    marginTop: 2,
  },
  categoryTextActive: {
    color: "#ffffff",
  },
  productsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 14,
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: "hidden",
    minHeight: 270,
  },
  productImage: {
    width: "100%",
    height: 110,
    backgroundColor: "#f3f4f6",
  },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    padding: 6,
  },
  organicBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#16a34a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  organicText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
  },
  ownerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400e',
  },
  productInfo: {
    padding: 10,
    flexGrow: 1,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 2,
  },
  productDescription: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 6,
  },
  productDetails: {
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#16a34a",
  },
  productQuantity: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  productLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationText: {
    fontSize: 11,
    color: "#6b7280",
    marginLeft: 4,
  },
  productActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  contactText: {
    fontSize: 11,
    color: "#16a34a",
    marginLeft: 4,
    fontWeight: "600",
  },
  orderButton: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  orderText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
})
