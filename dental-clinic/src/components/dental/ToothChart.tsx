import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listToothRecords, recordToothCondition } from '@/services/patients';
import { readableError } from '@/lib/supabase';
import { dateTime } from '@/lib/format';
import type { ToothCondition, ToothRecord } from '@/types/database';
import {
  Button, EmptyState, Field, Modal, QueryBoundary, Select, Textarea, useToast, cx,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

/** FDI permanent dentition, drawn in anatomical order. */
const QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
};

export const CONDITIONS: Record<ToothCondition, { label: string; fill: string; stroke: string }> = {
  healthy: { label: 'Healthy', fill: 'var(--surface)', stroke: 'var(--line-2)' },
  caries: { label: 'Caries', fill: '#fbd5d5', stroke: '#cf3a3a' },
  filling: { label: 'Filling', fill: '#c9daff', stroke: '#2f6bf0' },
  crown: { label: 'Crown', fill: '#f8e2b4', stroke: '#b8790a' },
  bridge: { label: 'Bridge', fill: '#ffd9b0', stroke: '#b96a12' },
  root_canal: { label: 'Root canal', fill: '#ded3f8', stroke: '#7455d8' },
  implant: { label: 'Implant', fill: '#b6e6d3', stroke: '#0f9d6f' },
  extraction_planned: { label: 'Extraction planned', fill: '#ffe0e0', stroke: '#cf3a3a' },
  extracted: { label: 'Extracted', fill: 'var(--surface-3)', stroke: 'var(--text-3)' },
  missing: { label: 'Missing', fill: 'var(--surface-3)', stroke: 'var(--text-3)' },
  fractured: { label: 'Fractured', fill: '#ffd6ef', stroke: '#c94f86' },
  sensitive: { label: 'Sensitive', fill: '#c4ecf2', stroke: '#0e8f9e' },
  other: { label: 'Other', fill: '#e8e8ef', stroke: '#7c8698' },
};

const TOOTH_PATH =
  'M4.6 11.5C4.6 6 7.4 2.6 10.6 2.6c2.1 0 3.1 2.6 4.4 2.6s2.3-2.6 4.4-2.6c3.2 0 6 3.4 6 8.9 0 8.4-2.6 15.9-5.6 15.9-2 0-2.2-4.3-4.8-4.3s-2.8 4.3-4.8 4.3c-3 0-5.6-7.5-5.6-15.9Z';

function Tooth({
  number, condition, selected, onClick,
}: { number: number; condition: ToothCondition; selected: boolean; onClick: () => void }) {
  const style = CONDITIONS[condition];
  const upper = number < 30;
  const crossed = condition === 'missing' || condition === 'extracted' || condition === 'extraction_planned';
  return (
    <button
      type="button"
      className={cx('tooth', selected && 'is-selected')}
      onClick={onClick}
      title={`Tooth ${number} — ${style.label}`}
      aria-label={`Tooth ${number}, ${style.label}`}
    >
      {upper && <ToothGlyph condition={condition} upper crossed={crossed} />}
      <span>{number}</span>
      {!upper && <ToothGlyph condition={condition} upper={false} crossed={crossed} />}
    </button>
  );
}

function ToothGlyph({
  condition, upper, crossed,
}: { condition: ToothCondition; upper: boolean; crossed: boolean }) {
  const style = CONDITIONS[condition];
  return (
    <svg viewBox="0 0 30 30">
      <g transform={upper ? undefined : 'scale(1,-1) translate(0,-30)'}
         opacity={condition === 'missing' ? 0.5 : 1}>
        <path d={TOOTH_PATH} fill={style.fill} stroke={style.stroke} strokeWidth={1.4} strokeLinejoin="round" />
      </g>
      {crossed && <path d="M7 7 23 23M23 7 7 23" stroke={style.stroke} strokeWidth={2.2} strokeLinecap="round" />}
    </svg>
  );
}

export default function ToothChart({ patientId }: { patientId: string }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [selected, setSelected] = useState<number | null>(null);

  const current = useQuery({
    queryKey: ['tooth-records', patientId, 'current'],
    queryFn: () => listToothRecords(patientId, true),
  });
  const history = useQuery({
    queryKey: ['tooth-records', patientId, 'history'],
    queryFn: () => listToothRecords(patientId, false),
  });

  const byTooth = useMemo(() => {
    const map = new Map<number, ToothRecord>();
    for (const rec of current.data ?? []) map.set(rec.tooth_number, rec);
    return map;
  }, [current.data]);

  const conditionOf = (n: number): ToothCondition => byTooth.get(n)?.condition ?? 'healthy';

  const counts = useMemo(() => {
    const tally = new Map<ToothCondition, number>();
    for (const rec of current.data ?? []) {
      if (rec.condition === 'healthy') continue;
      tally.set(rec.condition, (tally.get(rec.condition) ?? 0) + 1);
    }
    return tally;
  }, [current.data]);

  const save = useMutation({
    mutationFn: recordToothCondition,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tooth-records', patientId] });
      notify(`Tooth ${variables.tooth_number} updated`);
      setSelected(null);
    },
    onError: (error) => notify(readableError(error), 'danger'),
  });

  return (
    <>
      <QueryBoundary query={current} skeletonRows={6}>
        {() => (
          <div className="chart-teeth">
            <div className="arch">
              <div className="quad">
                {QUADRANTS.upperRight.map((n) => (
                  <Tooth key={n} number={n} condition={conditionOf(n)}
                    selected={selected === n} onClick={() => setSelected(n)} />
                ))}
              </div>
              <div className="quad">
                {QUADRANTS.upperLeft.map((n) => (
                  <Tooth key={n} number={n} condition={conditionOf(n)}
                    selected={selected === n} onClick={() => setSelected(n)} />
                ))}
              </div>
            </div>
            <div className="arch__divider" />
            <div className="arch">
              <div className="quad">
                {QUADRANTS.lowerRight.map((n) => (
                  <Tooth key={n} number={n} condition={conditionOf(n)}
                    selected={selected === n} onClick={() => setSelected(n)} />
                ))}
              </div>
              <div className="quad">
                {QUADRANTS.lowerLeft.map((n) => (
                  <Tooth key={n} number={n} condition={conditionOf(n)}
                    selected={selected === n} onClick={() => setSelected(n)} />
                ))}
              </div>
            </div>

            <div className="tooth-legend">
              {Object.entries(CONDITIONS).map(([key, style]) => (
                <div key={key}>
                  <i style={{ background: style.fill, borderColor: style.stroke }} />
                  {style.label}
                  {counts.get(key as ToothCondition)
                    ? <b>({counts.get(key as ToothCondition)})</b> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </QueryBoundary>

      <ToothDialog
        patientId={patientId}
        tooth={selected}
        current={selected ? byTooth.get(selected) ?? null : null}
        history={(history.data ?? []).filter((r) => r.tooth_number === selected)}
        readOnly={!can('clinical.write')}
        busy={save.isPending}
        onClose={() => setSelected(null)}
        onSave={(values) => save.mutate({ patient_id: patientId, tooth_number: selected!, ...values })}
      />
    </>
  );
}

function ToothDialog({
  tooth, current, history, readOnly, busy, onClose, onSave,
}: {
  patientId: string;
  tooth: number | null;
  current: ToothRecord | null;
  history: ToothRecord[];
  readOnly: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (values: {
    condition: ToothCondition; proposed_treatment: string | null;
    existing_treatment: string | null; surface: string | null; notes: string | null;
  }) => void;
}) {
  const [condition, setCondition] = useState<ToothCondition>('healthy');
  const [proposed, setProposed] = useState('');
  const [existing, setExisting] = useState('');
  const [surface, setSurface] = useState('');
  const [notes, setNotes] = useState('');
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  // Reset the form when a different tooth is opened.
  if (tooth !== null && loadedFor !== tooth) {
    setLoadedFor(tooth);
    setCondition(current?.condition ?? 'healthy');
    setProposed(current?.proposed_treatment ?? '');
    setExisting(current?.existing_treatment ?? '');
    setSurface(current?.surface ?? '');
    setNotes('');
  }

  return (
    <Modal
      open={tooth !== null}
      onClose={onClose}
      title={tooth ? `Tooth ${tooth}` : ''}
      wide
      footer={
        readOnly ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => onSave({
                condition,
                proposed_treatment: proposed.trim() || null,
                existing_treatment: existing.trim() || null,
                surface: surface.trim() || null,
                notes: notes.trim() || null,
              })}
            >
              Save tooth record
            </Button>
          </>
        )
      }
    >
      <div className="grid grid--2">
        <div className="col" style={{ gap: 14 }}>
          <Field label="Condition" required>
            <Select value={condition} disabled={readOnly}
              onChange={(e) => setCondition(e.target.value as ToothCondition)}>
              {Object.entries(CONDITIONS).map(([key, style]) => (
                <option key={key} value={key}>{style.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Surface" hint="Mesial, distal, occlusal, buccal, lingual…">
            <input className="input" value={surface} disabled={readOnly}
              onChange={(e) => setSurface(e.target.value)} />
          </Field>
          <Field label="Existing treatment">
            <input className="input" value={existing} disabled={readOnly}
              onChange={(e) => setExisting(e.target.value)} />
          </Field>
          <Field label="Proposed treatment">
            <input className="input" value={proposed} disabled={readOnly}
              onChange={(e) => setProposed(e.target.value)} />
          </Field>
          <Field label="Clinical note">
            <Textarea rows={3} value={notes} disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Observation for tooth ${tooth ?? ''}…`} />
          </Field>
          {!readOnly && (
            <p className="text-2xs faint">
              Saving adds a new entry. Previous records are kept — nothing is overwritten.
            </p>
          )}
        </div>

        <div>
          <div className="eyebrow mb-8">History for this tooth</div>
          {history.length === 0 ? (
            <EmptyState title="No history yet"
              description="Every change to this tooth will be listed here with the date and the dentist." />
          ) : (
            <ul className="timeline">
              {history.map((rec) => (
                <li key={rec.id} className={`tone-${rec.is_current ? 'brand' : 'muted'}`}>
                  <b>{CONDITIONS[rec.condition].label}</b>
                  <small>
                    {dateTime(rec.recorded_at)}
                    {rec.recorded_by_profile ? ` · ${rec.recorded_by_profile.full_name}` : ''}
                  </small>
                  {rec.proposed_treatment && <div className="text-xs muted">Proposed: {rec.proposed_treatment}</div>}
                  {rec.notes && <div className="text-xs muted">{rec.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
