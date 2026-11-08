import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, CalendarDays, Check, Clock3, X } from 'lucide-react';
import { api, type PageResult, type WorkOrder } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

type Postponement = {
  id: number; workOrderId: number; workOrderNumber: string; originalStart: string;
  proposedStart: string; reason: string; requestedBy: string; status: string;
};

export function AppointmentsPage({ roles, email }: { roles: string[]; email: string }) {
  const manager = roles.some((role) => ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER'].includes(role));
  const technician = roles.includes('TECHNICIAN');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [requests, setRequests] = useState<Postponement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Postponement | null>(null);
  const [mode, setMode] = useState<'request' | 'decision' | null>(null);
  const [decision, setDecision] = useState<'Approve' | 'Decline'>('Approve');
  const [proposedStart, setProposedStart] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const page = await api<PageResult<WorkOrder>>('/work-orders?page=0&size=100');
      setWorkOrders(page.items);
      if (manager) {
        const pending = await api<PageResult<Postponement>>('/postponement-requests?page=0&size=100');
        setRequests(pending.items);
      } else setRequests([]);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Appointment data could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const scheduledOrders = useMemo(() => workOrders.filter((order) => order.scheduledStart && order.status !== 'Completed' && order.status !== 'Cancelled')
    .filter((order) => manager || (technician && order.technicianEmail?.toLowerCase() === email.toLowerCase()))
    .sort((a, b) => String(a.scheduledStart).localeCompare(String(b.scheduledStart))), [workOrders, manager, technician, email]);

  function openRequest(order: WorkOrder) {
    setSelectedOrder(order); setProposedStart(''); setReason(''); setError(''); setMode('request');
  }

  function openDecision(request: Postponement, next: 'Approve' | 'Decline') {
    setSelectedRequest(request); setDecision(next); setReason(''); setError(''); setMode('decision');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      if (mode === 'request' && selectedOrder) {
        await api(`/work-orders/${selectedOrder.id}/postponement-requests`, { method: 'POST', body: JSON.stringify({
          proposedStart: new Date(proposedStart).toISOString().slice(0, 19), reason,
        }) });
        setMessage(`Postponement request submitted for ${selectedOrder.workOrderNumber}. The existing appointment remains unchanged pending manager approval.`);
      } else if (mode === 'decision' && selectedRequest) {
        await api(`/postponement-requests/${selectedRequest.id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) });
        setMessage(`Request ${decision.toLowerCase()}d. ${decision === 'Decline' ? 'The original appointment is unchanged.' : 'The approved appointment time has been updated.'}`);
      }
      setMode(null); await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Appointment change could not be saved.'); }
    finally { setSaving(false); }
  }

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">SCHEDULE & APPROVALS</p><h1>Service appointments</h1><p className="page-subtitle">Scheduled work and manager-reviewed postponement requests.</p></div><div className="heading-note"><CalendarClock size={17} />Appointment history is retained</div></div>
    {message && <div className="success-banner">{message}<button className="text-button" onClick={() => setMessage('')}>Dismiss</button></div>}
    {error && !mode && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Retry</button></div>}

    {manager && <section className="panel approval-panel"><div className="panel-heading"><div><h2>Postponement approval queue</h2><p>{requests.length} pending manager decisions</p></div><StatusBadge value={requests.length ? 'Pending manager approval' : 'Completed'} /></div>{loading ? <div className="loading-inline">Loading requests…</div> : requests.length === 0 ? <div className="empty-state"><strong>No postponement requests pending</strong><p>When a technician proposes a new visit time, the existing appointment will remain until you decide.</p></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Work order</th><th>Current appointment</th><th>Proposed time</th><th>Requested by</th><th>Reason</th><th>Decision</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong className="mono-id">{request.workOrderNumber}</strong></td><td>{new Date(request.originalStart).toLocaleString()}</td><td><strong>{new Date(request.proposedStart).toLocaleString()}</strong></td><td>{request.requestedBy}</td><td className="truncate-cell">{request.reason}</td><td><div className="row-actions"><button className="button button-small button-primary" onClick={() => openDecision(request, 'Approve')}><Check size={13} />Approve</button><button className="button button-small button-outline" onClick={() => openDecision(request, 'Decline')}>Decline</button></div></td></tr>)}</tbody></table></div>}</section>}

    <section className="panel records-panel"><div className="panel-heading"><div><h2>{technician && !manager ? 'My scheduled work' : 'Scheduled work'}</h2><p>Appointment times are changed only after manager approval.</p></div><CalendarDays size={18} className="muted-icon" /></div>{loading ? <div className="loading-inline">Loading appointments…</div> : scheduledOrders.length === 0 ? <div className="empty-state"><strong>No scheduled work orders</strong><p>Appointment dates appear when a service request is converted into scheduled work.</p></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Work order</th><th>Scheduled time</th><th>Bank / branch</th><th>Service</th><th>Technician</th><th>Status</th>{(technician || manager) && <th>Action</th>}</tr></thead><tbody>{scheduledOrders.map((order) => <tr key={order.id}><td><strong className="mono-id">{order.workOrderNumber}</strong></td><td><span className="appointment-time"><Clock3 size={14} />{new Date(order.scheduledStart!).toLocaleString()}</span></td><td><strong>{order.customerName}</strong><small>{order.branchName}</small></td><td>{order.summary}</td><td>{order.technicianName || <span className="muted">Unassigned</span>}</td><td><StatusBadge value={order.status} /></td>{(technician || manager) && <td><button className="button button-small button-outline" disabled={!order.technicianId} onClick={() => openRequest(order)}>Request postponement</button></td>}</tr>)}</tbody></table></div>}</section>

    {mode && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">{mode === 'request' ? 'TECHNICIAN REQUEST' : 'MANAGER DECISION'}</p><h2>{mode === 'request' ? `Request new time · ${selectedOrder?.workOrderNumber}` : `${decision} postponement · ${selectedRequest?.workOrderNumber}`}</h2></div><button className="icon-button" onClick={() => setMode(null)} aria-label="Close dialog"><X size={19} /></button></div><form className="record-form" onSubmit={submit}>{mode === 'request' ? <><p className="form-context"><strong>Current appointment: {selectedOrder?.scheduledStart && new Date(selectedOrder.scheduledStart).toLocaleString()}</strong><span>Submitting this request does not change the appointment. A manager must approve it.</span></p><label>Proposed date and time<input required type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={proposedStart} onChange={(event) => setProposedStart(event.target.value)} /></label><label>Reason for postponement<textarea required minLength={3} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label></> : <><p className="form-context"><strong>{selectedRequest?.workOrderNumber}: {new Date(selectedRequest?.originalStart || '').toLocaleString()} → {new Date(selectedRequest?.proposedStart || '').toLocaleString()}</strong><span>Requested by {selectedRequest?.requestedBy}. Declining leaves the original appointment unchanged.</span></p><label>Decision reason<textarea required minLength={3} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label></>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setMode(null)}>Cancel</button><button className={`button ${mode === 'decision' && decision === 'Decline' ? 'button-outline' : 'button-primary'}`} disabled={saving}>{saving ? 'Saving…' : mode === 'request' ? 'Submit request' : `${decision} request`}</button></div></form></section></div>}
  </div>;
}
