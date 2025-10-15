import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { homeStyles } from "../assets/styles/(tabs)/home.styles";

export default function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  return (
    <View style={homeStyles.categoryFilterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={homeStyles.categoryFilterScrollContent}
      >
        {categories.map((category) => {
          const isSelected = selectedCategory === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              style={[homeStyles.categoryButton, isSelected && homeStyles.selectedCategory]}
              onPress={() => onSelectCategory(isSelected ? null : category.id)}
              activeOpacity={0.7}
            >
              {category.image ? (
                <Image
                  source={category.image}
                  style={[homeStyles.categoryImage, isSelected && homeStyles.selectedCategoryImage]}
                  resizeMode="cover"
                />
              ) : null}
              <Text
                style={[homeStyles.categoryText, isSelected && homeStyles.selectedCategoryText]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
