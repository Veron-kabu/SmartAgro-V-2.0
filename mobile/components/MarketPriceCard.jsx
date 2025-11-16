import { View, Text, Image, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { memo } from 'react'
import { marketStyles as s } from '../assets/styles/market-prices.styles'

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
        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
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
        <View style={s.marketColumn}>
          <View style={s.locationRowCenter}>
            <Ionicons name="location" size={14} color={COLORS.primary} />
            <Text style={s.marketTextCenter}>
              {market}{county ? ` - ${county}` : ''}
            </Text>
          </View>
          <Text style={s.updatedCenter}>Updated on {priceDate}</Text>
        </View>
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
  if (value == null) return <View style={s.badgeNeutral}><Text style={s.badgeTextNeutral}>0.00%</Text></View>
  const v = Number(value)
  const up = v >= 0
  const icon = up ? 'arrow-up' : 'arrow-down'
  const textColor = up ? (COLORS.badgeUpText || '#065f46') : (COLORS.badgeDownText || '#991b1b')
  return (
    <View style={s.badge}>
      <Ionicons name={icon} size={12} color={textColor} />
      <Text style={[s.badgeText, { color: textColor }]}>{Math.abs(v).toFixed(2)}%</Text>
    </View>
  )
}

function fmt(n) { return n == null ? '-' : Number(n).toFixed(2) }
