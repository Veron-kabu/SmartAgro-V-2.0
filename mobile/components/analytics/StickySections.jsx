import { SectionList, View, Text } from 'react-native'

export default function StickySections({ sections = [], contentContainerStyle, ListHeaderComponent, headerComponent, itemContainerStyle, cardless = false }) {
  const mapped = sections.map((s, i) => ({ key: String(i), title: s.title, data: [{}], render: s.render }))
  return (
    <SectionList
      sections={mapped}
      keyExtractor={(item, index) => String(index)}
      renderItem={({ section }) => (
        <View style={[
          cardless ? { backgroundColor:'transparent', padding:0, borderRadius:0 } : { backgroundColor:'#fff', borderRadius:14, padding:12 },
          { marginBottom:12 },
          itemContainerStyle,
        ]}>
          {typeof section.render === 'function' ? section.render() : null}
        </View>
      )}
      renderSectionHeader={({ section }) => (
        <View style={{ backgroundColor:'#f3f4f6' }}>
          <Text style={{ fontSize:14, fontWeight:'700', color:'#111827', paddingHorizontal:16, paddingVertical:8 }}>{section.title}</Text>
        </View>
      )}
      stickySectionHeadersEnabled
      ListHeaderComponent={ListHeaderComponent || headerComponent || null}
      contentContainerStyle={[{ padding:16, paddingTop:0 }, contentContainerStyle]}
      style={{ flex:1, backgroundColor:'#f3f4f6' }}
    />
  )
}
