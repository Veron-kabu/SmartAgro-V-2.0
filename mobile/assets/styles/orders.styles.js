import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

// Order Details Page Styles
export const orderDetailStyles = StyleSheet.create({
  container: { flex:1, backgroundColor: COLORS.background },
  center: { flex:1, justifyContent:'center', alignItems:'center', padding:16 },
  error: { color: COLORS.error },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  title: { fontSize:20, fontWeight:'700', color: COLORS.text },
  muted: { color: COLORS.textLight, fontSize:12 },
  badge: { borderRadius:999, paddingHorizontal:10, paddingVertical:4 },
  badgeText: { fontSize:10, fontWeight:'700' },
  section: { backgroundColor: COLORS.card, padding:12, borderRadius:10, marginTop:16 },
  sectionLabel: { fontSize:14, fontWeight:'700', color: COLORS.text, marginBottom:4 },
  value: { color: COLORS.text, fontSize:13, marginTop:2 },
  historyRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6, borderBottomWidth:1, borderColor: COLORS.border },
  historyStatus: { fontSize:12, fontWeight:'600', color: COLORS.text },
  historyTime: { fontSize:11, color: COLORS.textLight },
});

// New Order Page Styles
export const newOrderStyles = StyleSheet.create({
  center: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.card, borderRadius:16, padding:20, elevation:2 },
  title: { fontSize:22, fontWeight:'700', marginBottom:12, color: COLORS.text },
  label: { fontWeight:'600', fontSize:14, color: COLORS.text, marginBottom:4 },
  value: { fontSize:16, fontWeight:'500', color: COLORS.text, marginBottom:4 },
  input: { backgroundColor: COLORS.background, borderRadius:8, paddingHorizontal:12, paddingVertical:10, fontSize:14, color: COLORS.text },
  helper: { fontSize:12, color: COLORS.textLight, marginTop:4 },
  muted: { color: COLORS.textLight },
  mutedSmall: { color: COLORS.textLight, fontSize:12, marginBottom:4 },
  total: { fontSize:16, fontWeight:'700', color: COLORS.text },
  button: { backgroundColor: COLORS.primary, paddingHorizontal:18, paddingVertical:12, borderRadius:10 },
  buttonText: { color: COLORS.white, fontWeight:'700' }
});

// Farmer Orders Page Styles
export const farmerOrdersStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.card, margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  muted: { color: COLORS.textLight, fontSize: 12 },
  bold: { fontWeight: '700', color: COLORS.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePending: { borderWidth: 1, borderColor: COLORS.primary },
  badgeText: { fontSize: 10, fontWeight: '700' },
  syncingText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: COLORS.white, fontWeight: '700' },
  skelTitle: { height: 14, backgroundColor: COLORS.border, borderRadius: 6, width: '60%' },
  skelLine: { height: 10, backgroundColor: COLORS.border, borderRadius: 6, width: '40%', marginTop: 8 },
});

// Checkout Page Styles
export const checkoutStyles = StyleSheet.create({
  container: { flex:1, backgroundColor: COLORS.background, padding:24, paddingTop:48 },
  title: { fontSize:22, fontWeight:'700', color: COLORS.text },
  desc: { fontSize:14, color: COLORS.text, marginTop:8 },
  meta: { fontSize:12, color: COLORS.textLight, marginTop:8 },
  adjustTitle: { fontSize:14, fontWeight:'700', color: COLORS.text, marginBottom:6 },
  adjustLine: { fontSize:12, color: COLORS.text, marginTop:2 },
  primaryBtn: { backgroundColor: COLORS.primary, paddingVertical:14, borderRadius:12, alignItems:'center' },
  primaryText: { color: COLORS.white, fontWeight:'700', fontSize:15 },
  secondaryBtn: { backgroundColor: COLORS.text, paddingVertical:14, borderRadius:12, alignItems:'center' },
  secondaryText: { color: COLORS.white, fontWeight:'600', fontSize:13 },
  bannerWarning: { backgroundColor: COLORS.warning, borderRadius:12, padding:12, marginTop:12, borderWidth:1, borderColor: COLORS.warningBorder },
  bannerText: { fontSize:12, color: COLORS.warningText, fontWeight:'600' },
  bannerActions: { flexDirection:'row', marginTop:8, justifyContent:'flex-end' },
  bannerBtn: { paddingVertical:6, paddingHorizontal:12, borderRadius:8, backgroundColor: COLORS.card, borderWidth:1, borderColor: COLORS.border, marginLeft:8 },
  bannerBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bannerBtnText: { fontSize:12, fontWeight:'600', color: COLORS.text },
  adjustRow: { flexDirection:'row', alignItems:'flex-start', marginBottom:6 },
  adjustIcon: { width:20, textAlign:'center' },
  actionsBar: { marginTop:12 },
});

// Buyer Orders Page Styles
export const buyerOrdersStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.card, margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  muted: { color: COLORS.textLight, fontSize: 12 },
  bold: { fontWeight: '700', color: COLORS.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  skelTitle: { height: 14, backgroundColor: COLORS.border, borderRadius: 6, width: '60%' },
  skelLine: { height: 10, backgroundColor: COLORS.border, borderRadius: 6, width: '40%', marginTop: 8 },
});