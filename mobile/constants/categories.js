// Shared categories used across Home and Post Listing
// Note: removed the 'All' chip. Each category includes a local image.
export const CATEGORIES = [
  // Crop Types
  { id: 'vegetables', name: 'Vegetables', image: require('../assets/images/vegetable.png') },
  { id: 'fruits', name: 'Fruits', image: require('../assets/images/fruits.png') },
  { id: 'grains', name: 'Grains', image: require('../assets/images/grain.png') },
  { id: 'roots', name: 'Roots', image: require('../assets/images/root.png') },
  { id: 'nuts', name: 'Nuts', image: require('../assets/images/nuts.png') },
  // Animal Products
  { id: 'dairy', name: 'Dairy', image: require('../assets/images/dairy.png') },
  { id: 'eggs', name: 'Eggs', image: require('../assets/images/eggs.png') },
]

export const CATEGORIES_FOR_FORM = [
  { id: 'all', name: 'Select', icon: 'list' },
  ...CATEGORIES,
]
