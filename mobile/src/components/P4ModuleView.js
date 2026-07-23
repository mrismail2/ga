/* ============================================================
   Kobciye — Phase 4 generic module CRUD view

   One reusable list+form view that manages a single Phase 4 module
   (config/phase4Modules.js): list records, add, edit, activate/deactivate,
   with loading / empty / error states, client-side validation and friendly
   duplicate-code messages. LIVE data only (services/phase4.js): everything
   runs under the signed-in admin's own JWT so RLS is the real gatekeeper.
   Embedded by SchoolManagementScreen (School Mode) and UniversityAppShell
   (University Mode) — the module catalogs keep the two wordings isolated.
   ============================================================ */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';
import { p4List, p4Create, p4Update, p4Validate, p4FriendlyError, p4AdmitStudentAtomic } from '../services/phase4';
import { onCanonicalChange } from '../services/canonicalStore';

export default function P4ModuleView({ module, titleOverride }) {
  const { c } = useTheme();
  const { isLive, profile } = useAuth();
  const schoolId = profile ? profile.school_id : null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);   // row being edited (null = new)
  const [values, setValues] = useState({});
  const [formErr, setFormErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fkOptions, setFkOptions] = useState({}); // { fieldKey: [{value,label}] }

  const title = titleOverride || module.title;
  const canUse = isLive && schoolId;

  const load = useCallback(async () => {
    if (!canUse) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try { setRows(await p4List(module.table, schoolId)); }
    catch (e) { setLoadErr(p4FriendlyError(e)); }
    finally { setLoading(false); }
  }, [canUse, schoolId, module.table]);

  useEffect(() => { load(); }, [load]);

  // two-way sync: a record persisted from ANY screen (e.g. a class created
  // from the Fasallada main-menu modal) re-reads the same canonical rows here
  useEffect(() => {
    if (!canUse) return undefined;
    return onCanonicalChange((table) => { if (table === module.table) load(); });
  }, [canUse, module.table, load]);

  const openForm = async (row) => {
    setEditing(row || null);
    setFormErr(null);
    const init = {};
    module.fields.forEach((f) => { init[f.key] = row && row[f.key] != null ? String(row[f.key]) : ''; });
    setValues(init);
    setFormOpen(true);
    // load FK dropdown options lazily
    const fks = module.fields.filter((f) => f.fk);
    const opts = {};
    await Promise.all(fks.map(async (f) => {
      try {
        const list = await p4List(f.fk.table, schoolId, { limit: 200 });
        opts[f.key] = list.map((r) => ({ value: r.id, label: r[f.fk.labelKey] || r.id }));
      } catch (e) { opts[f.key] = []; }
    }));
    setFkOptions(opts);
  };

  const save = async () => {
    if (saving) return;
    setFormErr(null);
    const err = p4Validate(module.fields, values);
    if (err) { setFormErr(err); return; }
    // `virtual` fields (guardian selection/relationship on Admissions) feed
    // the atomic RPC only — they are never columns of the module's table
    const payload = {};
    const extra = {};
    module.fields.forEach((f) => {
      let v = (values[f.key] || '').trim();
      if (f.upper) v = v.toUpperCase();
      const target = f.virtual ? extra : payload;
      target[f.key] = v === '' ? null : (f.number ? Number(v) : v);
    });
    setSaving(true);
    try {
      if (module.enrollAtomic && payload.status === 'enrolled') {
        // ONE transaction: student + enrollment + admission + parent +
        // guardian link — all created/updated together or not at all
        await p4AdmitStudentAtomic(schoolId, {
          applicantName: payload.applicant_name,
          classId: payload.desired_class_id,
          admissionId: editing ? editing.id : null,
          studentId: editing ? editing.student_id : null,
          parentId: extra.parent_id,
          guardianName: payload.guardian_name,
          guardianPhone: payload.guardian_phone,
          guardianEmail: extra.guardian_email,
          relationship: extra.relationship,
        });
      } else if (editing) {
        await p4Update(module.table, editing.id, payload);
      } else {
        await p4Create(module.table, { ...payload, school_id: schoolId });
      }
      setFormOpen(false);
      await load();
    } catch (e) { setFormErr(p4FriendlyError(e)); }
    finally { setSaving(false); }
  };

  const toggleActive = async (row) => {
    const a = module.active;
    if (!a) return;
    const patch = a.kind === 'boolean'
      ? { is_active: !row.is_active }
      : { status: row.status === 'active' ? 'archived' : 'active' };
    try { await p4Update(module.table, row.id, patch); await load(); }
    catch (e) { setLoadErr(p4FriendlyError(e)); }
  };

  const isRowActive = (row) => {
    const a = module.active;
    if (!a) return true;
    return a.kind === 'boolean' ? !!row.is_active : row.status === 'active';
  };

  /* ── not live: honest state, never demo data ── */
  if (!canUse) {
    return (
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Icon name={module.icon} size={26} color={c.muted2} />
        <Text style={[styles.boxTitle, { color: c.ink }]}>{title}</Text>
        <Text style={[styles.boxSub, { color: c.muted }]}>
          Maamulka xogtan wuxuu u baahan yahay akoon dhab ah (LIVE). Gal akoonkaaga dugsiga si aad u isticmaasho.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* header row: count + add */}
      <View style={styles.headRow}>
        <Text style={[styles.count, { color: c.muted }]}>{rows.length} diiwaan</Text>
        <TouchableOpacity onPress={() => openForm(null)} activeOpacity={0.85}
          style={[styles.addBtn, { backgroundColor: c.blue }]}>
          <Icon name="plus" size={15} color="#fff" strokeWidth={2.5} />
          <Text style={styles.addTxt}>Ku dar {module.single}</Text>
        </TouchableOpacity>
      </View>

      {loadErr ? (
        <View style={[styles.box, { backgroundColor: c.roseSoft, borderColor: c.roseSoft }]}>
          <Text style={[styles.boxSub, { color: c.rose }]}>{loadErr}</Text>
          <TouchableOpacity onPress={load}><Text style={{ color: c.blue, fontWeight: '700', marginTop: 8 }}>Isku day mar kale</Text></TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <ActivityIndicator color={c.blue} />
        </View>
      ) : rows.length === 0 ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name={module.icon} size={26} color={c.muted2} />
          <Text style={[styles.boxTitle, { color: c.ink }]}>Wax diiwaan ah ma jiraan</Text>
          <Text style={[styles.boxSub, { color: c.muted }]}>Ku dar {module.single.toLowerCase()}kaaga ugu horreeya.</Text>
          <TouchableOpacity onPress={() => openForm(null)} activeOpacity={0.85}
            style={[styles.addBtn, { backgroundColor: c.blue, marginTop: 14 }]}>
            <Icon name="plus" size={15} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addTxt}>Ku dar {module.single}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.listCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          {rows.map((r, i) => {
            const active = isRowActive(r);
            return (
              <View key={r.id} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1, opacity: active ? 1 : 0.55 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{module.listTitle(r)}</Text>
                  <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>{module.listSub(r)}</Text>
                </View>
                {module.active ? (
                  <TouchableOpacity onPress={() => toggleActive(r)} hitSlop={8}
                    style={[styles.pillBtn, { backgroundColor: active ? c.greenSoft : c.line }]}>
                    <Text style={[styles.pillTxt, { color: active ? c.green : c.muted }]}>{active ? 'Firfircoon' : 'Hakad'}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => openForm(r)} hitSlop={8} style={styles.editBtn}>
                  <Icon name="edit" size={15} color={c.blue} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* add / edit form */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setFormOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.ink }]}>
                {(editing ? 'Wax ka beddel ' : 'Ku dar ') + module.single}
              </Text>
              <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={10}>
                <Icon name="close" size={18} color={c.muted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 430 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {module.fields.map((f) => (
                <View key={f.key} style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { color: c.muted }]}>{f.label}{f.required ? ' *' : ''}</Text>
                  {f.options ? (
                    <View style={styles.optRow}>
                      {f.options.map((o) => {
                        const on = values[f.key] === o.value;
                        return (
                          <TouchableOpacity key={o.value} onPress={() => setValues((v) => ({ ...v, [f.key]: o.value }))}
                            style={[styles.optChip, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}>
                            <Text style={[styles.optTxt, { color: on ? c.blue : c.muted }]}>{o.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : f.fk ? (
                    <View style={styles.optRow}>
                      {(fkOptions[f.key] || []).length === 0 ? (
                        <Text style={[styles.rowSub, { color: c.muted2 }]}>Diiwaan lama helin — marka hore ku dar.</Text>
                      ) : (fkOptions[f.key] || []).map((o) => {
                        const on = values[f.key] === o.value;
                        return (
                          <TouchableOpacity key={o.value} onPress={() => setValues((v) => ({ ...v, [f.key]: on ? '' : o.value }))}
                            style={[styles.optChip, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}>
                            <Text style={[styles.optTxt, { color: on ? c.blue : c.muted }]} numberOfLines={1}>{o.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      value={values[f.key] || ''}
                      onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                      placeholder={f.placeholder || ''}
                      placeholderTextColor={c.muted2}
                      autoCapitalize={f.upper ? 'characters' : 'sentences'}
                      keyboardType={f.number ? 'numeric' : (f.phone ? 'phone-pad' : 'default')}
                      style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]}
                    />
                  )}
                </View>
              ))}
              {formErr ? <Text style={[styles.err, { color: c.rose }]}>{formErr}</Text> : null}
              <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.9}
                style={[styles.saveBtn, { backgroundColor: c.blue, opacity: saving ? 0.7 : 1 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.saveTxt}>{editing ? 'Kaydi Isbeddelka' : 'Kaydi'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  count: { fontSize: 12.5, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  addTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 6 },
  boxTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  listCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 1, fontWeight: '600' },
  pillBtn: { borderRadius: 9, paddingVertical: 5, paddingHorizontal: 10 },
  pillTxt: { fontSize: 11, fontWeight: '800' },
  editBtn: { padding: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 440, borderRadius: 20, padding: 20, ...(Platform.OS === 'web' ? { boxShadow: '0 18px 48px rgba(20,40,80,0.14)' } : { elevation: 6 }) },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 16.5, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  optChip: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, maxWidth: '100%' },
  optTxt: { fontSize: 12, fontWeight: '700' },
  err: { fontSize: 12.5, fontWeight: '700', marginBottom: 10, lineHeight: 18 },
  saveBtn: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
