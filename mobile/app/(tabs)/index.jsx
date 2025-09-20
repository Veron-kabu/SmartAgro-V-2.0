"use client"

import { useEffect, useState } from "react"
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, RefreshControl, Alert } from "react-native"
import { useAuth, useUser } from "@clerk/clerk-expo"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { getJSON } from "../../context/api"

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001"

export default function HomeScreen() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const [profile, setProfile] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [recentProducts, setRecentProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    if (!isSignedIn) return

    try {
      const [profileRes, productsRes] = await Promise.all([
        getJSON(`${apiUrl}/api/users/profile`),
        getJSON(`${apiUrl}/api/products?limit=5`),
      ])

      setProfile(profileRes)
      setRecentProducts(productsRes?.slice(0, 5) || [])

      // Fetch role-specific dashboard data
      if (profileRes?.role === "farmer") {
        const farmerData = await getJSON(`${apiUrl}/api/dashboard/farmer`)
        setDashboardData(farmerData)
      }
    } catch (error) {
      console.error("Error fetching home data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [isSignedIn])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handleRoleSwitch = async () => {
    if (profile?.role !== "farmer") return

    Alert.alert("Switch Role", "Switch between Farmer and Buyer mode?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Switch to Buyer",
        onPress: async () => {
          try {
            await fetch(`${apiUrl}/api/users/role`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "buyer" }),
            })
            fetchData()
          } catch (error) {
            Alert.alert("Error", "Failed to switch role")
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening"}
          </Text>
          <Text style={styles.userName}>{profile?.fullName || user?.firstName || "User"}</Text>
          <View style={styles.roleContainer}>
            <Text style={styles.roleText}>{profile?.role?.toUpperCase()}</Text>
            {profile?.role === "farmer" && (
              <TouchableOpacity onPress={handleRoleSwitch} style={styles.switchButton}>
                <Ionicons name="swap-horizontal" size={16} color="#16a34a" />
                <Text style={styles.switchText}>Switch to Buyer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Image source={{ uri: user?.imageUrl || "https://via.placeholder.com/50" }} style={styles.profileImage} />
        </TouchableOpacity>
      </View>

      {/* Dashboard Stats for Farmers */}
      {profile?.role === "farmer" && dashboardData && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="leaf" size={24} color="#16a34a" />
            <Text style={styles.statNumber}>{dashboardData.totalProducts}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="receipt" size={24} color="#f59e0b" />
            <Text style={styles.statNumber}>{dashboardData.activeOrders}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash" size={24} color="#10b981" />
            <Text style={styles.statNumber}>${dashboardData.totalRevenue}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          {profile?.role === "farmer" && (
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/products")}>
              <Ionicons name="add-circle" size={32} color="#16a34a" />
              <Text style={styles.actionText}>Add Product</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/market")}>
            <Ionicons name="storefront" size={32} color="#3b82f6" />
            <Text style={styles.actionText}>Browse Market</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/messages")}>
            <Ionicons name="chatbubbles" size={32} color="#8b5cf6" />
            <Text style={styles.actionText}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/orders")}>
            <Ionicons name="receipt" size={32} color="#f59e0b" />
            <Text style={styles.actionText}>Orders</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Products */}
      {recentProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fresh Products</Text>
            <TouchableOpacity onPress={() => router.push("/market")}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentProducts.map((product) => (
              <TouchableOpacity key={product.id} style={styles.productCard}>
                <Image
                  source={{ uri: product.images?.[0] || "https://via.placeholder.com/120" }}
                  style={styles.productImage}
                />
                <Text style={styles.productTitle} numberOfLines={2}>
                  {product.title}
                </Text>
                <Text style={styles.productPrice}>
                  ${product.price}/{product.unit}
                </Text>
                <Text style={styles.productLocation}>{product.location}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#ffffff",
  },
  greeting: {
    fontSize: 16,
    color: "#6b7280",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 4,
  },
  roleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  switchButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  switchText: {
    fontSize: 12,
    color: "#16a34a",
    marginLeft: 4,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 14,
    color: "#16a34a",
    fontWeight: "600",
  },
  actionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    minWidth: "45%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginTop: 8,
    textAlign: "center",
  },
  productCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  productTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginTop: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#16a34a",
    marginTop: 4,
  },
  productLocation: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
})
