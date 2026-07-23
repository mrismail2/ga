import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import Icon from './Icon';
import { NOTIFICATIONS } from '../data/mock';

/* A bell button with an unread dot that opens a notifications panel —
   mirrors the web app's topbar bell. */
export default function NotificationBell() {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.bell, { backgroundColor: c.surface, borderColor: c.line2 }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Icon name="bell" size={19} color={c.ink2} />
        <View style={[styles.dot, { backgroundColor: c.rose, borderColor: c.bg }]} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.panel, { backgroundColor: c.surface }]}>
            <View style={[styles.head, { borderBottomColor: c.line }]}>
              <Text style={[styles.title, { color: c.ink }]}>Ogeysiisyada</Text>
              <View style={[styles.count, { backgroundColor: c.rose }]}>
                <Text style={styles.countTxt}>{NOTIFICATIONS.length}</Text>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {NOTIFICATIONS.map((n, i) => (
                <View key={i} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
                  <View style={[styles.iconDot, { backgroundColor: n.color + '22' }]}>
                    <View style={[styles.innerDot, { backgroundColor: n.color }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nTitle, { color: c.ink }]} numberOfLines={1}>{n.title}</Text>
                    <Text style={[styles.nText, { color: c.muted }]} numberOfLines={1}>{n.text}</Text>
                  </View>
                  <Text style={[styles.nTime, { color: c.muted2 }]}>{n.time}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.4)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 90, paddingHorizontal: 16 },
  panel: { width: 320, maxWidth: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  innerDot: { width: 12, height: 12, borderRadius: 6 },
  nTitle: { fontSize: 13.5, fontWeight: '700' },
  nText: { fontSize: 12, marginTop: 2 },
  nTime: { fontSize: 10.5, fontWeight: '600' },
});
