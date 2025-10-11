import { StyleSheet } from 'react-native';

// Product Detail Page Styles
export const productDetailStyles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f3f4f6' 
  },
  heroWrap: { 
    position: 'relative', 
    width: '100%', 
    height: 260, 
    backgroundColor: '#e5e7eb' 
  },
  heroImage: { 
    width: '100%', 
    height: '100%' 
  },
  dotsWrap: { 
    position: 'absolute', 
    bottom: 12, 
    left: 0, 
    right: 0, 
    flexDirection:'row', 
    justifyContent:'center', 
    gap:6 
  },
  dot: { 
    width:8, 
    height:8, 
    borderRadius:4, 
    backgroundColor:'rgba(255,255,255,0.4)' 
  },
  dotActive: { 
    backgroundColor:'#fff' 
  },
  topButtons: { 
    position: 'absolute', 
    top: 40, 
    left: 16, 
    right: 16, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  navBtn: { 
    backgroundColor: 'rgba(255,255,255,0.8)', 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  navBtnText: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827' 
  },
  circleBtn: { 
    backgroundColor: 'rgba(255,255,255,0.8)', 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  circleBtnText: { 
    fontSize: 16, 
    color: '#111827', 
    fontWeight: '600' 
  },
  discountBadge: { 
    position: 'absolute', 
    top: 40, 
    left: 16, 
    backgroundColor: '#ef4444', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 16 
  },
  discountBadgeText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  discountBadgeSecondary: { 
    position: 'absolute', 
    top: 40, 
    right: 16, 
    backgroundColor: '#1f2937', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 16 
  },
  discountBadgeSecondaryText: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '700', 
    letterSpacing: 0.5 
  },
  sheet: { 
    marginTop: -28, 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    minHeight: 340 
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: 6 
  },
  price: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#111827' 
  },
  origPrice: { 
    fontSize: 14, 
    color: '#6b7280', 
    textDecorationLine:'line-through', 
    fontWeight:'600', 
    marginBottom:2 
  },
  unit: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#6b7280' 
  },
  desc: { 
    fontSize: 13, 
    color: '#475569', 
    marginTop: 10, 
    lineHeight: 18 
  },
  metaRow: { 
    flexDirection: 'row', 
    marginTop: 8 
  },
  metaLabel: { 
    fontSize: 12, 
    color: '#6b7280', 
    width: 110 
  },
  metaValue: { 
    fontSize: 12, 
    color: '#111827', 
    fontWeight: '600' 
  },
  qtyRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 22, 
    gap: 16 
  },
  qtyLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#111827' 
  },
  qtyControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f1f5f9', 
    borderRadius: 24, 
    paddingHorizontal: 8, 
    paddingVertical: 6 
  },
  qtyBtn: { 
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 4 
  },
  qtyBtnText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827' 
  },
  qtyValue: { 
    minWidth: 28, 
    textAlign: 'center', 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#111827' 
  },
  extPrice: { 
    marginLeft: 'auto', 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#111827' 
  },
  addBtn: { 
    marginTop: 18, 
    backgroundColor: '#111827', 
    paddingVertical: 14, 
    borderRadius: 32, 
    alignItems: 'center' 
  },
  addBtnDisabled: { 
    backgroundColor: '#9ca3af' 
  },
  addBtnText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '700', 
    letterSpacing: 0.5 
  },
  circleBtnActive: { 
    backgroundColor: '#111827' 
  },
  circleBtnTextActive: { 
    color: '#fff' 
  },
  retryBtn: { 
    backgroundColor: '#111827', 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    borderRadius: 24 
  },
  retryBtnText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
  secondaryActionBtn: { 
    flex:1, 
    backgroundColor: '#f1f5f9', 
    paddingVertical: 14, 
    borderRadius: 28, 
    alignItems:'center' 
  },
  secondaryActionBtnText: { 
    color:'#111827', 
    fontWeight:'700', 
    fontSize:14 
  },
});

// Product Edit Page Styles
export const productEditStyles = StyleSheet.create({
  container:{ 
    flex:1, backgroundColor:'#f8fafc' 
  },
  headerRow:{ 
    flexDirection:'row', 
    alignItems:'center', 
    justifyContent:'space-between', 
    marginBottom:12 
  },
  back:{ 
    color:'#111827', 
    fontSize:14, 
    fontWeight:'600' 
  },
  title:{ 
    fontSize:16, 
    fontWeight:'700', 
    color:'#111827' 
  },
  label:{ 
    fontSize:12, 
    fontWeight:'600', 
    color:'#374151', 
    marginTop:16, 
    marginBottom:6 
  },
  input:{ 
    backgroundColor:'#fff', 
    borderWidth:1, 
    borderColor:'#e5e7eb', 
    borderRadius:20, 
    paddingHorizontal:16, 
    paddingVertical:10, 
    fontSize:13 
  },
  inputError:{ 
    borderColor:'#ef4444' 
  },
  fieldError:{ 
    color:'#ef4444', 
    fontSize:11, 
    marginTop:4 
  },
  switchRow:{ 
    flexDirection:'row', 
    alignItems:'center', 
    justifyContent:'space-between', 
    marginTop:20 
  },
  saveBtn:{ 
    marginTop:28, 
    backgroundColor:'#111827', 
    paddingVertical:14, 
    borderRadius:28, 
    alignItems:'center' 
  },
  saveText:{ 
    color:'#fff', 
    fontWeight:'700', 
    fontSize:14 
  },
  error:{ 
    color:'#dc2626', 
    textAlign:'center' 
  },
  retry:{ 
    marginTop:12, 
    alignSelf:'center', 
    backgroundColor:'#111827', 
    paddingHorizontal:16, 
    paddingVertical:10, 
    borderRadius:24 
  },
  retryText:{ 
    color:'#fff', 
    fontWeight:'600' 
  },
  imagesWrap:{ 
    flexDirection:'row', 
    flexWrap:'wrap', 
    marginTop:4 
  },
  imageItem:{ 
    width:76, 
    height:76, 
    marginRight:8, 
    marginBottom:8, 
    position:'relative' 
  },
  imageThumb:{ 
    width:'100%', 
    height:'100%', 
    borderRadius:16, 
    backgroundColor:'#e2e8f0' 
  },
  removeBtn:{ 
    position:'absolute', 
    top:-6, 
    right:-6, 
    backgroundColor:'#111827', 
    width:22, 
    height:22, 
    borderRadius:11, 
    alignItems:'center', 
    justifyContent:'center' 
  },
  removeBtnText:{ 
    color:'#fff', 
    fontSize:14, 
    fontWeight:'700', 
    lineHeight:16 
  },
  addImage:{ 
    width:76, 
    height:76, 
    borderRadius:16, 
    backgroundColor:'#f1f5f9', 
    borderWidth:1, 
    borderColor:'#e2e8f0', 
    alignItems:'center', 
    justifyContent:'center' 
  },
  addImageText:{ 
    fontSize:28, 
    color:'#64748b', 
    marginTop:-4 
  },
  imagesHint:{ 
    fontSize:11, 
    color:'#64748b', 
    marginTop:2, 
    marginLeft:4 
  },
  multilineInput:{ 
    minHeight:100, 
    paddingTop:12 
  },
  charCount:{ 
    fontSize:10, 
    color:'#94a3b8', 
    marginTop:4, 
    alignSelf:'flex-end', 
    marginRight:4 
  },
});