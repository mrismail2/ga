import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../constants/colors';

interface AvatarProps {
  initials?: string;
  imageUri?: string;
  size?: number;
  color?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ initials = '?', imageUri, size = 40, color = Colors.navy }) => {
  const style = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  if (imageUri) return <Image source={{ uri: imageUri }} style={[styles.base, style]} />;
  return (
    <View style={[styles.base, style]}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.5 },
});
