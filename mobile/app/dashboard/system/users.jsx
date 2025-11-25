import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { getJSON, postJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'
import { VictoryLine, VictoryChart, VictoryAxis, VictoryTheme, VictoryArea, VictoryPie } from 'victory-native'

// Stable constants for chart labeling
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TARGET_MONTHS = [8,9,10,11]

// Module-level cache so the growth chart has data instantly on subsequent opens
let cachedAnalyticsUsers = null

export default function Users() {
  // Safe default so chart renders immediately even before network fetch
  const DEFAULT_ANALYTICS = {
    growth: [],
    totals: { farmers: 0, buyers: 0 },
    users: [],
  }
  // Seed analytics data state from cache so chart renders immediately
  const [data, setData] = useState(() => cachedAnalyticsUsers || DEFAULT_ANALYTICS)
  const [showManage, setShowManage] = useState(false)
  const [filter, setFilter] = useState('all')
  const [fontScale, setFontScale] = useState(0.85)
  const [usersLocal, setUsersLocal] = useState(null)
  const [usersError, setUsersError] = useState('')
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [chartWidth, setChartWidth] = useState(0)
  const COLW = useMemo(() => ({ name: 220, role: 120, joined: 110, status: 100, actions: 80 }), [])
  const widthScale = useMemo(() => Math.max(0.8, Math.min(1.6, fontScale)), [fontScale])
  const tableBaseWidth = useMemo(() => COLW.name + COLW.role + COLW.joined + COLW.status + COLW.actions, [COLW])
  const tableWidth = useMemo(() => Math.round(tableBaseWidth * widthScale), [tableBaseWidth, widthScale])
  const zoomIn = useCallback(() => setFontScale(f => Math.min(1.5, +(f + 0.1).toFixed(2))), [])
  const zoomOut = useCallback(() => setFontScale(f => Math.max(0.6, +(f - 0.1).toFixed(2))), [])
  // Prefetch analytics user data only if not already cached; ensures instant chart display.
  useEffect(() => {
    let alive = true
    if (!cachedAnalyticsUsers) {
      ;(async () => {
        try {
          const res = await getJSON(`/api/analytics/users?range=all`)
          if (!alive) return
          cachedAnalyticsUsers = res
          setData(res)
        } catch (_e) {
          // leave cache null; chart will use fallback values
        }
      })()
    } else {
      // Optionally background refresh after short delay (non-blocking)
      ;(async () => {
        try {
          const res = await getJSON(`/api/analytics/users?range=all`)
          if (!alive) return
          cachedAnalyticsUsers = res
          setData(res)
        } catch {}
      })()
    }

    const normalizeStatus = (s) => {
      if (!s && s !== 0) return ''
      const v = String(s).toLowerCase()
      if (v === 'active') return 'Active'
      if (v === 'suspended') return 'Suspended'
      if (v === 'inactive') return 'Inactive'
      return String(s)
    }

    const formatDate = (iso) => {
      try {
        const d = new Date(iso)
        if (isNaN(d)) return ''
        const m = d.getMonth() + 1
        const day = d.getDate()
        const y = d.getFullYear()
        return `${m}/${day}/${y}`
      } catch { return '' }
    }

    const titleCase = (s) => (s ? (String(s).charAt(0).toUpperCase() + String(s).slice(1)) : '')

    const mapServerUser = (u) => ({
      id: u.id,
      name: u.full_name || u.fullName || u.username || u.email || `User ${u.id}`,
      email: u.email || '',
      role: u.role ? titleCase(u.role) : '',
      joined: formatDate(u.created_at || u.createdAt),
      status: normalizeStatus(u.status || 'active'),
    })

    const applyNormalize = (arr) => (arr || []).map(u => mapServerUser(u))

    const fetchAdminUsers = async () => {
      try {
        const res = await getJSON(`/api/admin/users?page=1&limit=100`)
        if (!alive) return null
        if (Array.isArray(res?.items) && res.items.length) return applyNormalize(res.items)
        return []
      } catch (e) {
        console.error('[ManageUsers] Failed to fetch admin users:', e?.message || e, { status: e?.status, url: e?.url })
        if (alive) {
          const code = e?.status ? ` (${e.status})` : ''
          const hint = e?.status === 401
            ? ' Unauthorized – admin access required.'
            : (e?.status === 404 ? ' Not found – check API path /api/admin/users.' : '')
          setUsersError(`Failed to load users${code}.${hint}`)
        }
        return []
      }
    }

    ;(async () => {
      // Always attempt to load admin users (preload for instant view when opening section)
      const adminList = await fetchAdminUsers()
      if (!alive) return
      if (adminList && adminList.length) setUsersLocal(adminList)
      else if (Array.isArray(data?.users) && data.users.length) setUsersLocal(applyNormalize(data.users))
      else setUsersLocal([])
    })()

    return () => { alive = false }
  }, [showManage, data])

  const refreshAdminUsers = useCallback(async () => {
    try {
      const res = await getJSON(`/api/admin/users?page=1&limit=100`)
      if (Array.isArray(res?.items)) setUsersLocal((res.items || []).map(u => ({
        id: u.id,
        name: u.full_name || u.fullName || u.username || u.email || `User ${u.id}`,
        email: u.email || '',
        role: u.role ? (String(u.role).charAt(0).toUpperCase() + String(u.role).slice(1)) : '',
        joined: (()=>{ try { const d=new Date(u.created_at||u.createdAt); if(isNaN(d)) return ''; return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}` } catch { return '' }})(),
        status: (u.status ? String(u.status).toLowerCase() : '') === 'active' ? 'Active' : (String(u.status).toLowerCase() === 'suspended' ? 'Suspended' : (String(u.status).toLowerCase() === 'inactive' ? 'Inactive' : (u.status||'')))
      })))
    } catch (e) {
      console.error('[ManageUsers] Refresh failed:', e?.message || e, { status: e?.status, url: e?.url })
      const code = e?.status ? ` (${e.status})` : ''
      const hint = e?.status === 401
        ? ' Unauthorized – admin access required.'
        : (e?.status === 404 ? ' Not found – check API path /api/admin/users.' : '')
      setUsersError(`Failed to refresh users${code}.${hint}`)
    }
  }, [])

  const toggleUserStatus = useCallback((id, currentStatus) => {
    const action = String(currentStatus || '').toLowerCase() === 'active' ? 'suspend' : 'unsuspend'
    const confirmText = action === 'suspend' ? 'Suspend this user? They will be blocked from placing orders and posting reviews.' : 'Unsuspend this user? They will regain access.'
    Alert.alert(action === 'suspend' ? 'Confirm suspend' : 'Confirm unsuspend', confirmText, [
      { text: 'Cancel', style: 'cancel' },
      { text: action === 'suspend' ? 'Suspend' : 'Unsuspend', style: 'destructive', onPress: async () => {
        try {
          await postJSON(`/api/admin/users/${id}/${action}`, {})
          // optimistic update (normalize to capitalized)
          setUsersLocal(prev => (prev || []).map(u => u.id === id ? { ...u, status: action === 'suspend' ? 'Suspended' : 'Active' } : u))
          // refresh to be safe
          await refreshAdminUsers()
        } catch (e) {
          Alert.alert('Action failed', e?.message || 'Failed to update user status')
        }
      } }
    ])
  }, [refreshAdminUsers])

  const deleteUser = useCallback((id) => {
    Alert.alert('Confirm delete', 'This will mark the user as inactive (ban). This action can be reversed by an admin.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await postJSON(`/api/admin/users/${id}/ban`, {})
          setUsersLocal(prev => (prev || []).map(u => u.id === id ? { ...u, status: 'Inactive' } : u))
          await refreshAdminUsers()
        } catch (e) {
          Alert.alert('Failed', e?.message || 'Failed to delete/ban user')
        }
      } }
    ])
  }, [refreshAdminUsers])

  const toggleMenu = (id) => {
    setActiveMenuId(prev => (prev === id ? null : id))
  }

  const distro = [Number(data?.totals?.farmers ?? 0), Number(data?.totals?.buyers ?? 0)]

  // Prepare growth data for display
  const expandedChartData = useMemo(() => {
    const growthRaw = Array.isArray(data?.growth) ? data.growth : []
    const buckets = { 8:0, 9:0, 10:0, 11:0 }
    if (growthRaw.length) {
      for (const g of growthRaw) {
        try {
          const d = new Date(g.date)
          if (isNaN(d)) continue
          const m = d.getMonth()
          if (m >= 8 && m <= 11) buckets[m] += Number(g.count || 0)
        } catch { continue }
      }
    }
    return TARGET_MONTHS.map(m => ({ 
      value: Math.round(buckets[m] || 0), 
      label: MONTH_NAMES[m] 
    }))
  }, [data])

  const header = (
    <View style={{ paddingTop:16, paddingBottom:8, paddingHorizontal:0 }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <View>
          <Text style={{ fontSize:22, fontWeight:'800', color:'#111827', marginBottom:4 }}>Users</Text>
        </View>
      </View>
    </View>
  )

  const sections = [
    {
      title: 'New Users Growth',
      render: () => (
        <View style={{ paddingHorizontal:0, paddingBottom:6 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:8, padding:12, elevation:1, marginHorizontal:0 }} onLayout={(e)=> setChartWidth(e?.nativeEvent?.layout?.width || 0)}>
            <Text style={{ fontSize:14, fontWeight:'700', marginBottom:12, color:'#111827' }}>User Signups (Sep - Dec)</Text>
            {chartWidth <= 0 ? (
              <Text style={{ color:'#6b7280' }}>Loading chart…</Text>
            ) : expandedChartData && expandedChartData.length > 0 ? (
              <View style={{ alignItems:'center' }}>
                <VictoryChart
                  width={Math.max(0, chartWidth - 24)}
                  height={200}
                  padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
                  theme={VictoryTheme.material}
                >
                  <VictoryAxis
                    tickValues={expandedChartData.map((_, i) => i + 1)}
                    tickFormat={(t) => expandedChartData[t - 1]?.label || ''}
                    style={{
                      tickLabels: { fontSize: 11, fill: '#6b7280' },
                      grid: { stroke: 'transparent' }
                    }}
                  />
                  <VictoryAxis
                    dependentAxis
                    tickFormat={(v) => Math.round(v)}
                    style={{
                      grid: { stroke: '#f3f4f6' },
                      tickLabels: { fontSize: 11, fill: '#6b7280' }
                    }}
                  />
                  <VictoryArea
                    data={expandedChartData.map((d, i) => ({ x: i + 1, y: d.value }))}
                    style={{
                      data: {
                        fill: '#4f46e5',
                        fillOpacity: 0.2,
                        stroke: '#4f46e5',
                        strokeWidth: 2
                      }
                    }}
                    interpolation="monotoneX"
                  />
                  <VictoryLine
                    data={expandedChartData.map((d, i) => ({ x: i + 1, y: d.value }))}
                    style={{
                      data: { stroke: '#4f46e5', strokeWidth: 2 }
                    }}
                    interpolation="monotoneX"
                  />
                </VictoryChart>
              </View>
            ) : (
              <Text style={{ color:'#6b7280' }}>No growth data available</Text>
            )}
          </View>
        </View>
      )
    },
    {
      title: 'User Roles',
      render: () => (
        <View style={{ paddingHorizontal:0, paddingVertical:6 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:8, padding:16, marginHorizontal:0 }}>
            { (distro[0] + distro[1]) > 0 ? (
              <>
                <View style={{ alignItems:'center' }}>
                  <VictoryPie
                    data={[
                      { x: 'Farmers', y: distro[0] },
                      { x: 'Buyers', y: distro[1] }
                    ]}
                    width={200}
                    height={200}
                    innerRadius={60}
                    colorScale={['#4f46e5', '#93c5fd']}
                    labels={() => null}
                  />
                </View>
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <View style={{ flexDirection:'row', alignItems:'center' }}>
                      <View style={{ width:12, height:12, borderRadius:6, backgroundColor:'#4f46e5', marginRight:8 }} />
                      <Text style={{ color:'#374151', fontWeight:'600' }}>Farmers</Text>
                    </View>
                    <Text style={{ color:'#111827', fontWeight:'700', fontSize:16 }}>{distro[0]}</Text>
                  </View>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <View style={{ flexDirection:'row', alignItems:'center' }}>
                      <View style={{ width:12, height:12, borderRadius:6, backgroundColor:'#93c5fd', marginRight:8 }} />
                      <Text style={{ color:'#374151', fontWeight:'600' }}>Buyers</Text>
                    </View>
                    <Text style={{ color:'#111827', fontWeight:'700', fontSize:16 }}>{distro[1]}</Text>
                  </View>
                  <View style={{ marginTop:8, paddingTop:12, borderTopWidth:1, borderTopColor:'#f3f4f6', flexDirection:'row', justifyContent:'space-between' }}>
                    <Text style={{ color:'#6b7280', fontWeight:'600' }}>Total Users</Text>
                    <Text style={{ color:'#4f46e5', fontWeight:'800', fontSize:18 }}>{distro[0] + distro[1]}</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ padding:24, alignItems:'center' }}>
                <Text style={{ color:'#6b7280' }}>No role distribution data available.</Text>
              </View>
            )}
          </View>
        </View>
      )
    },
    {
      title: 'Manage Users',
      render: () => (
        <View style={{ paddingHorizontal:0, paddingBottom:16 }}>
          <TouchableOpacity
            onPress={() => setShowManage(v => !v)}
            style={{
              backgroundColor: showManage ? '#0b1220' : '#111827',
              borderRadius:20,
              paddingVertical:6,
              paddingHorizontal:10,
              borderWidth:0,
              alignSelf:'flex-start',
              minWidth:96,
              alignItems:'center',
              justifyContent:'center'
            }}
          >
            <Text style={{ color: '#fff', fontWeight:'700', fontSize:18 }}>{showManage ? 'Hide' : 'Manage Users'}</Text>
          </TouchableOpacity>

        {showManage && (
          <View>
            <View style={{ backgroundColor:'#fff', borderRadius:8, padding:12 }}>
              <View>

              {usersError ? (
                <View style={{ backgroundColor:'#FEF2F2', borderColor:'#FECACA', borderWidth:1, padding:8, borderRadius:6, marginTop:8 }}>
                  <Text style={{ color:'#991B1B' }}>{usersError}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:12 }}>
                <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                  {['all','active','suspended'].map(key => (
                    <TouchableOpacity key={key} onPress={() => setFilter(key)} style={{ backgroundColor: filter===key ? '#f3f4f6' : '#fff', paddingVertical:6, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:'#e5e7eb', marginLeft:8 }}>
                      <Text style={{ color:'#111827', fontWeight: filter===key ? '700' : '600', textTransform: 'capitalize' }}>{key === 'all' ? 'All' : key === 'active' ? 'Active' : 'Suspended'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ marginTop:8, marginBottom:6, flexDirection:'row', alignItems:'center' }}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <TouchableOpacity onPress={zoomOut} style={{ padding:6, borderRadius:6, borderWidth:1, borderColor:'#e5e7eb', marginRight:8 }}>
                  <Text style={{ fontSize:16 }}>−</Text>
                </TouchableOpacity>
                <Text style={{ color:'#6b7280', minWidth:44, textAlign:'center' }}>{Math.round(fontScale * 100)}%</Text>
                <TouchableOpacity onPress={zoomIn} style={{ padding:6, borderRadius:6, borderWidth:1, borderColor:'#e5e7eb', marginLeft:8 }}>
                  <Text style={{ fontSize:16 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: tableWidth, width: '100%', backgroundColor: '#7cafe3ff', borderRadius:8, paddingVertical:6, paddingHorizontal:8 }}>
                <View style={{ flexDirection:'row', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#f3f4f6' }}>
                  <Text style={{ fontWeight:'700', width: Math.round(COLW.name * widthScale), fontSize: Math.round(12 * fontScale) }}>Name</Text>
                  <Text style={{ fontWeight:'700', width: Math.round(COLW.role * widthScale), textAlign:'center', fontSize: Math.round(12 * fontScale) }}>Role</Text>
                  <Text style={{ fontWeight:'700', width: Math.round(COLW.joined * widthScale), textAlign:'center', fontSize: Math.round(12 * fontScale) }}>Joined</Text>
                  <Text style={{ fontWeight:'700', width: Math.round(COLW.status * widthScale), textAlign:'center', fontSize: Math.round(12 * fontScale) }}>Status</Text>
                  <Text style={{ fontWeight:'700', width: Math.round(COLW.actions * widthScale), textAlign:'center', fontSize: Math.round(12 * fontScale) }}>Actions</Text>
                </View>

                {(usersLocal || []).filter(u => filter==='all' ? true : (filter==='active' ? u.status==='Active' : u.status==='Suspended')).map((item, i) => (
                  <View key={item.id || i} style={{ flexDirection:'row', alignItems:'center', paddingVertical:6, paddingHorizontal:6, borderBottomWidth:1, borderBottomColor:'#eef2f6' }}>
                    <View style={{ width: Math.round(COLW.name * widthScale), paddingRight:6 }}>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontWeight:'700', color:'#111827', fontSize: Math.round(12 * fontScale) }}>{item.name}</Text>
                        <Text style={{ color:'#6b7280', fontSize: Math.round(10 * fontScale) }}>{item.email}</Text>
                      </View>
                    </View>

                    <View style={{ width: Math.round(COLW.role * widthScale), alignItems:'center' }}>
                      <Text style={{ fontSize: Math.round(11 * fontScale) }}>{item.role}</Text>
                    </View>

                    <View style={{ width: Math.round(COLW.joined * widthScale), alignItems:'center' }}>
                      <Text style={{ fontSize: Math.round(11 * fontScale) }}>{item.joined}</Text>
                    </View>

                    <View style={{ width: Math.round(COLW.status * widthScale), alignItems:'center' }}>
                      <View style={{ backgroundColor: item.status==='Active' ? '#ecfdf5' : '#fee2e2', paddingHorizontal:6, paddingVertical:2, borderRadius:10 }}>
                        <Text style={{ color: item.status==='Active' ? '#16a34a' : '#dc2626', fontWeight:'700', fontSize: Math.round(10 * fontScale) }}>{item.status}</Text>
                      </View>
                    </View>

                    <View style={{ width: Math.round(COLW.actions * widthScale), alignItems:'center' }}>
                      {activeMenuId === item.id ? (
                        <View style={{ alignItems:'center' }}>
                          <TouchableOpacity onPress={() => { toggleUserStatus(item.id, item.status); setActiveMenuId(null); }} style={{ paddingVertical:4, paddingHorizontal:6 }}>
                            <Text style={{ fontSize: Math.round(11 * fontScale), color:'#111827', fontWeight:'700' }}>{item.status === 'Active' ? 'Suspend' : 'Activate'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { deleteUser(item.id); setActiveMenuId(null); }} style={{ paddingVertical:4, paddingHorizontal:6 }}>
                            <Text style={{ fontSize: Math.round(11 * fontScale), color:'#dc2626', fontWeight:'700' }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => toggleMenu(item.id)} style={{ padding:6 }}>
                          <Text style={{ fontSize:20 }}>⋯</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}
        </View>
      )
    },
  ]
  

  return (
    <StickySections
      sections={sections}
      contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 0 }}
      ListHeaderComponent={header}
      cardless
      itemContainerStyle={{ marginBottom:16 }}
    />
  )
}
