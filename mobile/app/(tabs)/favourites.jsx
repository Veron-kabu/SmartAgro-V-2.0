import { View, Text, Alert, ScrollView, TouchableOpacity, FlatList, RefreshControl, Image, Animated, PanResponder } from "react-native";
import { COLORS } from '../../constants/colors'
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback, useRef } from 'react'
import Shimmer from '../../components/Shimmer'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getJSON } from '../../context/api'
import { subscribeAppEvents } from '../../context/favorites'
import { useProfile } from '../../context/profile'
import { useCart } from '../../context/cart'
import { favoritesStyles } from "../../assets/styles/(tabs)/favorites.styles";
import { Ionicons } from "@expo/vector-icons";
import ProductCard from "../../components/ProductCard";
import NoFavoritesFound from "../../components/NoFavoritesFound";
import LoadingSpinner from "../../components/LoadingSpinner";
import { router } from 'expo-router'

const FavoritesScreen = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { profile } = useProfile()
  const { items: cartItems, updateQuantity, removeItem, clearCart, getTotalPrice, addItem } = useCart()
  
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showCart, setShowCart] = useState(true)
  const [undoData, setUndoData] = useState(null)
  const undoTimeoutRef = useRef(null)
  const SWIPE_THRESHOLD = 50
  const gestureRefs = useRef({})

  // Persist collapsed state
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('fav:cartCollapsed')
        if (saved === '0' || saved === '1') setShowCart(saved === '1')
      } catch {}
    })()
  }, [])

  const toggleCart = useCallback(() => {
    setShowCart(prev => {
      const next = !prev
      AsyncStorage.setItem('fav:cartCollapsed', next ? '1':'0').catch(()=>{})
      return next
    })
  }, [])

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
        const { productId, favorited } = evt.payload || {}
        if (!productId) return
        setFavoriteProducts(prev => {
          const exists = prev.some(f => f.id === productId)
          if (favorited) {
            if (exists) return prev
            // Add skeletal entry first
            const entry = { id: productId, title: 'Loading...', __hydrating: true }
            // Hydrate asynchronously
            hydrateProduct(productId)
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
      }
    })
    return () => { mounted = false; unsub && unsub() }
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadFavorites()
    setRefreshing(false)
  }, [loadFavorites])

  const handleSignOut = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: signOut },
    ]);
  };

  if (loading) return <LoadingSpinner message="Loading your favorites..." />;

  return (
    <View style={favoritesStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
        <View style={favoritesStyles.header}>
          <Text style={favoritesStyles.title}>Favorites</Text>
          <TouchableOpacity style={favoritesStyles.logoutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Enhanced Cart Section */}
        {cartItems.length > 0 && (
          <View style={favoritesStyles.cartSection}>
            <TouchableOpacity 
              style={favoritesStyles.cartHeader} 
              onPress={toggleCart} 
              activeOpacity={0.7}
            >
              <View style={favoritesStyles.cartHeaderLeft}>
                <Ionicons 
                  name={showCart ? "chevron-down" : "chevron-forward"} 
                  size={20} 
                  color={COLORS.text} 
                />
                <Ionicons name="cart" size={20} color={COLORS.primary} style={favoritesStyles.cartIcon} />
                <Text style={favoritesStyles.cartTitle}>Cart ({cartItems.length})</Text>
              </View>
              <View style={favoritesStyles.cartActions}>
                <Text style={favoritesStyles.cartTotal}>KSH {getTotalPrice().toFixed(2)}</Text>
                <TouchableOpacity onPress={clearCart} activeOpacity={0.7}>
                  <Text style={favoritesStyles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            
            {showCart && (
              <View style={favoritesStyles.cartContent}>
                {cartItems.map(ci => {
                  if (!gestureRefs.current[ci.id]) {
                    gestureRefs.current[ci.id] = { translateX: new Animated.Value(0) }
                  }
                  const ref = gestureRefs.current[ci.id]
                  const panResponder = PanResponder.create({
                    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12,
                    onPanResponderMove: (_, g) => {
                      if (g.dx < 0) ref.translateX.setValue(Math.max(g.dx, -120))
                    },
                    onPanResponderRelease: (_, g) => {
                      if (g.dx < -SWIPE_THRESHOLD) {
                        Animated.timing(ref.translateX, { toValue: -120, duration: 160, useNativeDriver: true }).start()
                      } else {
                        Animated.spring(ref.translateX, { toValue: 0, useNativeDriver: true }).start()
                      }
                    }
                  })
                  
                  const performDelete = () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{})
                    const original = { ...ci }
                    removeItem(ci.id)
                    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
                    undoTimeoutRef.current = setTimeout(() => {
                      setUndoData(null)
                    }, 5000)
                    setUndoData({ item: original })
                  }
                  
                  return (
                    <View key={ci.id} style={favoritesStyles.cartItemContainer}>
                      <View style={favoritesStyles.swipeDeleteLayer}>
                        <TouchableOpacity style={favoritesStyles.deleteBtn} onPress={performDelete}>
                          <Ionicons name="trash" size={20} color={COLORS.white} />
                          <Text style={favoritesStyles.deleteBtnText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      <Animated.View 
                        style={[favoritesStyles.cartItem, { transform:[{ translateX: ref.translateX }] }]} 
                        {...panResponder.panHandlers}
                      >
                        <Image 
                          source={{ uri: ci.images?.[0] || ci.imageUrl || 'https://via.placeholder.com/60' }} 
                          style={favoritesStyles.cartItemImage} 
                        />
                        <View style={favoritesStyles.cartItemInfo}>
                          <Text style={favoritesStyles.cartItemName} numberOfLines={1}>{ci.title}</Text>
                          <Text style={favoritesStyles.cartItemPrice}>KSH {ci.price} / {ci.unit}</Text>
                          <View style={favoritesStyles.quantityControls}>
                            <TouchableOpacity 
                              style={favoritesStyles.quantityBtn} 
                              onPress={() => updateQuantity(ci.id, ci.quantity - 1)}
                            >
                              <Ionicons name="remove" size={16} color={COLORS.text} />
                            </TouchableOpacity>
                            <Text style={favoritesStyles.quantityText}>{ci.quantity}</Text>
                            <TouchableOpacity 
                              style={favoritesStyles.quantityBtn} 
                              onPress={() => updateQuantity(ci.id, ci.quantity + 1)}
                            >
                              <Ionicons name="add" size={16} color={COLORS.text} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={favoritesStyles.cartItemRight}>
                          <Text style={favoritesStyles.cartItemSubtotal}>
                            KSH {(ci.price * ci.quantity).toFixed(2)}
                          </Text>
                        </View>
                      </Animated.View>
                    </View>
                  )
                })}
                
                <TouchableOpacity 
                  style={favoritesStyles.checkoutButton} 
                  activeOpacity={0.85} 
                  onPress={() => router.push('/orders/checkout')}
                >
                  <Ionicons name="card" size={20} color={COLORS.white} style={favoritesStyles.checkoutIcon} />
                  <Text style={favoritesStyles.checkoutText}>
                    Checkout • KSH {getTotalPrice().toFixed(2)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

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
              ListEmptyComponent={<NoFavoritesFound />}
            />
          )}
        </View>
      </ScrollView>

      {/* Enhanced Undo Snackbar */}
      {undoData && (
        <Animated.View style={favoritesStyles.undoSnackbar}>
          <View style={favoritesStyles.undoContent}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
            <Text style={favoritesStyles.undoText}>
              Removed {undoData.item.title}
            </Text>
          </View>
          <TouchableOpacity
            style={favoritesStyles.undoButton}
            onPress={() => {
              if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
              addItem(undoData.item, undoData.item.quantity)
              Haptics.selectionAsync().catch(()=>{})
              setUndoData(null)
            }}
          >
            <Text style={favoritesStyles.undoButtonText}>UNDO</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

export default FavoritesScreen;


