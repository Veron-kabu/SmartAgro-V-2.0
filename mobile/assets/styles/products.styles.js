import { StyleSheet } from 'react-native';
import { COLORS, OVERLAY } from '../../constants/colors';

// Product Detail Page Styles
export const productDetailStyles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  heroWrap: { 
    position: 'relative', 
    width: '100%', 
    height: 300, 
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  heroImage: { 
    width: '100%', 
    height: '100%',
    alignSelf: 'stretch',
    backgroundColor: 'transparent'
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
    backgroundColor: OVERLAY.dim 
  },
  dotActive: { 
    backgroundColor: COLORS.white 
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
    backgroundColor: 'transparent', 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  navBtnText: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  circleBtn: { 
    backgroundColor: OVERLAY.light, 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  circleBtnText: { 
    fontSize: 16, 
    color: COLORS.text, 
    fontWeight: '600' 
  },
  discountBadge: { 
    position: 'absolute', 
    top: 40, 
    left: 16, 
    backgroundColor: COLORS.error, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 16 
  },
  discountBadgeText: { 
    color: COLORS.white, 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  discountBadgeSecondary: { 
    position: 'absolute', 
    top: 40, 
    right: 16, 
    backgroundColor: COLORS.text, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 16 
  },
  discountBadgeSecondaryText: { 
    color: COLORS.white, 
    fontSize: 10, 
    fontWeight: '700', 
    letterSpacing: 0.5 
  },
  sheet: { 
    marginTop: 0, 
    backgroundColor: COLORS.background, 
    borderTopLeftRadius: 0, 
    borderTopRightRadius: 0, 
    paddingVertical: 24,
    paddingHorizontal: 16,
    minHeight: 340 
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: COLORS.text, 
    marginBottom: 6 
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8
  },
  price: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  origPrice: { 
    fontSize: 14, 
    color: COLORS.textLight, 
    textDecorationLine:'line-through', 
    fontWeight:'600', 
    marginBottom:2 
  },
  unit: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: COLORS.textLight,
    marginBottom: 10
  },
  desc: { 
    fontSize: 13, 
    color: COLORS.textLight, 
    marginTop: -5, 
    lineHeight: 18 
  },
  metaRow: { 
    flexDirection: 'row', 
    marginTop: 8,
    alignItems: 'flex-start'
  },
  metaLabel: { 
    fontSize: 12, 
    color: COLORS.textLight, 
    width: 70
  },
  metaValue: { 
    fontSize: 12, 
    color: COLORS.text, 
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap'
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
    color: COLORS.text 
  },
  qtyControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.background, 
    borderRadius: 24, 
    paddingHorizontal: 8, 
    paddingVertical: 6 
  },
  qtyBtn: { 
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    backgroundColor: COLORS.white, 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: COLORS.shadow, 
    shadowOpacity: 0.05, 
    shadowRadius: 4 
  },
  qtyBtnText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  qtyValue: { 
    minWidth: 28, 
    textAlign: 'center', 
    fontSize: 16, 
    fontWeight: '600', 
    color: COLORS.text 
  },
  extPrice: { 
    marginLeft: 'auto', 
    fontSize: 14, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  addBtn: { 
    backgroundColor: COLORS.primary, 
    paddingVertical: 14, 
    borderRadius: 28, 
    alignItems: 'center' 
  },
  addBtnDisabled: { 
    backgroundColor: COLORS.textLight 
  },
  addBtnText: { 
    color: COLORS.white, 
    fontSize: 14, 
    fontWeight: '700', 
    letterSpacing: 0.5 
  },
  circleBtnActive: { 
    backgroundColor: COLORS.primary 
  },
  circleBtnTextActive: { 
    color: COLORS.white 
  },
  retryBtn: { 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    borderRadius: 24 
  },
  retryBtnText: { 
    color: COLORS.white, 
    fontWeight: '600' 
  },
  secondaryActionBtn: { 
    flex:1, 
    backgroundColor: COLORS.background, 
    paddingVertical: 14, 
    borderRadius: 28, 
    alignItems:'center',
    borderWidth: 2,
    borderColor: COLORS.online
  },
  secondaryActionBtnText: { 
    color: COLORS.text, 
    fontWeight:'700', 
    fontSize:14 
  },
});

// Product Edit Page Styles
export const productEditStyles = StyleSheet.create({
  container:{ 
    flex:1, backgroundColor: COLORS.background 
  },
  headerRow:{ 
    flexDirection:'row', 
    alignItems:'center', 
    justifyContent:'space-between', 
    marginBottom:2 
  },
  back:{ 
    color: COLORS.text, 
    fontSize:14, 
    fontWeight:'600' 
  },
  title:{ 
    fontSize:16, 
    fontWeight:'700', 
    color: COLORS.text 
  },
  label:{ 
    fontSize:12, 
    fontWeight:'600', 
    color: COLORS.textLight, 
    marginTop:16, 
    marginBottom:6 
  },
  input:{ 
    backgroundColor: COLORS.white, 
    borderWidth:1, 
    borderColor: COLORS.inputBorder, 
    borderRadius:20, 
    paddingHorizontal:16, 
    paddingVertical:10, 
    fontSize:13 
  },
  inputError:{ 
    borderColor: COLORS.error 
  },
  fieldError:{ 
    color: COLORS.error, 
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
    backgroundColor: COLORS.primary, 
    paddingVertical:14, 
    paddingHorizontal:32,
    minWidth:160,
    borderRadius:28, 
    alignItems:'center',
    alignSelf:'center'
  },
  saveText:{ 
    color: COLORS.white, 
    fontWeight:'700', 
    fontSize:14 
  },
  error:{ 
    color: COLORS.error, 
    textAlign:'center' 
  },
  retry:{ 
    marginTop:12, 
    alignSelf:'center', 
    backgroundColor: COLORS.primary, 
    paddingHorizontal:16, 
    paddingVertical:10, 
    borderRadius:24 
  },
  retryText:{ 
    color: COLORS.white, 
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
    backgroundColor: COLORS.divider 
  },
  removeBtn:{ 
    position:'absolute', 
    top:-6, 
    right:-6, 
    backgroundColor: COLORS.text, 
    width:22, 
    height:22, 
    borderRadius:11, 
    alignItems:'center', 
    justifyContent:'center' 
  },
  removeBtnText:{ 
    color: COLORS.white, 
    fontSize:14, 
    fontWeight:'700', 
    lineHeight:16 
  },
  addImage:{ 
    width:76, 
    height:76, 
    borderRadius:16, 
    backgroundColor: COLORS.background, 
    borderWidth:1, 
    borderColor: COLORS.border, 
    alignItems:'center', 
    justifyContent:'center' 
  },
  addImageText:{ 
    fontSize:28, 
    color: COLORS.textLight, 
    marginTop:-4 
  },
  imagesHint:{ 
    fontSize:11, 
    color: COLORS.textLight, 
    marginTop:2, 
    marginLeft:4 
  },
  multilineInput:{ 
    minHeight:100, 
    paddingTop:12 
  },
  charCount:{ 
    fontSize:10, 
    color: COLORS.textLight, 
    marginTop:4, 
    alignSelf:'flex-end', 
    marginRight:4 
  },
});

// Shared image container styles (use for product hero and featured cards)
export const featuredImageStyles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%',
    alignSelf: 'stretch'
    // Use Image/BlurhashImage with contentFit='contain' to show full image
  }
})