import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/colors";
import { productCardStyles } from "../assets/styles/(tabs)/home.styles";
import BlurhashImage from "./BlurhashImage";
import { useResolvedUrls } from "../hooks/useResolvedUrls";
import { getJSON } from "../context/api";
import { useProfile } from "../context/profile";
import { useFavorites } from "../context/favorites";
import { useChat } from "../context/chat";

export default function ProductCard({ product, inCart = false, onBuy = null, onRemove = null }) {
  const router = useRouter();
  const { profile } = useProfile();
  const { toggleFavorite: toggleFavCtx, isFavorited } = useFavorites();
  const { createOrFindChatRoom, setCurrentChatRoom } = useChat();
  const resolvedImages = useResolvedUrls(product?.images || []);
  
  const isOwner = profile?.role === 'farmer' && profile?.id === product.farmerId;

  const handleAddToFavorites = async () => {
    if (profile?.id && product.farmerId === profile.id) {
      Alert.alert('Not allowed', 'You cannot favorite your own product');
      return;
    }
    try {
      await toggleFavCtx(product.id, {
        title: product.title,
        price: product.price,
        unit: product.unit,
        images: product.images,
        imageBlurhashes: product.imageBlurhashes,
        location: product.location,
        quantityAvailable: product.quantityAvailable,
        status: product.status,
        farmerId: product.farmerId,
        farmerEmail: product.farmerEmail,
        isOrganic: product.isOrganic,
        description: product.description,
      });
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to toggle favorite');
    }
  };

  const handleStartChat = async () => {
    // Try to derive contact email from multiple possible fields
    const deriveEmail = (p) => p?.farmerEmail || p?.farmer?.email || p?.farmerEmailAddress || p?.contactEmail || p?.farmer?.emailAddress

    let contactEmail = deriveEmail(product)
    // If not present (e.g., coming from a minimal favorite object), fetch product details once
    if (!contactEmail && product?.id) {
      try {
        const full = await getJSON(`/api/products/${product.id}`)
        contactEmail = deriveEmail(full)
      } catch (_) {
        // ignore fetch errors here; we'll show the alert below if still missing
      }
    }
    if (!contactEmail) {
      Alert.alert('Error', 'Farmer contact information not available')
      return
    }

    if (profile?.id && product.farmerId === profile.id) {
      Alert.alert('Not allowed', 'You cannot chat with yourself');
      return;
    }

    try {
  const roomName = `Chat about ${product.title}`;
  const chatRoom = await createOrFindChatRoom(contactEmail, roomName);
      if (chatRoom) {
        setCurrentChatRoom(chatRoom);
        // Navigate straight to the chat interface
        router.push('/chat/conversation');
      } else {
        Alert.alert('Error', 'Failed to start chat. Please try again.');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  const goToProduct = () => {
    if (isOwner) {
      router.push(`/products/edit/${product.id}`);
    } else {
      router.push(`/products/${product.id}`);
    }
  };
  const goToView = () => router.push(`/products/${product.id}`)
  const goToEdit = () => router.push(`/products/edit/${product.id}`)

  const getStatusInfo = () => {
    const status = (product.status || '').toLowerCase();
    const qty = (product.quantityAvailable !== undefined && product.quantityAvailable !== null) ? Number(product.quantityAvailable) : null;
    let label = 'Active';
    let bg = COLORS.card; let fg = COLORS.text;

    if (status && status !== 'active') {
      if (status === 'sold') { label = 'Sold'; bg = COLORS.errorLight || COLORS.error; fg = COLORS.error; }
      else if (status === 'expired') { label = 'Expired'; bg = COLORS.border || COLORS.card; fg = COLORS.text; }
      else if (status === 'inactive') { label = 'Inactive'; bg = COLORS.warning || COLORS.border; fg = COLORS.warningText || COLORS.text; }
      else { label = status; }
    }
    // Only mark out-of-stock when we explicitly know quantity is zero
    if (qty === 0) { label = 'Out of Stock'; bg = COLORS.errorLight || COLORS.error; fg = COLORS.error; }
    
    return { label, bg, fg };
  };

  // Location text helper removed as location is no longer displayed on the card

  const statusInfo = getStatusInfo();

  return (
    <TouchableOpacity
      style={productCardStyles.container}
      onPress={isOwner ? goToView : goToProduct}
      activeOpacity={0.8}
    >
      <View style={productCardStyles.imageContainer}>
        <BlurhashImage
          uri={resolvedImages?.[0] || product.images?.[0] || "https://via.placeholder.com/200"}
          blurhash={product.imageBlurhashes?.[0]}
          style={productCardStyles.image}
        />

        {/* Favorite Button */}
        {!isOwner && (
          <TouchableOpacity 
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 16,
              padding: 6,
            }}
            onPress={handleAddToFavorites}
          >
            <Ionicons 
              name={isFavorited(product.id) ? "heart" : "heart-outline"} 
              size={20} 
              color={isFavorited(product.id) ? COLORS.error : COLORS.white} 
            />
          </TouchableOpacity>
        )}

        {/* Organic Badge */}
        {product.isOrganic && (
          <View style={{
            position: "absolute",
            top: 8,
            left: 8,
            backgroundColor: COLORS.primary,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
          }}>
            <Text style={{ fontSize: 10, fontWeight: "600", color: COLORS.white }}>
              Organic
            </Text>
          </View>
        )}

        {/* Owner Badge */}
        {isOwner && (
          <View style={{
            position: 'absolute',
            top: product.isOrganic ? 36 : 8,
            left: 8,
            backgroundColor: COLORS.warning || '#fef3c7',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.warningText || '#92400e' }}>
              Yours
            </Text>
          </View>
        )}
      </View>

      <View style={productCardStyles.content}>
        <Text style={productCardStyles.title} numberOfLines={2}>
          {product.title}
        </Text>

        {/* Status Badge (only show when not plain "Active") */}
        {statusInfo.label && String(statusInfo.label).toLowerCase() !== 'active' && (
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Text style={{
              backgroundColor: statusInfo.bg,
              color: statusInfo.fg,
              fontSize: 10,
              fontWeight: '700',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8
            }}>
              {statusInfo.label}
            </Text>
          </View>
        )}

        <View style={productCardStyles.footer}>
          <View style={productCardStyles.timeContainer}>
            {Number(product?.discountPercent) > 0 ? (
              <Text style={productCardStyles.timeText}>
                <Text style={{ textDecorationLine: 'line-through', color: COLORS.textLight }}>Ksh {Number(product.price).toFixed(2)}</Text>
                {`  `}
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>Ksh {(Number(product.price) * (1 - Number(product.discountPercent)/100)).toFixed(2)}</Text>
              </Text>
            ) : (
              <Text style={[productCardStyles.timeText, { color: COLORS.text, fontWeight: '700' }]}>Ksh {Number(product.price).toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* Location intentionally hidden to prevent overflow of long place names */}

        {/* Action Buttons */}
        <View style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {inCart ? (
              // When inside Cart: use original Chat-style pill for Buy (white background, primary border/text)
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.white,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  marginRight: 8,
                }}
                onPress={() => {
                  if (typeof onBuy === 'function') return onBuy()
                  // fallback: navigate to product view
                  goToView()
                }}
              >
                <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: '600' }}>Buy</Text>
              </TouchableOpacity>
            ) : (!isOwner ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.white,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  marginRight: 8,
                }}
                onPress={handleStartChat}
              >
                <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: '600' }}>Chat</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.white,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  marginRight: 8,
                }}
                onPress={goToEdit}
              >
                <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: '600' }}>Edit</Text>
              </TouchableOpacity>
            ))}
          </View>

          {inCart ? (
            // Render delete as an error-outline pill (like the Clear pill)
            <TouchableOpacity
              onPress={() => { if (typeof onRemove === 'function') return onRemove(); /* no-op */ }}
              style={{
                backgroundColor: COLORS.card,
                borderWidth: 1,
                borderColor: COLORS.error,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.primary,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}
              onPress={goToView}
            >
              <Text style={{ fontSize: 10, color: COLORS.white, fontWeight: '600' }}>View</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}