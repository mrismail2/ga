import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { radius } from '../theme/colors';
import ListScreen from '../components/ListScreen';
import RowCard from '../components/RowCard';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import AddIncidentModal from '../components/AddIncidentModal';
import { shadow } from '../theme/colors';
import { SEVERITY, INC_STATUS } from '../data/datasets';
import { useAppData } from '../context/AppDataContext';
import { filterIncidentsForProfile } from '../utils/dataSelectors';
import { canPerformAction } from '../utils/dataPermissions';

export default function IncidentsScreen({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { data: appData } = useAppData();
  const [sel, setSel] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  // role isolation: teacher → assigned classes, parent → own children only
  const [extra, setExtra] = useState([]);
  const incidents = filterIncidentsForProfile(profile, [...extra, ...appData.incidents]);
  const critical = incidents.filter((i) => i[3] === 'critical' || i[3] === 'high').length;
  const isParent = profile.scope === 'children';            // parent: visible summary only
  const canAdd = canPerformAction(profile, 'incidents.create');

  const addIncident = (inc) => setExtra((prev) => [inc, ...prev]);

  return (
    <>
      <ListScreen
        navigation={navigation}
        title="Kiisaska"
        subtitle="Hab-dhaqanka ardayda"
        stats={[
          { label: 'Kiisas Guud', value: String(incidents.length), tone: 'navy', icon: 'incidents' },
          { label: 'Halis/Sare', value: String(critical), tone: 'rose', icon: 'alert' },
        ]}
        data={incidents}
        renderItem={({ item }) => (
          <RowCard
            avatarName={item[0]}
            avatarCode={item[0]}
            title={item[0]}
            subtitle={`${item[1]} · ${item[2]}`}
            badge={{ label: SEVERITY[item[3]].label, tone: SEVERITY[item[3]].tone }}
            onPress={() => setSel(item)}
          />
        )}
      />

      {canAdd ? (
        <TouchableOpacity style={[styles.fab, { backgroundColor: c.blue }, shadow.card]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Icon name="plus" size={26} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}

      {canAdd ? <AddIncidentModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={addIncident} /> : null}

      <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSel(null)}>
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            {sel && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.badges}>
                  <Badge label={SEVERITY[sel[3]].label} tone={SEVERITY[sel[3]].tone} />
                  <Badge label={INC_STATUS[sel[7]].label} tone={INC_STATUS[sel[7]].tone} />
                </View>
                <Text style={[styles.name, { color: c.ink }]}>{sel[0]}</Text>
                <Text style={[styles.meta, { color: c.muted }]}>{sel[1]} · {sel[6]}</Text>
                <Text style={[styles.type, { color: c.navy }]}>{sel[2]}</Text>
                {isParent ? (
                  /* parent: ONLY the approved parent-visible summary — never the internal note */
                  <>
                    <Text style={[styles.descLbl, { color: c.muted }]}>KOOBKA WAALIDKA</Text>
                    <Text style={[styles.desc, { color: c.ink2 }]}>{sel[12] || 'Koob kooban oo la oggol yahay.'}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.descLbl, { color: c.muted }]}>FAAHFAAHIN — WAXA DHACAY (GUDAHA)</Text>
                    <Text style={[styles.desc, { color: c.ink2 }]}>{sel[4]}</Text>
                    <Text style={[styles.descLbl, { color: c.muted }]}>KOOBKA WAALIDKA</Text>
                    <Text style={[styles.desc, { color: c.ink2 }]}>{sel[12] || '—'}</Text>
                  </>
                )}
                <View style={[styles.foot, { borderTopColor: c.line }]}>
                  <Text style={[styles.footTxt, { color: c.muted }]}>Soo sheegay: {sel[5]}</Text>
                  <Text style={[styles.footTxt, { color: c.muted }]}>Waalid la ogeysiiyay: {sel[8]}</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  name: { fontSize: 19, fontWeight: '800' },
  meta: { fontSize: 13, marginTop: 4 },
  type: { fontSize: 15, fontWeight: '700', marginTop: 14 },
  descLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginTop: 14 },
  desc: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  foot: { borderTopWidth: 1, marginTop: 18, paddingTop: 14, gap: 6 },
  footTxt: { fontSize: 12.5, fontWeight: '600' },
});
