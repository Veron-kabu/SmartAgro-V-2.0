import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native'
import { getJSON, postJSON, deleteJSON } from '../../../context/api'
import { COLORS } from '../../../constants/colors'

export default function AdminUsers() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const fetchUsers = async (q) => {
    setLoading(true)
    try {
      const path = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : '/api/admin/users'
      const res = await getJSON(path)
      setItems(Array.isArray(res.items) ? res.items : res)
    } catch (e) {
      console.error('Failed to fetch users', e)
      Alert.alert('Error', 'Failed to load users')
    } finally { setLoading(false); setSearching(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const confirmAndCall = (title, message, fn) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: fn }
    ])
  }

  const suspend = async (id) => {
    try {
      await postJSON(`/api/admin/users/${id}/suspend`, {})
      fetchUsers(query)
    } catch (e) { console.error(e); Alert.alert('Error','Failed to suspend user') }
  }
  const unsuspend = async (id) => {
    try { await postJSON(`/api/admin/users/${id}/unsuspend`, {})
      fetchUsers(query)
    } catch (e) { console.error(e); Alert.alert('Error','Failed to reactivate user') }
  }
  const ban = async (id) => {
    try { await postJSON(`/api/admin/users/${id}/ban`, {})
      fetchUsers(query)
    } catch (e) { console.error(e); Alert.alert('Error','Failed to ban user') }
  }
  const remove = async (id) => {
    try { await deleteJSON(`/api/admin/users/${id}`)
      fetchUsers(query)
    } catch (e) { console.error(e); Alert.alert('Error','Failed to delete user') }
  }

  const renderItem = ({ item }) => (
    <View style={{ padding:12, backgroundColor: '#fff', borderRadius:12, marginBottom:8, flexDirection:'row', alignItems:'center', justifyContent:'space-between', shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6 }}>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:13, fontWeight:'700', color:COLORS.text }}>{item.username || '—'}</Text>
        <Text style={{ fontSize:12, color:COLORS.textLight }}>{item.email || '—'}</Text>
        <Text style={{ fontSize:11, color:COLORS.textLight }}>ID: {item.id} • Role: {item.role} • Status: {item.status}</Text>
      </View>
      <View style={{ marginLeft:12, alignItems:'flex-end' }}>
        {item.status !== 'suspended' ? (
          <TouchableOpacity onPress={() => confirmAndCall('Suspend user', 'Suspend this account?', () => suspend(item.id))} style={{ backgroundColor:'#fff', borderWidth:1, borderColor:COLORS.warning || '#f59e0b', paddingHorizontal:10, paddingVertical:6, borderRadius:8, marginBottom:6 }}>
            <Text style={{ color:COLORS.warning || '#f59e0b', fontWeight:'700' }}>Suspend</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => confirmAndCall('Reactivate user', 'Reactivate this account?', () => unsuspend(item.id))} style={{ backgroundColor:COLORS.primary, paddingHorizontal:10, paddingVertical:6, borderRadius:8, marginBottom:6 }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>Reactivate</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => confirmAndCall('Ban user', 'Mark user as inactive?', () => ban(item.id))} style={{ backgroundColor:'#fff', borderWidth:1, borderColor:COLORS.error, paddingHorizontal:10, paddingVertical:6, borderRadius:8, marginBottom:6 }}>
          <Text style={{ color:COLORS.error, fontWeight:'700' }}>Ban</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => confirmAndCall('Delete user', 'Permanently mark this user as deleted?', () => remove(item.id))} style={{ backgroundColor:'#fff', borderWidth:1, borderColor:COLORS.border, paddingHorizontal:10, paddingVertical:6, borderRadius:8 }}>
          <Text style={{ color:COLORS.textLight, fontWeight:'700' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={{ flex:1, padding:16, backgroundColor:'#f3f4f6' }}>
      <View style={{ flexDirection:'row', alignItems:'center', marginBottom:12 }}>
        <Text style={{ fontSize:20, fontWeight:'800', color:COLORS.text, flex:1 }}>Users</Text>
        <TouchableOpacity onPress={() => fetchUsers()} style={{ backgroundColor:COLORS.primary, paddingHorizontal:12, paddingVertical:8, borderRadius:10 }}>
          <Text style={{ color:'#fff', fontWeight:'700' }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
        <TextInput value={query} onChangeText={(t)=>setQuery(t)} placeholder="Search by username or email" style={{ flex:1, backgroundColor:'#fff', paddingHorizontal:12, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:COLORS.border }} />
        <TouchableOpacity onPress={() => { setSearching(true); fetchUsers(query) }} style={{ backgroundColor:COLORS.primary, paddingHorizontal:12, paddingVertical:8, borderRadius:10 }}>
          {searching ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'700' }}>Search</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList data={items} keyExtractor={i => String(i.id)} renderItem={renderItem} contentContainerStyle={{ paddingBottom:64 }} />
      )}
    </View>
  )
}
