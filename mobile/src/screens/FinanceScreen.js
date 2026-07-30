import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import { shadow } from '../theme/colors';
import { PAY_STATUS } from '../data/datasets';
import { useAppData } from '../context/AppDataContext';
import { filterPaymentsForProfile } from '../utils/dataSelectors';

const FEE = 25; // standard monthly fee per billable student (prototype)
const amt = (s) => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

/* Maaliyadda — role + school filtered, presented in the Kobciye web table
   style: summary chips, a "La Uruuriyay" progress bar, search and a
   "Lacagta Ardayda" table (# | MAGACA / ID | XAALAD). Read-only view; fee
   changes happen in Class Detail / Billing (admins & accountant). */
export default function FinanceScreen({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { data: appData } = useAppData();
  const [q, setQ] = useState('');

  const list = useMemo(() => filterPaymentsForProfile(profile, appData.payments), [profile, appData.payments]);
  const filtered = list.filter((p) => p[0].toLowerCase().includes(q.toLowerCase()));

  const sum = useMemo(() => {
    let paid = 0, partial = 0, due = 0, exempt = 0, collected = 0;
    list.forEach((p) => {
      const st = p[5]; const a = amt(p[2]);
      if (st === 'free') exempt++;
      else if (st === 'paid') { paid++; collected += a; }
      else if (st === 'partial') { partial++; collected += a; }
      else { due++; }
    });
    const billable = paid + partial + due;
    const expected = billable * FEE;
    const pct = expected ? Math.round((collected / expected) * 100) : 0;
    return { paid, partial, due, exempt, collected, expected, billable, pct, total: list.length };
  }, [list]);

  const own = profile.scope === 'children' || profile.scope === 'self';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader
          title="Maaliyadda"
          subtitle={own ? 'Lacagaha aad leedahay' : `Lacagaha ardayda · ${sum.paid}/${sum.billable} la bixiyay`}
          right={
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="back" size={20} color={c.ink} />
            </TouchableOpacity>
          }
        />

        <FlatList
          data={filtered}
          keyExtractor={(item, i) => (item[8] || item[6] || item[0]) + i}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* summary chips: Bixiyay / Qayb / Ma bixin / Wadar */}
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={styles.chips}>
                  <View style={[styles.chip, { backgroundColor: c.greenSoft }]}><Icon name="check" size={14} color={c.green} strokeWidth={2.6} /><Text style={[styles.chipTxt, { color: c.green }]}>{sum.paid}</Text></View>
                  <View style={[styles.chip, { backgroundColor: c.goldSoft }]}><Icon name="clock" size={14} color={c.gold700} strokeWidth={2.6} /><Text style={[styles.chipTxt, { color: c.gold700 }]}>{sum.partial}</Text></View>
                  <View style={[styles.chip, { backgroundColor: c.roseSoft }]}><Icon name="close" size={14} color={c.rose} strokeWidth={2.6} /><Text style={[styles.chipTxt, { color: c.rose }]}>{sum.due}</Text></View>
                  <View style={[styles.chip, { backgroundColor: c.blueSoft }]}><Icon name="students" size={14} color={c.navy} strokeWidth={2.4} /><Text style={[styles.chipTxt, { color: c.navy }]}>{sum.total}</Text></View>
                </View>
              </View>

              {/* La Uruuriyay progress */}
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={styles.progTop}>
                  <Text style={[styles.progTitle, { color: c.ink }]}>La Uruuriyay</Text>
                  <Text style={[styles.progPct, { color: c.green }]}>${sum.collected} · {sum.pct}%</Text>
                </View>
                <View style={[styles.progTrack, { backgroundColor: c.line }]}>
                  <View style={[styles.progFill, { width: `${sum.pct}%`, backgroundColor: c.green }]} />
                </View>
              </View>

              {/* search */}
              <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Icon name="search" size={16} color={c.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Raadi…" placeholderTextColor={c.muted2} style={[styles.searchInput, { color: c.ink }]} />
              </View>

              {/* table header */}
              <View style={[styles.tblTop, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={styles.tblTitleRow}>
                  <Text style={[styles.tblTitle, { color: c.ink }]}>Lacagta Ardayda</Text>
                  <Text style={[styles.tblMeta, { color: c.muted2 }]}>$25 / bishii</Text>
                </View>
                <View style={[styles.tblHead, { borderTopColor: c.line, borderBottomColor: c.line }]}>
                  <Text style={[styles.thHash, { color: c.muted2 }]}>#</Text>
                  <Text style={[styles.thName, { color: c.muted2 }]}>MAGACA / ID</Text>
                  <Text style={[styles.thStat, { color: c.muted2 }]}>XAALADDA</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: c.muted }]}>🪑 Lama helin</Text>}
          renderItem={({ item, index }) => {
            const st = PAY_STATUS[item[5]] || PAY_STATUS.paid;
            return (
              <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[styles.tdHash, { color: c.muted }]}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.tdName}>
                  <Text style={[styles.tdNameTxt, { color: c.ink }]} numberOfLines={1}>{item[0]}</Text>
                  <Text style={[styles.tdId, { color: c.muted }]} numberOfLines={1}>{item[1]} · {item[3]} · {item[4]}</Text>
                </View>
                <View style={styles.tdStat}>
                  <Text style={[styles.amount, { color: c.ink }]}>{item[2]}</Text>
                  <Badge label={st.label} tone={st.tone} />
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  chipTxt: { fontSize: 15, fontWeight: '800' },
  progTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  progTitle: { fontSize: 14.5, fontWeight: '800' },
  progPct: { fontSize: 14, fontWeight: '800' },
  progTrack: { height: 12, borderRadius: 6, overflow: 'hidden' },
  progFill: { height: 12, borderRadius: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14 },
  tblTop: { borderRadius: 16, borderWidth: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingTop: 14, paddingHorizontal: 14, marginBottom: -1 },
  tblTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tblTitle: { fontSize: 15, fontWeight: '800' },
  tblMeta: { fontSize: 12.5, fontWeight: '700' },
  tblHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderBottomWidth: 1 },
  thHash: { width: 28, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  thName: { flex: 1, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  thStat: { width: 110, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderTopWidth: 0, paddingVertical: 10, paddingHorizontal: 14 },
  tdHash: { width: 28, fontSize: 12.5, fontWeight: '700' },
  tdName: { flex: 1, minWidth: 0, paddingRight: 6 },
  tdNameTxt: { fontSize: 13.5, fontWeight: '700' },
  tdId: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  tdStat: { width: 110, alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 13.5, fontWeight: '800' },
  empty: { fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 24 },
});
