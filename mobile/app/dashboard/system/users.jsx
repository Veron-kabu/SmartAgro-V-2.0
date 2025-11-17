import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { LineChart, PieChart } from 'react-native-gifted-charts'
import { getJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'

export default function Users() {
  const [data, setData] = useState(null)
  const [showManage, setShowManage] = useState(false)
  const [filter, setFilter] = useState('all')
  const [fontScale, setFontScale] = useState(0.85)
  const [usersLocal, setUsersLocal] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const COLW = useMemo(() => ({ name: 220, role: 120, joined: 110, status: 100, actions: 80 }), [])
  const widthScale = useMemo(() => Math.max(0.8, Math.min(1.6, fontScale)), [fontScale])
  const tableBaseWidth = useMemo(() => COLW.name + COLW.role + COLW.joined + COLW.status + COLW.actions, [COLW])
  const tableWidth = useMemo(() => Math.round(tableBaseWidth * widthScale), [tableBaseWidth, widthScale])
  const zoomIn = useCallback(() => setFontScale(f => Math.min(1.5, +(f + 0.1).toFixed(2))), [])
  const zoomOut = useCallback(() => setFontScale(f => Math.max(0.6, +(f - 0.1).toFixed(2))), [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getJSON(`/api/analytics/users`)
        if (alive) setData(res)
      } catch (_e) {}
    })()
    return () => { alive = false }
  }, [])

  // keep a local editable copy of users for UI actions (toggle suspend/activate)
  useEffect(() => {
    const sample = [
      { id: '1', name:'Alice Johnson', email:'alice@example.com', role:'Farmer', joined:'1/15/2023', status:'Active' },
      { id: '2', name:'Bob Williams', email:'bob@example.com', role:'Buyer', joined:'2/20/2023', status:'Active' },
      { id: '3', name:'Charlie Brown', email:'charlie@example.com', role:'Farmer', joined:'3/10/2023', status:'Suspended' },
      { id: '4', name:'Diana Miller', email:'diana@example.com', role:'Buyer', joined:'4/5/2023', status:'Active' },
    ]
    if (Array.isArray(data?.users) && data.users.length) setUsersLocal(data.users.map(u => ({ ...u })))
    else setUsersLocal(sample)
  }, [data])

  const toggleUserStatus = (id) => {
    setUsersLocal(prev => (prev || []).map(u => u.id === id ? { ...u, status: u.status === 'Active' ? 'Suspended' : 'Active' } : u))
  }

  const deleteUser = (id) => {
    setUsersLocal(prev => (prev || []).filter(u => u.id !== id))
  }

  const toggleMenu = (id) => {
    setActiveMenuId(prev => (prev === id ? null : id))
  }

  const distro = [Number(data?.totals?.farmers||0), Number(data?.totals?.buyers||0)]

  // Prepare growth series (new users per period). If missing, use a small sample to match the screenshot.
  const growthRaw = (data?.growth || [])
  const perPeriod = growthRaw.length ? growthRaw.map(g => Number(g.count || 0)) : [2,3,5,4,7,6]
  const dateLabels = growthRaw.length ? growthRaw.map(g => {
    try { const d = new Date(g.date); if (isNaN(d)) return String(g.date||''); return ['Jan','Feb','Mar','Apr','May','Jun'][d.getMonth()] || `${d.getMonth()+1}/${d.getDate()}` } catch { return String(g.date||'') }
  }) : ['Jan','Feb','Mar','Apr','May','Jun']
  const chartData = perPeriod.map((v, i) => ({ value: v, label: dateLabels[i] || '' }))

  const header = (
    <View style={{ paddingTop:16, paddingBottom:8, paddingHorizontal:0 }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <View>
          <Text style={{ fontSize:22, fontWeight:'800', color:'#111827', marginBottom:4 }}>Users</Text>
          <Text style={{ color:'#6b7280', marginTop:4 }}>User breakdown</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowManage(v => !v)}
          style={{ backgroundColor: showManage ? '#111827' : '#fff', borderRadius:20, paddingVertical:6, paddingHorizontal:12, borderWidth:1, borderColor:'#e5e7eb' }}
        >
          <Text style={{ color: showManage ? '#fff' : '#111827', fontWeight:'600' }}>{showManage ? 'Hide' : 'Manage Users'}</Text>
        </TouchableOpacity>
      </View>

      {showManage && (
        <View style={{ marginTop:12 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:8, padding:12 }}>
            <View style={{ marginBottom:8 }}>
              <View>
                <Text style={{ fontSize:18, fontWeight:'700', color:'#111827' }}>Manage Users</Text>
                <Text style={{ color:'#6b7280', marginTop:4 }}>View, filter, and manage all registered users.</Text>
              </View>

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
                      <View style={{ flexDirection:'row', alignItems:'center' }}>
                        <View style={{ width:28, height:28, borderRadius:14, backgroundColor:'#abc42fff', alignItems:'center', justifyContent:'center', marginRight:8 }}>
                          <Text style={{ color:'#6b7280', fontSize: Math.round(11 * fontScale) }}>{(item.name||'').split(' ').map(s=>s[0]).slice(0,2).join('')}</Text>
                        </View>
                        <View style={{ flex:1 }}>
                          <Text style={{ fontWeight:'700', color:'#111827', fontSize: Math.round(12 * fontScale) }}>{item.name}</Text>
                          <Text style={{ color:'#6b7280', fontSize: Math.round(10 * fontScale) }}>{item.email}</Text>
                        </View>
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
                          <TouchableOpacity onPress={() => { toggleUserStatus(item.id); setActiveMenuId(null); }} style={{ paddingVertical:4, paddingHorizontal:6 }}>
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

  const sections = [
    {
      title: 'New Users Growth',
      render: () => (
        <View style={{ paddingHorizontal:0, paddingBottom:6 }}>
          <Text style={{ fontSize:18, fontWeight:'700', color:'#111827', marginBottom:6, paddingHorizontal:12 }}>New Users Growth</Text>
          <Text style={{ color:'#6b7280', marginBottom:8, paddingHorizontal:12 }}>A wave-style line graph showing new user sign-ups per month.</Text>
          <View style={{ backgroundColor:'#fff', borderRadius:8, padding:12, elevation:1, marginHorizontal:0 }}>
            <LineChart
              data={chartData}
              height={180}
              curved
              areaChart
              areaColor={'#eef2ff'}
              areaOpacity={0.9}
              thickness={2}
              initialSpacing={16}
              hideDataPoints
              color={'#4f46e5'}
              isAnimated={false}
              yAxisLabelTexts={['0','3','6','10']}
              xAxisLabelTextStyle={{ color:'#6b7280', fontSize:12 }}
              yAxisTextStyle={{ color:'#6b7280', fontSize:12 }}
              rulesType={'dashed'}
              rulesColor={'#e6e6e6'}
              showVerticalLines={false}
            />
          </View>
        </View>
      )
    },
    {
      title: 'User Roles',
      render: () => (
        <View style={{ paddingHorizontal:0, paddingVertical:6 }}>
          <Text style={{ fontSize:18, fontWeight:'700', color:'#111827', marginBottom:8, paddingHorizontal:12 }}>User Roles</Text>
          <Text style={{ color:'#6b7280', marginBottom:12, paddingHorizontal:12 }}>Distribution of users by role.</Text>
          <View style={{ backgroundColor:'#fff', borderRadius:8, padding:16, alignItems:'center', marginHorizontal:0 }}>
            <PieChart
              data={[
                { value: Number(distro[0] || 0), color: '#4f46e5' },
                { value: Number(distro[1] || 0), color: '#93c5fd' },
              ]}
              donut
              innerRadius={36}
              radius={60}
              showText={false}
            />
            <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginTop:12 }}>
              <View style={{ flexDirection:'row', alignItems:'center', marginRight:16 }}>
                <View style={{ width:10, height:10, borderRadius:5, backgroundColor:'#4f46e5', marginRight:8 }} />
                <Text style={{ color:'#6b7280' }}>Farmers: {distro[0]}</Text>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <View style={{ width:10, height:10, borderRadius:5, backgroundColor:'#93c5fd', marginRight:8 }} />
                <Text style={{ color:'#6b7280' }}>Buyers: {distro[1]}</Text>
              </View>
            </View>
          </View>
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
