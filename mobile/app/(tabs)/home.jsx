import { useEffect, useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, FlatList } from "react-native"
import { router } from 'expo-router'
import BlurhashImage from "../../components/BlurhashImage"
import { useResolvedUrls } from "../../hooks/useResolvedUrls"
import { useAuth } from "@clerk/clerk-expo"
import { useProfile } from "../../context/profile"
import { Ionicons } from "@expo/vector-icons"
import EmptyState from "../../components/EmptyState"
import { getJSON } from "../../context/api"
import { subscribeAppEvents } from "../../context/favorites"
import { homeStyles } from "../../assets/styles/(tabs)/home.styles"
import { Image } from "expo-image"
import { COLORS } from "../../constants/colors"
import CategoryFilter from "../../components/CategoryFilter"
import { CATEGORIES as SHARED_CATEGORIES } from "../../constants/categories"
import ProductCard from "../../components/ProductCard"
import LoadingSpinner from "../../components/LoadingSpinner"

export default function MarketScreen() {
  const { isSignedIn } = useAuth()
  const { profile } = useProfile()
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [featuredProduct, setFeaturedProduct] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Resolve featured image URL (handles private S3)
  const resolvedFeatured = useResolvedUrls(featuredProduct?.images || [])

  const categories = SHARED_CATEGORIES

  const fetchProducts = async () => {
    try {
      const data = await getJSON(`/api/products`)
      const productList = data || []
      setProducts(productList)
      setFilteredProducts(productList)
      
      // Set a random product as featured (or the first one)
      if (productList.length > 0) {
        const randomIndex = Math.floor(Math.random() * productList.length)
        setFeaturedProduct(productList[randomIndex])
      }
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

    if (selectedCategory) {
      filtered = filtered.filter((product) => product.category?.toLowerCase() === selectedCategory.toLowerCase())
    }

    setFilteredProducts(filtered)
  }, [products, selectedCategory])

  const onRefresh = () => {
    setRefreshing(true)
    fetchProducts()
  }

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading fresh products..." />
  }

  return (
    <View style={homeStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={homeStyles.scrollContent}
      >
        {/* Animal Icons */}
        <View style={homeStyles.welcomeSection}>
          <Image
            source={require("../../assets/images/h2.png")}
            style={{
              width: 100,
              height: 100,
            }}
          />
          <Image
            source={require("../../assets/images/h1.png")}
            style={{
              width: 100,
              height: 100,
            }}
          />
          <Image
            source={require("../../assets/images/h3.png")}
            style={{
              width: 100,
              height: 100,
            }}
          />
        </View>
        
        {/* Featured Product */}
        {featuredProduct && (
          <View style={homeStyles.featuredSection}>
            <TouchableOpacity
              style={homeStyles.featuredCard}
              activeOpacity={0.9}
              onPress={() => {
                const isOwner = profile?.role === 'farmer' && profile?.id === featuredProduct.farmerId
                if (isOwner) {
                  router.push(`/products/edit/${featuredProduct.id}`)
                } else {
                  router.push(`/products/${featuredProduct.id}`)
                }
              }}
            >
              <View style={homeStyles.featuredImageContainer}>
                <BlurhashImage
                  uri={resolvedFeatured?.[0] || featuredProduct.images?.[0] || "https://via.placeholder.com/400x240"}
                  blurhash={featuredProduct.imageBlurhashes?.[0]}
                  style={homeStyles.featuredImage}
                />
                <View style={homeStyles.featuredOverlay}>
                  <View style={homeStyles.featuredBadge}>
                    <Text style={homeStyles.featuredBadgeText}>Featured</Text>
                  </View>

                  <View style={homeStyles.featuredContent}>
                    <Text style={homeStyles.featuredTitle} numberOfLines={2}>
                      {featuredProduct.title}
                    </Text>

                    <View style={homeStyles.featuredMeta}>
                      <View style={homeStyles.metaItem}>
                        <Ionicons name="cash-outline" size={16} color={COLORS.white} />
                        <Text style={homeStyles.metaText}>
                          Ksh {featuredProduct.price}/{featuredProduct.unit}
                        </Text>
                      </View>
                      <View style={homeStyles.metaItem}>
                        <Ionicons name="cube-outline" size={16} color={COLORS.white} />
                        <Text style={homeStyles.metaText}>
                          {featuredProduct.quantityAvailable} {featuredProduct.unit}
                        </Text>
                      </View>
                      {featuredProduct.isOrganic && (
                        <View style={homeStyles.metaItem}>
                          <Ionicons name="leaf-outline" size={16} color={COLORS.white} />
                          <Text style={homeStyles.metaText}>Organic</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Categories */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Products Section */}
        <View style={homeStyles.productsSection}>
          <View style={homeStyles.sectionHeader}>
            <Text style={homeStyles.sectionTitle}>
              {selectedCategory ? selectedCategory : "Products"}
            </Text>
          </View>

          {filteredProducts.length > 0 ? (
            <FlatList
              data={filteredProducts}
              renderItem={({ item }) => <ProductCard product={item} />}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              columnWrapperStyle={homeStyles.row}
              contentContainerStyle={homeStyles.productsGrid}
              scrollEnabled={false}
            />
          ) : (
            <View style={homeStyles.emptyState}>
              <EmptyState context="products" />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
