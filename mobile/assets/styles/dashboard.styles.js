import { StyleSheet } from 'react-native';

// Earnings Dashboard Page Styles
export const earningsStyles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f9fafb' },
  center: { flex:1, alignItems:'center', justifyContent:'center' },
  muted: { color:'#6b7280', marginTop:6 },
  error: { color:'#dc2626', fontWeight:'600', marginBottom:12 },
  retryBtn: { backgroundColor:'#111827', paddingHorizontal:16, paddingVertical:8, borderRadius:8 },
  retryText: { color:'#fff', fontWeight:'600' },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  title: { fontSize:18, fontWeight:'700', color:'#111827' },
  refreshBtn: { backgroundColor:'#fff', paddingHorizontal:12, paddingVertical:6, borderRadius:8 },
  refreshText: { fontSize:16, fontWeight:'700', color:'#374151' },
  metricsGrid: { flexDirection:'row', flexWrap:'wrap', gap:12, marginBottom:24 },
  metricCard: { width:'47%', backgroundColor:'#fff', padding:12, borderRadius:12, elevation:2 },
  metricLabel: { fontSize:11, fontWeight:'600', color:'#6b7280' },
  metricValue: { fontSize:14, fontWeight:'700', color:'#111827', marginTop:4 },
  sectionHeading: { fontSize:14, fontWeight:'700', color:'#374151', marginBottom:12 },
  chartRow: { flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between', padding:12, backgroundColor:'#fff', borderRadius:12, marginBottom:24 },
  barWrapper: { alignItems:'center', flex:1 },
  bar: { width:14, backgroundColor:'#16a34a', borderTopLeftRadius:4, borderTopRightRadius:4, alignSelf:'center' },
  barLabel: { fontSize:9, color:'#6b7280', marginTop:4 },
  listingRow: { flexDirection:'row', backgroundColor:'#fff', padding:12, borderRadius:12, marginBottom:10, alignItems:'center' },
  listingTitle: { fontSize:13, fontWeight:'600', color:'#111827' },
  listingSub: { fontSize:11, color:'#6b7280', marginTop:2 },
  lastOrder: { fontSize:10, color:'#9ca3af', marginTop:2 },
  qtyBlock: { width:48, alignItems:'center', justifyContent:'center', backgroundColor:'#f3f4f6', paddingVertical:8, borderRadius:10, marginLeft:12 },
  qtyValue: { fontSize:14, fontWeight:'700', color:'#111827' },
  qtyLabel: { fontSize:10, color:'#6b7280' }
});