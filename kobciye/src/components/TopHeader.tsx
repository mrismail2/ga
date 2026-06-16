import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Shadows } from '../constants/colors';
import { Avatar } from './Avatar';

interface TopHeaderProps { title: string; subtitle?: string; userName?: string; userRole?: string; onNotifications?: () => void; onProfile?: () => void; }

export const TopHeader: React.FC<TopHeaderProps> = ({ title, subtitle, userName = 'User', userRole = 'Admin', onNotifications, onProfile }) => {
  const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={styles.header}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.right}>
        <TouchableOpacity onPress={onNotifications} style={styles.iconBtn}>
          <Text style={styles.iconText}>🔔</Text>
          <View style={styles.notifDot} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onProfile} style={styles.profileWrap}>
          <Avatar initials={initials} size={36} color={Colors.navy} />
          <View>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileRole}>{userRole}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, ...Shadows.sm },
  titleWrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  notifDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red, borderWidth: 1.5, borderColor: Colors.surface },
  profileWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  profileRole: { fontSize: 11, color: Colors.muted },
});
