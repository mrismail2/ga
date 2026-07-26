import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { avatarColors } from '../theme/colors';
import { usePhotos } from '../context/PhotoContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';

function initials(name) {
  return String(name || 'K')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* Deterministic color per person, OR their uploaded photo if one exists.
   When `editable`, tapping opens the image picker and shows a camera badge. */
export default function Avatar({ name, code, size = 44, editable = false }) {
  const { photos, pickPhoto } = usePhotos();
  const { role } = useRole();
  const { isLive } = useAuth();
  const key = String(code || name || 'Kobciye');
  // PhotoContext is the prototype's device-local store. A real account must
  // not display or edit those local images as if they were canonical data.
  const photo = isLive ? null : photos[key];
  const seed = key.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const bg = avatarColors[seed % avatarColors.length];

  // Only Super Admin / School Admin may upload/replace profile photos.
  const canEdit = !isLive && editable && (role === 'schooladmin' || role === 'superadmin');

  const inner = photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.txt, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );

  if (!canEdit) return inner;

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => pickPhoto(key)} style={{ width: size, height: size }}>
      {inner}
      <View style={[styles.badge, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 }]}>
        <Icon name="camera" size={size * 0.2} color="#fff" strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#fff', fontWeight: '700' },
  badge: {
    position: 'absolute', right: -2, bottom: -2, backgroundColor: '#2F6BF0',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
});
