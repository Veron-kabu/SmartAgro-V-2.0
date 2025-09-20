"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Alert,
} from "react-native"
import { useAuth } from "@clerk/clerk-expo"
import { Ionicons } from "@expo/vector-icons"
import { getJSON, postJSON } from "../../context/api"

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001"

export default function MarketScreen() {
  const { isSignedIn } = useAuth()
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

  const fetchProducts = async () => {
    try {
      const data = await getJSON(`${apiUrl}/api/products`)
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

  useEffect(() => {
    let filtered = products

    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) => product.category?.toLowerCase() === selectedCategory.toLowerCase())
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (product) =>
          product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.location?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    setFilteredProducts(filtered)
  }, [products, searchQuery, selectedCategory])

  const onRefresh = () => {
    setRefreshing(true)
    fetchProducts()
  }

  const handleAddToFavorites = async (productId) => {
    try {
      await postJSON(`${apiUrl}/api/favorites`, { product_id: productId })
      Alert.alert("Success", "Added to favorites!")
    } catch (_error) {
      Alert.alert("Error", "Failed to add to favorites")
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
    <View style={styles.container}>
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
        />
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, selectedCategory === category.id && styles.categoryCardActive]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Ionicons name={category.icon} size={24} color={selectedCategory === category.id ? "#ffffff" : "#16a34a"} />
            <Text style={[styles.categoryText, selectedCategory === category.id && styles.categoryTextActive]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products Grid */}
      <ScrollView
        style={styles.productsContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.productsGrid}>
          {filteredProducts.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <Image
                source={{ uri: product.images?.[0] || "https://via.placeholder.com/200" }}
                style={styles.productImage}
              />

              {/* Favorite Button */}
              <TouchableOpacity style={styles.favoriteButton} onPress={() => handleAddToFavorites(product.id)}>
                <Ionicons name="heart-outline" size={20} color="#ffffff" />
              </TouchableOpacity>

              {/* Organic Badge */}
              {product.isOrganic && (
                <View style={styles.organicBadge}>
                  <Text style={styles.organicText}>Organic</Text>
                </View>
              )}

              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {product.title}
                </Text>
                <Text style={styles.productDescription} numberOfLines={2}>
                  {product.description}
                </Text>

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
                  <Text style={styles.locationText}>{product.location}</Text>
                </View>

                <View style={styles.productActions}>
                  <TouchableOpacity style={styles.contactButton} onPress={() => handleContactFarmer(product)}>
                    <Ionicons name="chatbubble" size={16} color="#16a34a" />
                    <Text style={styles.contactText}>Contact</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.orderButton}>
                    <Text style={styles.orderText}>Order Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
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
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
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
  categoriesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  categoryCard: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 12,
    alignItems: "center",
    minWidth: 80,
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  categoryCardActive: {
    backgroundColor: "#16a34a",
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
    marginTop: 4,
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
    marginBottom: 16,
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: 120,
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
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  productDetails: {
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#16a34a",
  },
  productQuantity: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  productLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  locationText: {
    fontSize: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  contactText: {
    fontSize: 12,
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
    fontSize: 12,
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
