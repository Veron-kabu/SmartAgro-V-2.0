import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { getJSON } from "../../context/api";
import { useDebounce } from "../../hooks/useDebounce";
import { searchStyles } from "../../assets/styles/(tabs)/search.styles";
import { COLORS } from "../../constants/colors";
import { Ionicons } from "@expo/vector-icons";
import ProductCard from "../../components/ProductCard";
import EmptyState from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const performSearch = async (query) => {
    // if no search query
    if (!query.trim()) {
      try {
        const randomProducts = await getJSON('/api/products?limit=12');
        return Array.isArray(randomProducts) ? randomProducts : (randomProducts?.items || []);
      } catch (error) {
        console.error("Error fetching random products:", error);
        return [];
      }
    }

    // search by name first, then by category if no results
    try {
      const nameResults = await getJSON(`/api/products?search=${encodeURIComponent(query)}&limit=12`);
      let results = Array.isArray(nameResults) ? nameResults : (nameResults?.items || []);

      if (results.length === 0) {
        // Try searching by category
        const categoryResults = await getJSON(`/api/products?category=${encodeURIComponent(query.toLowerCase())}&limit=12`);
        results = Array.isArray(categoryResults) ? categoryResults : (categoryResults?.items || []);
      }

      return results.slice(0, 12);
    } catch (error) {
      console.error("Error searching products:", error);
      return [];
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const results = await performSearch("");
        setProducts(results);
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (initialLoading) return;

    const handleSearch = async () => {
      setLoading(true);

      try {
        const results = await performSearch(debouncedSearchQuery);
        setProducts(results);
      } catch (error) {
        console.error("Error searching:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    handleSearch();
  }, [debouncedSearchQuery, initialLoading]);

  if (initialLoading) return <LoadingSpinner message="Loading products..." />;

  return (
    <View style={searchStyles.container}>
      <View style={searchStyles.searchSection}>
        <View style={searchStyles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={COLORS.textLight}
            style={searchStyles.searchIcon}
          />
          <TextInput
            style={searchStyles.searchInput}
            placeholder="Search products, categories..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={searchStyles.clearButton}>
              <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={searchStyles.resultsSection}>
        <View style={searchStyles.resultsHeader}>
          <Text style={searchStyles.resultsTitle}>
            {searchQuery ? `Results for "${searchQuery}"` : "Popular Products"}
          </Text>
          <Text style={searchStyles.resultsCount}>{products.length} found</Text>
        </View>

        {loading ? (
          <View style={searchStyles.loadingContainer}>
            <LoadingSpinner message="Searching products..." size="small" />
          </View>
        ) : (
          <FlatList
            data={products}
            renderItem={({ item }) => <ProductCard product={item} />}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            columnWrapperStyle={searchStyles.row}
            contentContainerStyle={searchStyles.productsGrid}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState context="search" />}
          />
        )}
      </View>
    </View>
  );
};

export default SearchScreen;



