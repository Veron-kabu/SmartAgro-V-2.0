import { View, Text, ScrollView, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { COLORS } from '../../constants/colors'
import { useUser } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback } from 'react'
import Shimmer from '../../components/Shimmer'
import { getJSON } from '../../context/api'
import { subscribeAppEvents } from '../../context/favorites'
import { useProfile } from '../../context/profile'
import { favoritesStyles } from "../../assets/styles/(tabs)/favorites.styles";
import { Ionicons } from "@expo/vector-icons";
import ProductCard from "../../components/ProductCard";
import EmptyState from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";

// Payment and validation now handled in /orders/checkout

const FavoritesScreen = () => {
  const { user } = useUser();
  const { profile } = useProfile()
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadFavorites = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError('');
      
      const data = await getJSON('/api/favorites');
      
      if (Array.isArray(data)) {
        // Transform the data to match the ProductCard component's expected format
        const transformedFavorites = data.map((favorite) => ({
          ...favorite.product,
          id: favorite.product?.id || favorite.id,
          favoriteId: favorite.id,
          farmerEmail: favorite.product?.farmerEmail || favorite?.farmer?.email || favorite?.product?.farmer?.email,
        }));
        setFavoriteProducts(transformedFavorites);
      } else {
        setFavoriteProducts([]);
      }
    } catch (error) {
      console.log("Error loading favorites", error);
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (profile?.id) loadFavorites()
  }, [loadFavorites, profile?.id]);

  // Real-time subscription to app events for favorites & product deletions
  useEffect(() => {
    const hydrateCache = new Map()
    let mounted = true
    
    async function hydrateProduct(productId) {
      if (hydrateCache.has(productId)) return hydrateCache.get(productId)
      const p = (async () => {
        try {
          const data = await getJSON(`/api/products/${productId}`)
          if (!mounted) return null
          setFavoriteProducts(prev => prev.map(it => it.id === productId ? {
            ...it,
            ...data,
            id: data.id,
            title: data.title,
            price: data.price,
            unit: data.unit,
            images: data.images,
            farmerEmail: data.farmerEmail,
            location: data.location,
            farmerId: data.farmerId
          } : it))
        } catch (_e) {
          // 404 -> mark deleted
          setFavoriteProducts(prev => prev.filter(it => it.id !== productId))
        }
      })()
      hydrateCache.set(productId, p)
      return p
    }
    
    const unsub = subscribeAppEvents(evt => {
      if (!mounted) return
      if (evt.type === 'favorite:changed') {
        const { productId, favorited, snapshot } = evt.payload || {}
        if (!productId) return
        setFavoriteProducts(prev => {
          const exists = prev.some(f => f.id === productId)
          if (favorited) {
            if (exists) return prev
            // Add skeletal entry first
            const entry = snapshot ? { ...snapshot, id: productId } : { id: productId, title: 'Loading...', __hydrating: true }
            // Hydrate asynchronously if snapshot missing important fields
            if (!snapshot) hydrateProduct(productId)
            return [entry, ...prev]
          } else {
            if (!exists) return prev
            return prev.filter(f => f.id !== productId)
          }
        })
      } else if (evt.type === 'product:deleted') {
        const { productId } = evt.payload || {}
        if (!productId) return
        setFavoriteProducts(prev => prev.filter(f => f.id !== productId))
      } else if (evt.type === 'product:stockChanged') {
        const { productId, remaining, status } = evt.payload || {}
        if (!productId) return
        setFavoriteProducts(prev => prev.map(f => f.id === productId ? { ...f, quantityAvailable: remaining, status: status || f.status } : f))
      } else if (evt.type === 'product:updated') {
        const { productId, product } = evt.payload || {}
        const id = productId || product?.id
        if (!id) return
        if (product) {
          setFavoriteProducts(prev => prev.map(it => it.id === id ? { ...it, ...product, id: product.id || id } : it))
        } else {
          // hydrate full product data if no snapshot provided
          hydrateProduct(id)
        }
      }
    })
    return () => { mounted = false; unsub && unsub() }
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadFavorites()
    setRefreshing(false)
  }, [loadFavorites])

  


  if (loading) return <LoadingSpinner message="Loading your favorites..." />;

  return (
    <View style={favoritesStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
        <View style={favoritesStyles.header}>
          <Text style={favoritesStyles.title}>Favorites</Text>
        </View>

              {/* Cart moved to separate Cart tab */}

        <View style={favoritesStyles.productsSection}>
          {error ? (
            <View style={favoritesStyles.errorState}>
              <Ionicons name="alert-circle" size={48} color={COLORS.textLight} />
              <Text style={favoritesStyles.errorTitle}>Error loading favorites</Text>
              <Text style={favoritesStyles.errorDescription}>{error}</Text>
              <TouchableOpacity style={favoritesStyles.retryButton} onPress={loadFavorites}>
                <Text style={favoritesStyles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={favoriteProducts}
              renderItem={({ item }) => {
                // Skeleton while hydrating
                if (item.__hydrating) {
                  return (
                    <View style={favoritesStyles.skeletonCard}>
                      <Shimmer style={favoritesStyles.skeletonImage} />
                      <View style={favoritesStyles.skeletonContent}>
                        <Shimmer style={favoritesStyles.skeletonTitle} />
                        <Shimmer style={favoritesStyles.skeletonPrice} />
                        <View style={favoritesStyles.skeletonBadges}>
                          <Shimmer style={favoritesStyles.skeletonBadge} />
                          <Shimmer style={favoritesStyles.skeletonBadge} />
                        </View>
                      </View>
                    </View>
                  )
                }
                return <ProductCard product={item} />
              }}
              keyExtractor={(item) => item.id?.toString() || item.favoriteId?.toString()}
              numColumns={2}
              columnWrapperStyle={favoritesStyles.row}
              contentContainerStyle={favoritesStyles.productsGrid}
              scrollEnabled={false}
              ListEmptyComponent={<EmptyState context="favorites" />}
            />
          )}
        </View>
      </ScrollView>

      {/* Undo snackbar removed from Favorites; cart actions live in Cart tab */}
    </View>
  );
};

export default FavoritesScreen;


