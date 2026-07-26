/* Lacagaha (Live) — real Supabase fee management. Fee structures are created
   here; invoices are listed with real balances; a payment is recorded through
   record_payment (which rejects negative/overpayment/duplicate-reference and
   rolls the invoice balance forward atomically). No fake totals; "La bixiyay"
   only ever reflects a real recorded payment. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { ModuleScreenFrame, useAsyncData, SaveButton, ErrorNote, SuccessNote } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import { listFeeStructures, createFeeStructure, listInvoices, recordPayment, p5FriendlyError } from '../../services/phase5';
const { canRecordPayment: canRecordPaymentRole } = require('../../domain/phase5Access');

function InvoicesSection() {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId } = useActiveSchoolId();
  // only finance staff record payments; Student/Parent get a read-only view
  const canRecordPayment = canRecordPaymentRole(roleKey);
  const { data, loading, error, reload } = useAsyncData(() => listInvoices(schoolId), [schoolId], { enabled: isLive && !!schoolId });
  const [pay, setPay] = useState(null); // invoice being paid
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [success, setSuccess] = useState('');

  const rows = data || [];
  const submit = async () => {
    if (saving || !pay) return;
    setErr(null);
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setErr('Lacagta waa inay ka weyn tahay eber.'); return; }
    setSaving(true);
    try {
      await recordPayment(schoolId, { invoiceId: pay.id, amount: amt, method: 'cash', reference: ref.trim() || null });
      setPay(null); setAmount(''); setRef(''); setSuccess('Lacagta waa la diiwaangeliyay.');
      await reload();
    } catch (e) { setErr(p5FriendlyError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ marginTop: 22 }}>
      <Text style={[styles.section, { color: c.ink }]}>Biilasha ({rows.length})</Text>
      <SuccessNote text={success} />
      {loading ? <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}><ActivityIndicator color={c.blue} /></View>
      : error ? (
        <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
          <Text style={[styles.boxSub, { color: c.rose }]}>{error}</Text>
          <TouchableOpacity onPress={reload}><Text style={{ color: c.blue, fontWeight: '700', marginTop: 8 }}>Isku day mar kale</Text></TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="finance" size={24} color={c.muted2} />
          <Text style={[styles.boxSub, { color: c.muted }]}>Weli biil lama sameyn.</Text>
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
          {rows.map((r, i) => (
            <View key={r.id} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{r.invoice_number}</Text>
                <Text style={[styles.rowSub, { color: c.muted }]}>Hadhaaga: {r.balance} / {r.amount_due} · {r.status}</Text>
              </View>
              {Number(r.balance) <= 0 ? (
                <Text style={[styles.paid, { color: c.green }]}>La bixiyay</Text>
              ) : canRecordPayment ? (
                <TouchableOpacity onPress={() => { setPay(r); setAmount(String(r.balance)); setErr(null); }} style={[styles.actBtn, { backgroundColor: c.blue }]}>
                  <Text style={styles.actTxt}>Bixi</Text>
                </TouchableOpacity>
              ) : <Text style={[styles.paid, { color: c.muted }]}>Hadhaaga: {r.balance}</Text>}
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!pay} transparent animationType="fade" onRequestClose={() => setPay(null)}>
        <Pressable style={styles.overlay} onPress={() => setPay(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.ink }]}>Diiwaangeli Lacag</Text>
            <Text style={[styles.lbl, { color: c.muted }]}>LACAGTA</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={c.muted2}
              style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
            <Text style={[styles.lbl, { color: c.muted }]}>TIXRAAC (ikhtiyaari)</Text>
            <TextInput value={ref} onChangeText={setRef} placeholder="REF-…" placeholderTextColor={c.muted2}
              style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
            <ErrorNote text={err} />
            <SaveButton onPress={submit} saving={saving} label="Diiwaangeli" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function FinanceLiveScreen() {
  const { roleKey } = useAuth();
  // fee structures are a finance-staff concern; Student/Parent see only their
  // own invoices (below), never the school's fee-structure catalog.
  const isFinanceStaff = canRecordPaymentRole(roleKey);
  const structModule = {
    single: 'Qaab-lacageed', icon: 'finance', emptyText: 'Weli qaab-lacageed lama abuurin.',
    createRoles: ['schooladmin', 'superadmin', 'accountant'],
    list: (schoolId) => listFeeStructures(schoolId),
    create: (row) => createFeeStructure(row),
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Lacagta Term 1' },
      { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', fk: { list: (s) => p4List('academic_years', s), labelKey: 'name' } },
      { key: 'currency', label: 'LACAGTA', default: 'USD', placeholder: 'USD' },
    ],
    listTitle: (r) => r.name,
    listSub: (r) => r.currency || 'USD',
  };
  return (
    <ModuleScreenFrame title="Lacagaha" subtitle="Qaababka lacagta iyo biilasha">
      {isFinanceStaff ? <Phase5ModuleView module={structModule} /> : null}
      <InvoicesSection />
    </ModuleScreenFrame>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 6 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 1, fontWeight: '600' },
  actBtn: { borderRadius: 9, paddingVertical: 7, paddingHorizontal: 13 },
  actTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  paid: { fontSize: 12, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 20 },
  sheetTitle: { fontSize: 16.5, fontWeight: '800', marginBottom: 14 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7, marginTop: 6 },
  input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
});
