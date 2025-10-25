import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { memo } from 'react'

function MarketPriceCard({ item, onPress }) {
  const {
    title,
    icon,
    wholesale,
    retail,
    unit,
    wholesaleChange,
    retailChange,
    market,
    county,
    priceDate,
  } = item

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.card}>
      <View style={s.headerRow}>
        <Image source={{ uri: icon }} style={s.icon} />
        <Text numberOfLines={2} style={s.title}>{title}</Text>
        <Ionicons name="chevron-forward" size={18} color="#f97316" />
      </View>

      <View style={s.grid}>
        <View style={s.box}>
          <Text style={s.boxLabel}>Wholesale ({unit || '-'})</Text>
          <Text style={s.price}>Ksh {fmt(wholesale)}</Text>
          <ChangeBadge value={wholesaleChange} />
        </View>
        <View style={s.box}>
          <Text style={s.boxLabel}>Retail ({unit || '-'})</Text>
          <Text style={s.price}>Ksh {fmt(retail)}</Text>
          <ChangeBadge value={retailChange} />
        </View>
      </View>

      <View style={s.footer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="location" size={14} color="#f97316" />
          <Text style={s.marketText}>
            {market}{county ? ` - ${county}` : ''}
          </Text>
        </View>
        <Text style={s.updated}>Updated on {priceDate}</Text>
      </View>
    </TouchableOpacity>
  )
}

// Prevent unnecessary re-renders for unchanged items
function areEqual(prev, next) {
  const a = prev.item || {}
  const b = next.item || {}
  const fields = ['id','title','icon','wholesale','retail','unit','wholesaleChange','retailChange','market','county','priceDate']
  for (const f of fields) {
    if (a[f] !== b[f]) return false
  }
  return true
}

export default memo(MarketPriceCard, areEqual)
function ChangeBadge({ value }) {
  if (value == null) return <View style={s.badgeNeutral}><Text style={s.badgeNeutralText}>0.00%</Text></View>
  const v = Number(value)
  const up = v > 0
  const color = up ? '#065f46' : '#991b1b'
  const bg = up ? '#d1fae5' : '#fee2e2'
  const icon = up ? 'arrow-up' : 'arrow-down'
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[s.badgeText, { color }]}>{Math.abs(v).toFixed(2)}%</Text>
    </View>
  )
}

function fmt(n) { return n == null ? '-' : Number(n).toFixed(2) }

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  box: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  boxLabel: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeNeutral: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeNeutralText: { color: '#374151', fontSize: 12, fontWeight: '700' },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marketText: { marginLeft: 6, color: '#f97316', fontWeight: '700' },
  updated: { color: '#6b7280', fontSize: 12 },
})
