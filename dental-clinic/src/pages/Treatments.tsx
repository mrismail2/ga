import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTreatment, listAllTreatments, listTreatmentTypes, updateTreatment,
} from '@/services/clinical';
import { listDentists } from '@/services/admin';
import { quickSearchPatients } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateOnly, money } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { TreatmentBalance, TreatmentStatus } from '@/types/database';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination,
  PaymentBadge, QueryBoundary, Select, Textarea, useToast, cx,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import { useI18n } from '@/i18n';

const STATUSES: (TreatmentStatus | 'all')[] = ['all', 'planned', 'approved', 'in_progress', 'completed', 'cancelled'];
const PAGE_SIZE = 25;

export default function Treatments() {
  const { can } = useAuth();
  const { t, label } = useI18n();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [status, setStatus] = useState<TreatmentStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [payFor, setPayFor] = useState<TreatmentBalance | null>(null);

  const query = useQuery({
    queryKey: ['treatments', status, page],
    queryFn: () => listAllTreatments({ status, page, pageSize: PAGE_SIZE }),
  });

  const advance = useMutation({
    mutationFn: ({ id, next }: { id: string; next: TreatmentStatus }) => updateTreatment(id, { status: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-balances'] });
      notify(t('treat.updated'));
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('treat.title')}</h1>
          <p>{t('treat.subtitle')}</p>
        </div>
        {can('clinical.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> {t('treat.new')}
            </Button>
          </div>
        )}
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <div className="segmented">
            {STATUSES.map((s) => (
              <button key={s} className={cx(status === s && 'is-active')}
                onClick={() => { setStatus(s); setPage(1); }}>
                {s === 'all' ? t('common.all') : label('status', s)}
              </button>
            ))}
          </div>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={8}
          empty={<EmptyState title={t('treat.empty')}
            description={t('treat.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('common.patient')}</th><th>{t('common.treatment')}</th>
                    <th>{t('common.tooth')}</th><th>{t('common.status')}</th>
                    <th className="right">{t('common.cost')}</th><th className="right">{t('common.paid')}</th>
                    <th className="right">{t('common.balance')}</th><th>{t('profile.payment')}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.treatment_id}>
                      <td>
                        <Link to={`/patients/${row.patient_id}`} className="cell-user">
                          <Avatar name={row.treatment_name ?? 'T'} size="sm" />
                          <div>
                            <b>{t('treat.openPatient')}</b>
                            <small>{dateOnly(row.created_at)}</small>
                          </div>
                        </Link>
                      </td>
                      <td><b>{row.treatment_name ?? t('common.treatment')}</b></td>
                      <td>{row.tooth_numbers?.length
                        ? row.tooth_numbers.join(', ')
                        : <span className="faint">—</span>}</td>
                      <td>
                        <Badge tone={row.status === 'completed' ? 'ok' : row.status === 'cancelled' ? 'danger' : 'info'}>
                          {label('status', row.status)}
                        </Badge>
                      </td>
                      <td className="right">{money(row.final_cost)}</td>
                      <td className="right">{money(row.amount_paid)}</td>
                      <td className={cx('right bold', row.balance > 0 && 'danger-text')}>{money(row.balance)}</td>
                      <td><PaymentBadge status={row.payment_status} /></td>
                      <td className="right">
                        <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                          {can('clinical.write') && row.status !== 'completed' && row.status !== 'cancelled' && (
                            <Button size="sm"
                              onClick={() => advance.mutate({ id: row.treatment_id, next: 'completed' })}>
                              {t('treat.complete')}
                            </Button>
                          )}
                          {can('finance.write') && row.balance > 0 && (
                            <Button size="sm" variant="primary" onClick={() => setPayFor(row)}>
                              {t('profile.payment')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>

        <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
      </Card>

      <NewTreatmentModal open={creating} onClose={() => setCreating(false)} />
      <RecordPaymentModal open={payFor !== null} treatment={payFor} onClose={() => setPayFor(null)} />
    </>
  );
}

export function NewTreatmentModal({
  open, onClose, presetPatient,
}: {
  open: boolean;
  onClose: () => void;
  presetPatient?: { id: string; full_name: string; patient_code: string };
}) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t } = useI18n();
  const [term, setTerm] = useState('');
  const [patient, setPatient] = useState(presetPatient ?? null);
  const [typeId, setTypeId] = useState('');
  const [dentistId, setDentistId] = useState('');
  const [teeth, setTeeth] = useState('');
  const [cost, setCost] = useState('');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const types = useQuery({ queryKey: ['treatment-types'], queryFn: () => listTreatmentTypes() });
  const dentists = useQuery({ queryKey: ['dentists'], queryFn: listDentists });
  const results = useQuery({
    queryKey: ['quick-search', term],
    queryFn: () => quickSearchPatients(term),
    enabled: term.trim().length >= 2 && !patient,
  });

  const create = useMutation({
    mutationFn: createTreatment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-balances'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding'] });
      notify(t('treat.created'));
      setCost(''); setTeeth(''); setNotes('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function pickType(id: string) {
    setTypeId(id);
    const chosen = types.data?.find((type) => type.id === id);
    if (chosen && !cost) setCost(String(chosen.default_price));
  }

  function submit() {
    setError(null);
    if (!patient) { setError(t('common.selectPatient')); return; }
    if (!typeId) { setError(t('treat.errType')); return; }
    const costValue = Number(cost);
    const discountValue = Number(discount || 0);
    if (!Number.isFinite(costValue) || costValue < 0) { setError(t('treat.errCost')); return; }
    if (discountValue > costValue) { setError(t('treat.errDiscount')); return; }

    create.mutate({
      patient_id: patient.id,
      treatment_type_id: typeId,
      dentist_id: dentistId || null,
      tooth_numbers: teeth.split(',').map((n) => Number(n.trim())).filter((n) => Number.isInteger(n) && n > 0),
      estimated_cost: costValue,
      discount: discountValue,
      status: 'in_progress',
      notes: notes.trim() || null,
    });
  }

  const finalCost = Math.max(Number(cost || 0) - Number(discount || 0), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('treat.new')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>{t('treat.create')}</Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}

      {!presetPatient && (
        <Field label={t('common.patient')} required>
          {patient ? (
            <div className="row">
              <Avatar name={patient.full_name} size="sm" />
              <b className="text-sm">{patient.full_name}</b>
              <span className="text-xs faint">{patient.patient_code}</span>
              <Button size="sm" className="ml-auto" onClick={() => setPatient(null)}>{t('common.change')}</Button>
            </div>
          ) : (
            <>
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('common.searchPatient')} />
              <div className="col mt-8" style={{ gap: 4 }}>
                {results.data?.map((p) => (
                  <button key={p.id} type="button" className="gsearch__item"
                    onClick={() => setPatient({ id: p.id, full_name: p.full_name, patient_code: p.patient_code })}>
                    <Avatar name={p.full_name} size="sm" />
                    <span className="text-sm bold">{p.full_name}</span>
                    <span className="text-2xs faint">{p.patient_code}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Field>
      )}

      <div className="form-grid mt-16">
        <Field label={t('common.treatment')} required>
          <Select value={typeId} onChange={(e) => pickType(e.target.value)}>
            <option value="">{t('treat.choose')}</option>
            {types.data?.map((type) => (
              <option key={type.id} value={type.id}>{type.name} — {money(type.default_price)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.dentist')}>
          <Select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
            <option value="">{t('common.unassigned')}</option>
            {dentists.data?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </Field>
        <Field label={t('treat.toothNumbers')} hint={t('treat.teethHint')}>
          <Input value={teeth} onChange={(e) => setTeeth(e.target.value)} placeholder="16, 26" />
        </Field>
        <Field label={t('common.cost')} required>
          <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label={t('common.discount')}>
          <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label={t('treat.finalCost')}>
          <Input value={money(finalCost)} disabled />
        </Field>
        <div className="full">
          <Field label={t('common.notes')}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
