// Review helpers: map star ratings to category labels and sentiments

export const REVIEW_CATEGORIES = [
  { key: 'All', label: 'All', rating: null, sentiment: 'Any' },
  { key: 'Excellent', label: 'Excellent', rating: 5, sentiment: 'Very Positive' },
  { key: 'Good', label: 'Good', rating: 4, sentiment: 'Positive' },
  { key: 'Neutral', label: 'Neutral', rating: 3, sentiment: 'Neutral' },
  { key: 'Poor', label: 'Poor', rating: 2, sentiment: 'Negative' },
  { key: 'Terrible', label: 'Terrible', rating: 1, sentiment: 'Very Negative' },
]

export function ratingToCategory(rating) {
  const found = REVIEW_CATEGORIES.find(c => c.rating === Number(rating))
  return found || { key: 'Unknown', label: 'Unknown', rating: null, sentiment: 'Unknown' }
}

export function categoryKeyToRating(key) {
  const found = REVIEW_CATEGORIES.find(c => c.key === key)
  return typeof found?.rating === 'number' ? found.rating : null
}
