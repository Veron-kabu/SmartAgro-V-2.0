import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity, Image, ScrollView } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { getJSON } from '../../../context/api'
import { marketStyles as s } from '../../../assets/styles/market-prices.styles'
import { COLORS } from '../../../constants/colors'

export default function Listings() {
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState([])
  const [total, setTotal] = useState(null)
  const [error, setError] = useState(null)
  // Manage listings UI state
  const [fontScale, setFontScale] = useState(0.85)
  const COLW = useMemo(() => ({ product: 260, seller: 160, status: 120, date: 120, actions: 90 }), [])
  const widthScale = useMemo(() => Math.max(0.8, Math.min(1.6, fontScale)), [fontScale])
  const tableBaseWidth = useMemo(() => COLW.product + COLW.seller + COLW.status + COLW.date + COLW.actions, [COLW])
  const tableWidth = useMemo(() => Math.round(tableBaseWidth * widthScale), [tableBaseWidth, widthScale])
  const zoomIn = useCallback(() => setFontScale(f => Math.min(1.5, +(f + 0.1).toFixed(2))), [])
  const zoomOut = useCallback(() => setFontScale(f => Math.max(0.6, +(f - 0.1).toFixed(2))), [])

  const [manageTab, setManageTab] = useState('all') // all | pending | reported
  const [removedIds, setRemovedIds] = useState(new Set())
  const [actionOpenId, setActionOpenId] = useState(null)

  // Mock data (used when backend returns empty)
  const mockData = useMemo(() => [
    { id: 'm1', title: 'Organic Strawberries', farmer_name: 'Alice Johnson', status: 'approved', created_at: '2024-05-01', image: 'https://picsum.photos/seed/straw/120/80' },
    { id: 'm2', title: 'Fresh Farm Eggs', farmer_name: 'Charlie Brown', status: 'approved', created_at: '2024-05-10', image: 'https://picsum.photos/seed/eggs/120/80' },
    { id: 'm3', title: 'Heirloom Tomatoes', farmer_name: 'Ethan Davis', status: 'approved', created_at: '2024-05-12', image: 'https://picsum.photos/seed/tom/120/80' },
    { id: 'm4', title: 'Artisanal Honey', farmer_name: 'Alice Johnson', status: 'reported', created_at: '2024-05-15', image: 'https://picsum.photos/seed/honey/120/80' }
  ], [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        // Try the analytics listings endpoint first (may not exist on all deployments)
        const res = await getJSON('/api/analytics/listings').catch(() => null)
        if (alive) {
          if (res && (Array.isArray(res.items) || Array.isArray(res.listings))) {
            setListings(Array.isArray(res.items) ? res.items : res.listings)
            if (typeof res.total !== 'undefined') setTotal(res.total)
          } else {
            // Fallback: use overview totals if a dedicated endpoint isn't available
            const ov = await getJSON('/api/analytics/overview').catch(() => null)
            if (ov && ov.totals) {
              setTotal(ov.totals.totalListings ?? ov.totals.openListings ?? null)
            }
            setListings([])
          }
        }
      } catch (e) {
        if (alive) setError(e?.message || 'Failed to load listings')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const visibleRows = useMemo(() => {
    const src = (listings && listings.length > 0 ? listings : mockData) || []
      return src.filter((it, idx) => {
        const idKey = String(it.id ?? it.product_id ?? it._id ?? idx)
        if (removedIds.has(idKey)) return false
        if (manageTab === 'reported') return String(it.status || it.state || '').toLowerCase().includes('report')
        return true
      })
  }, [listings, mockData, removedIds, manageTab])

  const reportedCount = useMemo(() => {
    const src = (listings && listings.length > 0 ? listings : mockData) || []
    return src.reduce((acc, it) => acc + (String(it.status || it.state || '').toLowerCase().includes('report') ? 1 : 0), 0)
  }, [listings, mockData])

  const renderItem = ({ item, index }) => {
    // renderItem will only be called for visible items (filtered by data prop)
    const title = item.title || item.name || item.product_title || item.title_text || 'Listing'
    const farmer = item.farmer_name || item.seller_name || item.seller || item.farmerName || item.owner || '—'
    const status = (String(item.status || item.state || '')).toLowerCase()
    const created = item.created_at || item.createdAt || item.created || item.date || ''
    const thumb = item.image || item.thumbnail || (item.media && item.media[0]) || null
    const idKey = String(item.id ?? item.product_id ?? item._id ?? index)

    const statusBadge = () => {
      if (status.includes('report')) return { label: 'Reported', color: '#dc2626' }
      return { label: 'Approved', color: '#10b981' }
    }

    const sb = statusBadge()

    return (
      <View key={idKey} style={[s.tableRow, { minWidth: tableWidth, marginHorizontal: 12, backgroundColor: (index % 2 === 1) ? s.tableRowAlt.backgroundColor : s.tableRow.backgroundColor }]}> 
        <View style={{ minWidth: Math.round(COLW.product * widthScale), flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          {thumb ? <Image source={{ uri: thumb }} style={{ width: 48, height: 48, borderRadius:6 }} /> : <View style={{ width:48, height:48, borderRadius:6, backgroundColor:'#f3f4f6' }} />}
          <View style={{ flex:1 }}>
            <Text style={{ fontSize: Math.round(14 * fontScale), fontWeight: '700', color: '#111827' }} numberOfLines={1}>{title}</Text>
            {item.price ? <Text style={{ fontSize: Math.round(12 * fontScale), color: '#6b7280' }} numberOfLines={1}>Ksh {item.price}</Text> : null}
          </View>
        </View>

        <View style={{ minWidth: Math.round(COLW.seller * widthScale), justifyContent:'center' }}>
          <Text style={{ fontSize: Math.round(13 * fontScale), color: '#111827' }} numberOfLines={1}>{farmer}</Text>
        </View>

        <View style={{ minWidth: Math.round(COLW.status * widthScale), justifyContent:'center' }}>
          <View style={{ backgroundColor: sb.color + '20', paddingHorizontal:8, paddingVertical:6, borderRadius:999, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name={sb.label === 'Approved' ? 'checkmark' : sb.label === 'Pending' ? 'time' : 'alert-circle'} size={12} color={sb.color} />
            <Text style={{ color: sb.color, marginLeft:8, fontWeight:'700' }}>{sb.label}</Text>
          </View>
        </View>

        <View style={{ minWidth: Math.round(COLW.date * widthScale), justifyContent:'center' }}>
          <Text style={{ fontSize: Math.round(12 * fontScale), color: '#374151' }} numberOfLines={1}>{created ? String(created).split('T')[0] : '—'}</Text>
        </View>

        <View style={{ minWidth: Math.round(COLW.actions * widthScale), alignItems:'flex-end', justifyContent:'center', paddingRight:12 }}>
          {actionOpenId === idKey ? (
            <TouchableOpacity onPress={() => { setRemovedIds(prev => new Set(prev).add(idKey)); setActionOpenId(null) }} style={{ backgroundColor: '#60a5fa', paddingHorizontal:12, paddingVertical:8, borderRadius:8 }}>
              <Text style={{ color: '#fff', fontWeight:'700' }}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setActionOpenId(idKey)} style={{ padding:8 }}>
              <Ionicons name="ellipsis-vertical" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex:1, backgroundColor:'#f3f4f6' }}>
      <View style={{ padding:16 }}>
        <Text style={{ fontSize:20, fontWeight:'800', color:'#111827' }}>Listings</Text>
        <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
          <View style={{ flex:1, backgroundColor:'#fff', padding:12, borderRadius:8 }}>
            <Text style={{ color:'#6b7280' }}>Total</Text>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111827', marginTop:6 }}>{total != null ? Number(total).toLocaleString() : '—'}</Text>
          </View>
          <View style={{ flex:1, backgroundColor:'#fff', padding:12, borderRadius:8 }}>
            <Text style={{ color:'#6b7280' }}>Reported</Text>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#dc2626', marginTop:6 }}>{reportedCount != null ? Number(reportedCount).toLocaleString() : '—'}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding:16 }}>
          <Text style={{ color:'#ef4444' }}>{error}</Text>
        </View>
      ) : (
        <View style={{ flex:1 }}>
          {/* Vertical scroll with header + horizontal table */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
            <View style={{ paddingHorizontal:16, paddingTop:8 }}>
              <Text style={{ fontSize:20, fontWeight:'800', color:'#111827' }}>Manage Listings</Text>
              <Text style={{ color:'#6b7280', marginTop:4 }}>Review and manage all product listings.</Text>
            </View>

            {/* Zoom controls */}
            <View style={{ paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', gap:12 }}>
              <Text style={{ color:'#6b7280' }}>Zoom</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <TouchableOpacity onPress={zoomOut} style={{ padding:8, backgroundColor:'#fff', borderRadius:6 }}>
                  <Ionicons name="remove" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={{ width:48, textAlign:'center' }}>{Math.round(fontScale * 100)}%</Text>
                <TouchableOpacity onPress={zoomIn} style={{ padding:8, backgroundColor:'#fff', borderRadius:6 }}>
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tabs below zoom as requested (removed 'pending') */}
            <View style={{ paddingHorizontal:16, paddingBottom:8 }}>
              <View style={{ flexDirection:'row' }}>
                {['all','reported'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setManageTab(t)} style={{ backgroundColor: manageTab===t ? '#f3f4f6' : '#ffffff', paddingHorizontal:12, paddingVertical:8, borderRadius:8, marginRight:8 }}>
                    <Text style={{ color: manageTab===t ? '#111827' : '#6b7280', fontWeight: manageTab===t ? '700' : '400' }}>{t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Table header + horizontal scroll like details.jsx */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: tableWidth }}>
                <View style={[s.tableHeader, { minWidth: tableWidth, marginHorizontal: 12 }]}> 
                  <Text style={[s.th, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.product * widthScale) }]}>Product</Text>
                  <Text style={[s.th, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.seller * widthScale) }]}>Farmer</Text>
                  <Text style={[s.th, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.status * widthScale) }]}>Status</Text>
                  <Text style={[s.th, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.date * widthScale) }]}>Created At</Text>
                  <Text style={[s.th, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.actions * widthScale) }]}>Actions</Text>
                </View>

                {/* Rows */}
                {visibleRows.map((row, i) => renderItem({ item: row, index: i }))}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      )}
    </View>
  )
}
