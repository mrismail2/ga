/* Lacagaha — complete role-aware fee workflow over real Supabase data.
   Staff manage structures/items/invoices/payments; Student/Parent see only
   RLS-scoped invoices and payment history. No displayed paid state is fake. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { ModuleScreenFrame, useAsyncData, SaveButton, ErrorNote, SuccessNote } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import {
  listFeeStructures, createFeeStructure, updateFeeStructure,
  listFeeItems, createFeeItem, updateFeeItem,
  listInvoices, listInvoiceItems, listInvoiceAdjustments,
  listPayments, recordPayment, generateInvoice, reversePayment,
  applyInvoiceAdjustment, p5FriendlyError,
} from '../../services/phase5';
const { canRecordPayment: canRecordPaymentRole } = require('../../domain/phase5Access');

function FinanceRecords() {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const canManage = canRecordPaymentRole(roleKey);
  const canReverse = roleKey === 'schooladmin' || roleKey === 'superadmin';
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [invoices, payments] = await Promise.all([listInvoices(schoolId), listPayments(schoolId)]);
    return { invoices, payments };
  }, [schoolId], { enabled: isLive && !!schoolId });
  const rows = (data && data.invoices) || [];
  const payments = (data && data.payments) || [];
  const [success, setSuccess] = useState('');

  const [genOpen, setGenOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [structs, setStructs] = useState([]);
  const [genStudent, setGenStudent] = useState('');
  const [genStruct, setGenStruct] = useState('');
  const [genDue, setGenDue] = useState('');
  const [genSaving, setGenSaving] = useState(false);
  const [genErr, setGenErr] = useState(null);

  const [pay, setPay] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [ref, setRef] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailData, setDetailData] = useState({ items: [], adjustments: [] });
  const [detailBusy, setDetailBusy] = useState(false);
  const [adjustKind, setAdjustKind] = useState('discount');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustErr, setAdjustErr] = useState('');

  const [reverseRow, setReverseRow] = useState(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseBusy, setReverseBusy] = useState(false);
  const [reverseErr, setReverseErr] = useState('');

  const openGen = async () => {
    setGenErr(null); setGenStudent(''); setGenStruct(''); setGenDue(''); setGenOpen(true);
    try {
      const [st, fs] = await Promise.all([p4List('students', schoolId), listFeeStructures(schoolId)]);
      setStudents(st); setStructs(fs.filter((x) => x.status !== 'archived'));
    } catch (e) { setGenErr(p5FriendlyError(e)); }
  };
  const submitGen = async () => {
    if (genSaving) return;
    setGenErr(null);
    if (!genStudent) { setGenErr('Dooro arday.'); return; }
    if (!genStruct) { setGenErr('Dooro qaab-lacageed.'); return; }
    if (genDue.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(genDue.trim())) { setGenErr('Taariikhda: qaabka waa YYYY-MM-DD.'); return; }
    setGenSaving(true);
    try {
      await generateInvoice(schoolId, { studentId: genStudent, feeStructureId: genStruct, dueDate: genDue.trim() || null });
      setGenOpen(false); setSuccess('Biilka waa la sameeyay.'); await reload();
    } catch (e) { setGenErr(p5FriendlyError(e)); }
    finally { setGenSaving(false); }
  };
  const submitPayment = async () => {
    if (saving || !pay) return;
    setErr(null); const amt = Number(amount);
    if (!amount || !Number.isFinite(amt) || amt <= 0) { setErr('Lacagta waa inay ka weyn tahay eber.'); return; }
    setSaving(true);
    try {
      await recordPayment(schoolId, { invoiceId: pay.id, amount: amt, method: method.trim() || null, reference: ref.trim() || null, receiptNo: receiptNo.trim() || null });
      setPay(null); setAmount(''); setRef(''); setReceiptNo(''); setSuccess('Lacagta waa la diiwaangeliyay.'); await reload();
    } catch (e) { setErr(p5FriendlyError(e)); }
    finally { setSaving(false); }
  };
  const openDetail = async (invoice) => {
    setDetail(invoice); setDetailBusy(true); setAdjustErr(''); setAdjustAmount(''); setAdjustReason('');
    try {
      const [items, adjustments] = await Promise.all([
        listInvoiceItems(schoolId, { invoice_id: invoice.id }),
        listInvoiceAdjustments(schoolId, { invoice_id: invoice.id }),
      ]);
      setDetailData({ items, adjustments });
    } catch (e) { setAdjustErr(p5FriendlyError(e)); }
    finally { setDetailBusy(false); }
  };
  const applyAdjustment = async () => {
    if (!detail || adjustBusy) return;
    const amt = Number(adjustAmount); setAdjustErr('');
    if (!Number.isFinite(amt) || amt <= 0) { setAdjustErr('Qiimaha dhimistu waa inuu ka weyn yahay eber.'); return; }
    setAdjustBusy(true);
    try {
      await applyInvoiceAdjustment(schoolId, { invoiceId: detail.id, kind: adjustKind, amount: amt, reason: adjustReason.trim() || null });
      setSuccess(adjustKind === 'waiver' ? 'Ka-dhaafista waa la diiwaangeliyay.' : 'Dhimista waa la diiwaangeliyay.');
      setDetail(null); await reload();
    } catch (e) { setAdjustErr(p5FriendlyError(e)); }
    finally { setAdjustBusy(false); }
  };
  const submitReverse = async () => {
    if (!reverseRow || reverseBusy) return;
    if (!reverseReason.trim()) { setReverseErr('Sababta sixitaanka waa qasab.'); return; }
    setReverseBusy(true); setReverseErr('');
    try {
      await reversePayment(schoolId, reverseRow.id, reverseReason.trim());
      setReverseRow(null); setReverseReason(''); setSuccess('Lacagta waa la celiyay iyadoo taariikhdu la ilaaliyay.'); await reload();
    } catch (e) { setReverseErr(p5FriendlyError(e)); }
    finally { setReverseBusy(false); }
  };

  if (loading) return <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}><ActivityIndicator color={c.blue} /></View>;
  if (error) return <View style={[styles.box, { backgroundColor: c.roseSoft }]}><Text style={[styles.boxSub, { color: c.rose }]}>{error}</Text><TouchableOpacity onPress={reload}><Text style={{ color: c.blue, fontWeight: '700', marginTop: 8 }}>Isku day mar kale</Text></TouchableOpacity></View>;

  return <View style={{ marginTop: 20 }}>
    <View style={styles.secHead}><Text style={[styles.section, { color: c.ink }]}>Biilasha ({rows.length})</Text>{canManage ? <TouchableOpacity onPress={openGen} style={[styles.genBtn, { backgroundColor: c.blue }]}><Icon name="plus" size={14} color="#fff" /><Text style={styles.genTxt}>Samee biil</Text></TouchableOpacity> : null}</View>
    <SuccessNote text={success} />
    {rows.length === 0 ? <EmptyBox c={c} text="Weli biil lama sameyn." /> : <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>{rows.map((r, i) => <View key={r.id} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i ? 1 : 0 }]}>
      <TouchableOpacity onPress={() => openDetail(r)} style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]}>{r.invoice_number}</Text>
        <Text style={[styles.rowSub, { color: c.muted }]}>Wadarta: {r.amount_due} · La bixiyay: {r.amount_paid} · Hadhaaga: {r.balance}</Text>
        <Text style={[styles.rowSub, { color: c.muted2 }]}>{r.due_date || 'Taariikh lama cayimin'} · {r.status}</Text>
      </TouchableOpacity>
      {Number(r.balance) <= 0 ? <Text style={[styles.paid, { color: c.green }]}>La bixiyay</Text> : canManage ? <TouchableOpacity onPress={() => { setPay(r); setAmount(String(r.balance)); setErr(null); }} style={[styles.actBtn, { backgroundColor: c.blue }]}><Text style={styles.actTxt}>Bixi</Text></TouchableOpacity> : null}
    </View>)}</View>}

    <Text style={[styles.section, { color: c.ink, marginTop: 22 }]}>Lacag-bixinnada ({payments.length})</Text>
    {payments.length === 0 ? <EmptyBox c={c} text="Weli lacag lama diiwaangelin." /> : <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>{payments.map((p, i) => <View key={p.id} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i ? 1 : 0 }]}>
      <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: c.ink }]}>{p.amount} {p.currency || ''}</Text><Text style={[styles.rowSub, { color: c.muted }]}>{p.paid_on || ''} · {p.reference || 'Tixraac ma leh'} · {p.receipt_no || 'Rasiid ma leh'}</Text>{p.reversed ? <Text style={[styles.reversed, { color: c.rose }]}>La celiyay</Text> : null}</View>
      {canReverse && !p.reversed ? <TouchableOpacity onPress={() => { setReverseRow(p); setReverseErr(''); }} style={[styles.outlineBtn, { borderColor: c.line }]}><Text style={[styles.outlineTxt, { color: c.rose }]}>Celi</Text></TouchableOpacity> : null}
    </View>)}</View>}

    <Modal visible={genOpen} transparent animationType="fade" onRequestClose={() => setGenOpen(false)}><Sheet c={c} onClose={() => setGenOpen(false)} title="Samee Biil"><ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
      <PickList c={c} label="ARDAYGA" rows={students} value={genStudent} onChange={setGenStudent} nameKey="full_name" empty="Arday lama helin." />
      <PickList c={c} label="QAAB-LACAGEEDKA" rows={structs} value={genStruct} onChange={setGenStruct} nameKey="name" empty="Qaab-lacageed lama helin." />
      <Field c={c} label="TAARIIKHDA DHAMMAADKA" value={genDue} onChange={setGenDue} placeholder="2026-12-01" />
      <ErrorNote text={genErr} /><SaveButton onPress={submitGen} saving={genSaving} label="Samee biil" />
    </ScrollView></Sheet></Modal>

    <Modal visible={!!pay} transparent animationType="fade" onRequestClose={() => setPay(null)}><Sheet c={c} onClose={() => setPay(null)} title="Diiwaangeli Lacag">
      <Field c={c} label="LACAGTA" value={amount} onChange={setAmount} keyboardType="numeric" placeholder="0" />
      <Field c={c} label="HABKA" value={method} onChange={setMethod} placeholder="cash / mobile / bank" />
      <Field c={c} label="TIXRAAC" value={ref} onChange={setRef} placeholder="REF-…" />
      <Field c={c} label="LAMBAR RASIID" value={receiptNo} onChange={setReceiptNo} placeholder="REC-…" />
      <ErrorNote text={err} /><SaveButton onPress={submitPayment} saving={saving} label="Diiwaangeli" />
    </Sheet></Modal>

    <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}><Sheet c={c} onClose={() => setDetail(null)} title={detail ? detail.invoice_number : 'Biil'}><ScrollView style={{ maxHeight: 500 }}>
      {detailBusy ? <ActivityIndicator color={c.blue} /> : <>
        <Text style={[styles.subTitle, { color: c.ink }]}>Qaybaha biilka</Text>{detailData.items.map((x) => <Text key={x.id} style={[styles.line, { color: c.muted }]}>{x.name}: {x.amount}</Text>)}
        <Text style={[styles.subTitle, { color: c.ink }]}>Dhimis/Ka-dhaafis</Text>{detailData.adjustments.length ? detailData.adjustments.map((x) => <Text key={x.id} style={[styles.line, { color: c.muted }]}>{x.kind}: {x.amount} · {x.reason || 'Sabab ma leh'}</Text>) : <Text style={[styles.line, { color: c.muted2 }]}>Ma jiro.</Text>}
        {canManage && detail && Number(detail.balance) > 0 ? <>
          <View style={styles.pickRow}>{['discount', 'waiver'].map((k) => <TouchableOpacity key={k} onPress={() => setAdjustKind(k)} style={[styles.pick, { borderColor: adjustKind === k ? c.blue : c.line, backgroundColor: adjustKind === k ? c.blueSoft : c.surface }]}><Text style={[styles.pickTxt, { color: adjustKind === k ? c.blue : c.muted }]}>{k === 'discount' ? 'Dhimis' : 'Ka-dhaafis'}</Text></TouchableOpacity>)}</View>
          <Field c={c} label="QIIMAHA" value={adjustAmount} onChange={setAdjustAmount} keyboardType="numeric" placeholder="0" />
          <Field c={c} label="SABABTA" value={adjustReason} onChange={setAdjustReason} placeholder="Sababta" />
          <ErrorNote text={adjustErr} /><SaveButton onPress={applyAdjustment} saving={adjustBusy} label="Kaydi sixitaanka" />
        </> : null}
      </>}
    </ScrollView></Sheet></Modal>

    <Modal visible={!!reverseRow} transparent animationType="fade" onRequestClose={() => setReverseRow(null)}><Sheet c={c} onClose={() => setReverseRow(null)} title="Celi Lacag-bixinta"><Text style={[styles.warning, { color: c.rose }]}>Diiwaanka lama tirtirayo; waxaa lagu calaamadaynayaa in la celiyay.</Text><Field c={c} label="SABABTA" value={reverseReason} onChange={setReverseReason} placeholder="Sababta sixitaanka" /><ErrorNote text={reverseErr} /><SaveButton onPress={submitReverse} saving={reverseBusy} label="Xaqiiji celinta" /></Sheet></Modal>
  </View>;
}

export default function FinanceLiveScreen() {
  const { roleKey } = useAuth();
  const isFinanceStaff = canRecordPaymentRole(roleKey);
  const structureModule = {
    single: 'Qaab-lacageed', icon: 'finance', emptyText: 'Weli qaab-lacageed lama abuurin.', createRoles: ['schooladmin', 'superadmin', 'accountant'],
    list: listFeeStructures, create: createFeeStructure, update: updateFeeStructure,
    fields: [
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Lacagta Term 1' },
      { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', fk: { list: (s) => p4List('academic_years', s), labelKey: 'name' } },
      { key: 'term_id', label: 'TERM-KA', fk: { list: (s) => p4List('terms', s), labelKey: 'name' } },
      { key: 'class_id', label: 'FASALKA', fk: { list: (s) => p4List('classes', s), labelKey: 'name' } },
      { key: 'currency', label: 'LACAGTA', default: 'USD', placeholder: 'USD' },
      { key: 'status', label: 'XAALADDA', default: 'active', options: [{ value: 'active', label: 'Firfircoon' }, { value: 'archived', label: 'Kayd' }] },
    ], listTitle: (r) => r.name, listSub: (r) => `${r.currency || 'USD'} · ${r.status}`,
  };
  const itemModule = {
    single: 'Qayb lacag', icon: 'billing', emptyText: 'Weli qayb lacag ah lama darin.', createRoles: ['schooladmin', 'superadmin', 'accountant'],
    list: listFeeItems, create: createFeeItem, update: updateFeeItem,
    fields: [
      { key: 'fee_structure_id', label: 'QAAB-LACAGEEDKA', required: true, fk: { list: listFeeStructures, labelKey: 'name' } },
      { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Tuition' },
      { key: 'amount', label: 'QIIMAHA', required: true, number: true, placeholder: '0' },
      { key: 'is_mandatory', label: 'QASAB', default: 'true', bool: true, options: [{ value: 'true', label: 'Qasab' }, { value: 'false', label: 'Ikhtiyaari' }] },
    ], listTitle: (r) => r.name, listSub: (r) => `${r.amount} · ${r.is_mandatory ? 'Qasab' : 'Ikhtiyaari'}`,
  };
  return <ModuleScreenFrame title="Lacagaha" subtitle="Qaababka, biilasha iyo lacag-bixinnada">
    {isFinanceStaff ? <><Text style={styles.moduleTitle}>Qaababka lacagta</Text><Phase5ModuleView module={structureModule} /><Text style={styles.moduleTitle}>Qaybaha lacagta</Text><Phase5ModuleView module={itemModule} /></> : null}
    <FinanceRecords />
  </ModuleScreenFrame>;
}

function EmptyBox({ c, text }) { return <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}><Icon name="finance" size={24} color={c.muted2} /><Text style={[styles.boxSub, { color: c.muted }]}>{text}</Text></View>; }
function Sheet({ c, onClose, title, children }) { return <Pressable style={styles.overlay} onPress={onClose}><Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}><View style={styles.sheetHead}><Text style={[styles.sheetTitle, { color: c.ink }]}>{title}</Text><TouchableOpacity onPress={onClose}><Icon name="close" size={17} color={c.muted} /></TouchableOpacity></View>{children}</Pressable></Pressable>; }
function Field({ c, label, value, onChange, placeholder, keyboardType }) { return <><Text style={[styles.lbl, { color: c.muted }]}>{label}</Text><TextInput value={value} onChangeText={onChange} keyboardType={keyboardType || 'default'} placeholder={placeholder} placeholderTextColor={c.muted2} style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} /></>; }
function PickList({ c, label, rows, value, onChange, nameKey, empty }) { return <><Text style={[styles.lbl, { color: c.muted }]}>{label}</Text><View style={styles.pickRow}>{rows.length ? rows.slice(0, 100).map((r) => { const on = value === r.id; return <TouchableOpacity key={r.id} onPress={() => onChange(on ? '' : r.id)} style={[styles.pick, { borderColor: on ? c.blue : c.line, backgroundColor: on ? c.blueSoft : c.surface }]}><Text style={[styles.pickTxt, { color: on ? c.blue : c.muted }]}>{r[nameKey] || r.id}</Text></TouchableOpacity>; }) : <Text style={[styles.line, { color: c.muted2 }]}>{empty}</Text>}</View></>; }

const styles = StyleSheet.create({
  moduleTitle: { fontSize: 15, fontWeight: '800', marginTop: 8, marginBottom: 10 }, section: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, genBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }, genTxt: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 6 }, boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 }, rowTitle: { fontSize: 14, fontWeight: '700' }, rowSub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  actBtn: { borderRadius: 9, paddingVertical: 7, paddingHorizontal: 13 }, actTxt: { color: '#fff', fontSize: 12, fontWeight: '800' }, paid: { fontSize: 12, fontWeight: '800' }, reversed: { fontSize: 11, fontWeight: '800', marginTop: 3 },
  outlineBtn: { borderWidth: 1, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 10 }, outlineTxt: { fontSize: 11.5, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }, sheet: { width: '100%', maxWidth: 440, borderRadius: 20, padding: 20 }, sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, sheetTitle: { fontSize: 16.5, fontWeight: '800' },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7, marginTop: 8 }, input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6 }, pick: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11, maxWidth: '100%' }, pickTxt: { fontSize: 12, fontWeight: '700' },
  subTitle: { fontSize: 13.5, fontWeight: '800', marginTop: 8, marginBottom: 6 }, line: { fontSize: 12.5, fontWeight: '600', lineHeight: 19 }, warning: { fontSize: 12.5, fontWeight: '700', marginBottom: 8 },
});
