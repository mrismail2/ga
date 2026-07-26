/* ============================================================
   Kobciye — Phase 5 generic module view

   One reusable list + create form for the config-driven Phase 5 CRUD modules
   (timetable, assignments, exams, exam schedules, fee structures, discipline).
   LIVE data only (services/phase5.js) under the caller's own JWT so RLS is the
   authority. Shows loading / empty / error / retry / success, disables Save
   while submitting and blocks duplicate clicks — the same contract every
   Phase 5 screen must meet (§15).
   ============================================================ */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import Icon from './Icon';
import { p5FriendlyError } from '../services/phase5';
const { canCreateModule, visibleRowActions } = require('../domain/phase5Access');

/* Role-aware CRUD. A module declares who may create (`createRoles`, default
   admins) and each row action declares its own `roles`. A role that may not
   create sees NO "Ku dar" button and NO admin actions — the buttons are hidden
   BEFORE render (not merely rejected by RLS), so Student/Parent/Teacher never
   see controls they cannot use (§5). The decision lives in the pure,
   unit-tested domain/phase5Access; RLS remains the real authority underneath. */
export default function Phase5ModuleView({ module }) {
  const { c } = useTheme();
  const { roleKey } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const canCreate = !!module.create && canCreateModule(roleKey, module.createRoles);
  const visibleActions = visibleRowActions(roleKey, module.rowActions);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState({});
  const [fkOptions, setFkOptions] = useState({});
  const [formErr, setFormErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try { setRows(await module.list(schoolId)); }
    catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [schoolId, module]);
  useEffect(() => { load(); }, [load]);

  const openForm = async () => {
    setFormErr(null); setSuccess('');
    const init = {};
    module.fields.forEach((f) => { init[f.key] = f.default != null ? String(f.default) : ''; });
    setValues(init);
    setFormOpen(true);
    const fks = module.fields.filter((f) => f.fk);
    const opts = {};
    await Promise.all(fks.map(async (f) => {
      try {
        const list = await f.fk.list(schoolId);
        opts[f.key] = list.map((r) => ({ value: r.id, label: r[f.fk.labelKey] || r.id }));
      } catch (e) { opts[f.key] = []; }
    }));
    setFkOptions(opts);
  };

  const save = async () => {
    if (saving) return;
    setFormErr(null);
    for (const f of module.fields) {
      const v = (values[f.key] || '').trim();
      if (f.required && !v) { setFormErr(`${f.label} waa qasab.`); return; }
      if (f.number && v && isNaN(Number(v))) { setFormErr(`${f.label} waa inuu lambar noqdaa.`); return; }
      if (f.date && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { setFormErr(`${f.label}: qaabka waa YYYY-MM-DD.`); return; }
      if (f.time && v && !/^\d{2}:\d{2}$/.test(v)) { setFormErr(`${f.label}: qaabka waa HH:MM.`); return; }
    }
    const row = { school_id: schoolId };
    module.fields.forEach((f) => {
      let v = (values[f.key] || '').trim();
      if (v === '') { row[f.key] = f.required ? v : null; return; }
      row[f.key] = f.number ? Number(v) : v;
    });
    setSaving(true);
    try {
      await module.create(row);
      setFormOpen(false);
      setSuccess('Waa la kaydiyay.');
      await load();
    } catch (e) { setFormErr(p5FriendlyError(e)); }
    finally { setSaving(false); }
  };

  if (!schoolId) return null;

  return (
    <View>
      <View style={styles.headRow}>
        <Text style={[styles.count, { color: c.muted }]}>{rows.length} diiwaan</Text>
        {canCreate ? (
          <TouchableOpacity onPress={openForm} activeOpacity={0.85} style={[styles.addBtn, { backgroundColor: c.blue }]}>
            <Icon name="plus" size={15} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addTxt}>Ku dar {module.single}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {success ? <View style={[styles.success, { backgroundColor: c.greenSoft }]}><Text style={[styles.successTxt, { color: c.green }]}>{success}</Text></View> : null}

      {loadErr ? (
        <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
          <Text style={[styles.boxSub, { color: c.rose }]}>{loadErr}</Text>
          <TouchableOpacity onPress={load}><Text style={{ color: c.blue, fontWeight: '700', marginTop: 8 }}>Isku day mar kale</Text></TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}><ActivityIndicator color={c.blue} /></View>
      ) : rows.length === 0 ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name={module.icon} size={26} color={c.muted2} />
          <Text style={[styles.boxSub, { color: c.muted }]}>{module.emptyText || 'Weli xog lama diiwaangelin.'}</Text>
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
          {rows.map((r, i) => (
            <View key={r.id} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{module.listTitle(r)}</Text>
                <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>{module.listSub(r)}</Text>
              </View>
              {visibleActions.map((a) => (
                <TouchableOpacity key={a.label} onPress={() => a.run(r, { schoolId, reload: load, setSuccess, setLoadErr })}
                  style={[styles.actBtn, { borderColor: c.line }]}>
                  <Text style={[styles.actTxt, { color: c.blue }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      )}

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setFormOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.ink }]}>Ku dar {module.single}</Text>
              <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={10}><Icon name="close" size={18} color={c.muted} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {module.fields.map((f) => (
                <View key={f.key} style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { color: c.muted }]}>{f.label}{f.required ? ' *' : ''}</Text>
                  {f.options ? (
                    <View style={styles.optRow}>
                      {f.options.map((o) => {
                        const on = values[f.key] === o.value;
                        return (
                          <TouchableOpacity key={o.value} onPress={() => setValues((v) => ({ ...v, [f.key]: o.value }))}
                            style={[styles.opt, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}>
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
                            style={[styles.opt, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}>
                            <Text style={[styles.optTxt, { color: on ? c.blue : c.muted }]} numberOfLines={1}>{o.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput value={values[f.key] || ''} onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                      placeholder={f.placeholder || ''} placeholderTextColor={c.muted2}
                      keyboardType={f.number ? 'numeric' : 'default'}
                      style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  )}
                </View>
              ))}
              {formErr ? <Text style={[styles.err, { color: c.rose }]}>{formErr}</Text> : null}
              <TouchableOpacity onPress={saving ? undefined : save} disabled={saving} activeOpacity={0.9}
                style={[styles.saveBtn, { backgroundColor: c.blue, opacity: saving ? 0.7 : 1 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Kaydi</Text>}
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
  success: { padding: 11, borderRadius: 11, marginBottom: 12 },
  successTxt: { fontSize: 13, fontWeight: '700' },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 6 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 1, fontWeight: '600' },
  actBtn: { borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10 },
  actTxt: { fontSize: 11.5, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 440, borderRadius: 20, padding: 20, ...(Platform.OS === 'web' ? { boxShadow: '0 18px 48px rgba(20,40,80,0.14)' } : { elevation: 6 }) },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 16.5, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  opt: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, maxWidth: '100%' },
  optTxt: { fontSize: 12, fontWeight: '700' },
  err: { fontSize: 12.5, fontWeight: '700', marginBottom: 10, lineHeight: 18 },
  saveBtn: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
