import React from 'react'
import { Image as ExpoImage } from 'expo-image'

// Wrapper: if blurhash provided use it as placeholder, else fallback to small constant
const FALLBACK_HASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}I'

export default function BlurhashImage({ uri, blurhash, style, contentFit='cover', cachePolicy='memory-disk', transition = 400, ...rest }) {
  return (
    <ExpoImage
      source={uri ? { uri } : null}
      style={style}
      placeholder={blurhash || FALLBACK_HASH}
      transition={transition}
      contentFit={contentFit}
      cachePolicy={cachePolicy}
      {...rest}
    />
  )
}
