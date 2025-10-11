import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

const ChatBackground = () => {
  return (
    <View style={styles.container}>
      <View style={styles.pattern} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.chatDarkBg,
  },
  pattern: {
    flex: 1,
    backgroundColor: COLORS.chatPatternBg,
    opacity: 0.1,
  },
});

export default ChatBackground;