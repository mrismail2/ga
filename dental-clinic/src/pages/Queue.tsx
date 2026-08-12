import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listQueue, setQueueState } from '@/services/appointments';
import { readableError } from '@/lib/supabase';
import { timeOnly, waitedFor } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { QueueStatus } from '@/types/database';
import { Avatar, Badge, Button, Card, EmptyState, QueryBoundary, useToast } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const TONE: Record<QueueStatus, 'warn' | 'info' | 'ok'> = {
  waiting: 'warn', called: 'info', in_treatment: 'info', completed: 'ok',
};

export default function Queue() {
  const { can } = useAuth();
  const { t, label } = useI18n();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // Polls so the waiting room board stays live without a manual refresh.
  const queue = useQuery({ queryKey: ['queue'], queryFn: listQueue, refetchInterval: 30_000 });

  const move = useMutation({
    mutationFn: ({ id, state }: { id: string; state: QueueStatus }) => setQueueState(id, state),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  const active = (queue.data ?? []).filter((a) => a.queue_state !== 'completed');
  const done = (queue.data ?? []).filter((a) => a.queue_state === 'completed');

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('queue.title')}</h1>
          <p>{t('queue.subtitle')}</p>
        </div>
        <div className="page__actions">
          <Link className="btn" to="/appointments"><Icon name="calendar" /> {t('appt.title')}</Link>
        </div>
      </div>

      <Card title={t('queue.waitingNow')} subtitle={`${active.length} ${t('queue.inClinic')}`} padded={false} className="mb-16">
        <QueryBoundary
          query={{ ...queue, data: active }}
          empty={<EmptyState title={t('queue.empty')}
            description={t('queue.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('queue.no')}</th><th>{t('common.patient')}</th><th>{t('common.dentist')}</th>
                    <th>{t('queue.appointment')}</th><th>{t('queue.waiting')}</th>
                    <th>{t('common.status')}</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td><b className="text-md">{a.queue_number ?? '—'}</b></td>
                      <td>
                        <Link to={`/patients/${a.patient_id}`} className="cell-user">
                          <Avatar name={a.patient?.full_name ?? '?'} size="sm" />
                          <div>
                            <b>{a.patient?.full_name}</b>
                            <small>{a.patient?.patient_code}</small>
                          </div>
                        </Link>
                      </td>
                      <td>{a.dentist?.full_name ?? <span className="faint">{t('common.unassigned')}</span>}</td>
                      <td>{timeOnly(a.scheduled_at)}</td>
                      <td>{waitedFor(a.checked_in_at)}</td>
                      <td>
                        <Badge tone={TONE[a.queue_state ?? 'waiting']}>
                          {label('status', a.queue_state ?? 'waiting')}
                        </Badge>
                      </td>
                      <td className="right">
                        {can('appointments.write') && (
                          <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                            {a.queue_state === 'waiting' && (
                              <Button size="sm" onClick={() => move.mutate({ id: a.id, state: 'called' })}>{t('queue.call')}</Button>
                            )}
                            {(a.queue_state === 'waiting' || a.queue_state === 'called') && (
                              <Button size="sm" variant="primary"
                                onClick={() => move.mutate({ id: a.id, state: 'in_treatment' })}>{t('queue.start')}</Button>
                            )}
                            {a.queue_state === 'in_treatment' && (
                              <Button size="sm" variant="primary"
                                onClick={() => move.mutate({ id: a.id, state: 'completed' })}>{t('queue.complete')}</Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>
      </Card>

      {done.length > 0 && (
        <Card title={t('queue.completedToday')} subtitle={`${done.length} ${t('queue.seen')}`} padded={false}>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>{t('queue.no')}</th><th>{t('common.patient')}</th>
                <th>{t('common.dentist')}</th><th>{t('queue.completed')}</th></tr></thead>
              <tbody>
                {done.map((a) => (
                  <tr key={a.id}>
                    <td>{a.queue_number}</td>
                    <td>{a.patient?.full_name}</td>
                    <td>{a.dentist?.full_name ?? '—'}</td>
                    <td>{timeOnly(a.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
