import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Clock3, RotateCcw, Search, UserRoundCheck, Wrench } from 'lucide-react';
import { api, type PageResult, type Technician, type WorkOrder } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export function WorkOrdersPage({ roles }: { roles: string[] }) {
  const manager = roles.some((role) => ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER'].includes(role));
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<PageResult<WorkOrder>>({ items: [], page: 0, size: 20, total: 0 });
  const [approvals, setApprovals] = useState<WorkOrder[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'createdAt', desc: true });
  const [completeOrder, setCompleteOrder] = useState<WorkOrder | null>(null);
  const [completion, setCompletion] = useState({ billableClass: 'Non-billable', workPerformed: '', completionNotes: '' });
  const [decisionOrder, setDecisionOrder] = useState<WorkOrder | null>(null);
  const [decision, setDecision] = useState<'Approve' | 'Return'>('Approve');
  const [decisionReason, setDecisionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ page: String(page), size: '20', search });
      if (status) query.set('status', status);
      const [orders, roster, pending] = await Promise.all([
        api<PageResult<WorkOrder>>(`/work-orders?${query}`),
        manager ? api<PageResult<Technician>>('/technicians?page=0&size=100') : Promise.resolve({ items: [] as Technician[] }),
        manager ? api<PageResult<WorkOrder>>('/work-orders?page=0&size=100&status=Completion%20submitted') : Promise.resolve({ items: [] as WorkOrder[] }),
      ]);
      setResult(orders); setTechnicians(roster.items); setApprovals(pending.items);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Work orders could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [page, search, status]);

  const rows = useMemo(() => [...result.items].sort((a, b) => {
    const left = String(a[sort.key as keyof WorkOrder] ?? '');
    const right = String(b[sort.key as keyof WorkOrder] ?? '');
    return left.localeCompare(right, undefined, { numeric: true }) * (sort.desc ? -1 : 1);
  }), [result.items, sort]);

  async function assign(order: WorkOrder) {
    const technicianId = assignments[order.id];
    if (!technicianId) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await api(`/work-orders/${order.id}/assignment`, { method: 'PUT', body: JSON.stringify({ technicianId: Number(technicianId) }) });
      setMessage(`${order.workOrderNumber} assigned.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Assignment failed.'); }
    finally { setSaving(false); }
  }

  async function updateWorkOrderStatus(order: WorkOrder, nextStatus: string) {
    setSaving(true); setError(''); setMessage('');
    try {
      await api(`/work-orders/${order.id}/status`, { method: 'PUT', body: JSON.stringify({ status: nextStatus }) });
      setMessage(`${order.workOrderNumber} moved to ${nextStatus.toLowerCase()}.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Status could not be updated.'); }
    finally { setSaving(false); }
  }

  function openComplete(order: WorkOrder) {
    setCompleteOrder(order); setCompletion({ billableClass: order.billableClass || 'Non-billable', workPerformed: '', completionNotes: '' }); setError('');
  }

  async function submitCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!completeOrder) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await api(`/work-orders/${completeOrder.id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'Completion submitted', ...completion }) });
      setCompleteOrder(null); setMessage(`${completeOrder.workOrderNumber} completion submitted for manager approval.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Completion could not be submitted.'); }
    finally { setSaving(false); }
  }

  function openDecision(order: WorkOrder, next: 'Approve' | 'Return') {
    setDecisionOrder(order); setDecision(next); setDecisionReason(''); setError('');
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!decisionOrder) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await api(`/work-orders/${decisionOrder.id}/completion-decision`, {
        method: 'POST', body: JSON.stringify({ decision, reason: decisionReason }),
      });
      setDecisionOrder(null);
      setMessage(decision === 'Approve' ? `${decisionOrder.workOrderNumber} approved and completed.` : `${decisionOrder.workOrderNumber} returned to the technician for further work.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Manager decision could not be saved.'); }
    finally { setSaving(false); }
  }

  function sortBy(key: string) { setSort((old) => ({ key, desc: old.key === key ? !old.desc : false })); }

  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">SERVICE OPERATIONS</p><h1>Work orders</h1><p className="page-subtitle">Assign and track approved field work through completion.</p></div><div className="heading-note"><Wrench size={17} />Generated from service requests</div></div>
      {message && <div className="success-banner">{message}<button className="text-button" onClick={() => setMessage('')}>Dismiss</button></div>}
      {error && !completeOrder && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Retry</button></div>}
      {manager && <section className="panel approval-panel"><div className="panel-heading"><div><h2>Completion approvals</h2><p>{approvals.length} submitted for review</p></div><StatusBadge value={approvals.length ? 'Pending manager approval' : 'Completed'} /></div>{approvals.length === 0 ? <div className="empty-state"><strong>No completions awaiting review</strong><p>Technician completion reports will appear here before a work order is marked completed.</p></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Work order</th><th>Bank / branch</th><th>Technician</th><th>Work performed</th><th>Classification</th><th>Review</th></tr></thead><tbody>{approvals.map((order) => <tr key={order.id}><td><strong className="mono-id">{order.workOrderNumber}</strong></td><td><strong>{order.customerName}</strong><small>{order.branchName}</small></td><td>{order.technicianName}</td><td className="truncate-cell">{order.workPerformed || <span className="muted">No report</span>}</td><td>{order.billableClass && <StatusBadge value={order.billableClass} />}</td><td><div className="row-actions"><button className="button button-small button-primary" onClick={() => openDecision(order, 'Approve')}><Check size={13} />Approve</button><button className="button button-small button-outline" onClick={() => openDecision(order, 'Return')}><RotateCcw size={13} />Return</button></div></td></tr>)}</tbody></table></div>}</section>}
      <section className="panel records-panel">
        <div className="records-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => { setPage(0); setSearch(event.target.value); }} placeholder="Search ID, bank, branch, service…" /></label><select className="toolbar-select" value={status} onChange={(event) => { setPage(0); setStatus(event.target.value); }} aria-label="Filter work orders by status"><option value="">All statuses</option>{['Open', 'Assigned', 'In progress', 'Completion submitted', 'On hold', 'Completed', 'Cancelled'].map((value) => <option key={value}>{value}</option>)}</select><span className="result-count">{result.total.toLocaleString()} work orders</span></div>
        <div className="table-scroll"><table className="data-table work-orders-table"><thead><tr>{[
          ['workOrderNumber', 'Work order ID'], ['createdAt', 'Created'], ['technicianName', 'Assigned technician'], ['customerName', 'Bank / branch'], ['summary', 'Service summary'], ['priority', 'Priority'], ['status', 'Status'], ['billableClass', 'Billing class'],
        ].map(([key, label]) => <th key={key}><button className="sort-button" onClick={() => sortBy(key)}>{label}{sort.key === key ? sort.desc ? <ArrowDown size={13} /> : <ArrowUp size={13} /> : null}</button></th>)}<th>Actions</th></tr></thead>
          <tbody>{loading ? <tr><td className="table-message" colSpan={9}>Loading work orders…</td></tr> : rows.length === 0 ? <tr><td className="table-message" colSpan={9}><strong>{search || status ? 'No matching work orders' : 'No work orders created'}</strong><span>Review service requests and create a work order to begin.</span></td></tr> : rows.map((order) => <tr key={order.id}><td><strong className="mono-id">{order.workOrderNumber}</strong><small>{order.requestNumber}</small></td><td>{new Date(order.createdAt).toLocaleDateString()}</td><td>{order.technicianName || <div className="assign-cell"><select aria-label={`Assign ${order.workOrderNumber}`} value={assignments[order.id] || ''} onChange={(event) => setAssignments((old) => ({ ...old, [order.id]: event.target.value }))}><option value="">Choose technician</option>{technicians.filter((tech) => tech.status === 'Active').map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}</select><button className="icon-button compact" title="Assign technician" disabled={!assignments[order.id] || saving} onClick={() => void assign(order)}><UserRoundCheck size={16} /></button></div>}</td><td><strong>{order.customerName}</strong><small>{order.branchName}</small></td><td className="truncate-cell">{order.summary}</td><td><span className={`priority-text priority-${order.priority.toLowerCase()}`}>{order.priority}</span></td><td><StatusBadge value={order.status} /></td><td>{order.billableClass ? <StatusBadge value={order.billableClass} /> : <span className="muted">Unclassified</span>}</td><td><div className="row-actions">{order.status === 'Assigned' && <button className="button button-small button-outline" disabled={saving} onClick={() => void updateWorkOrderStatus(order, 'In progress')}>Start</button>}{order.status === 'In progress' && <button className="button button-small button-primary" disabled={saving} onClick={() => openComplete(order)}>Complete</button>}{order.scheduledStart ? <span className="appointment-icon" title={new Date(order.scheduledStart).toLocaleString()}><Clock3 size={15} /></span> : null}</div></td></tr>)}</tbody>
        </table></div>
        <div className="table-footer"><span>Showing {result.total === 0 ? 0 : page * result.size + 1}–{Math.min((page + 1) * result.size, result.total)} of {result.total}</span><div className="pagination"><button aria-label="Previous page" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(value - 1, 0))}><ChevronLeft size={17} /></button><span>Page {page + 1} of {Math.max(1, Math.ceil(result.total / result.size))}</span><button aria-label="Next page" disabled={(page + 1) * result.size >= result.total || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
      </section>

      {completeOrder && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="complete-order-title"><div className="modal-heading"><div><p className="eyebrow">TECHNICIAN COMPLETION</p><h2 id="complete-order-title">Submit {completeOrder.workOrderNumber}</h2></div><button className="icon-button" onClick={() => setCompleteOrder(null)} aria-label="Close dialog">×</button></div><form className="record-form" onSubmit={submitCompletion}><p className="form-context"><strong>{completeOrder.customerName} · {completeOrder.branchName}</strong><span>Submission does not complete the work order. A manager must review and approve it.</span></p><label>Service classification<select required value={completion.billableClass} onChange={(event) => setCompletion({ ...completion, billableClass: event.target.value })}><option>Non-billable</option><option>Billable</option></select></label><label>Work performed<textarea rows={4} required value={completion.workPerformed} onChange={(event) => setCompletion({ ...completion, workPerformed: event.target.value })} /></label><label>Completion notes<textarea rows={2} value={completion.completionNotes} onChange={(event) => setCompletion({ ...completion, completionNotes: event.target.value })} /></label>{completion.billableClass === 'Billable' && <div className="notice-line">Billable classification is recorded for manager review. Invoice generation is not enabled in this phase.</div>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setCompleteOrder(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit for approval'}</button></div></form></section></div>}
      {decisionOrder && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="decision-title"><div className="modal-heading"><div><p className="eyebrow">MANAGER REVIEW</p><h2 id="decision-title">{decision === 'Approve' ? 'Approve' : 'Return'} {decisionOrder.workOrderNumber}</h2></div><button className="icon-button" onClick={() => setDecisionOrder(null)} aria-label="Close dialog">×</button></div><form className="record-form" onSubmit={submitDecision}><p className="form-context"><strong>{decisionOrder.billableClass} · {decisionOrder.customerName} / {decisionOrder.branchName}</strong><span>{decisionOrder.workPerformed}</span></p><label>Decision reason<textarea required minLength={3} rows={3} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setDecisionOrder(null)}>Cancel</button><button className={`button ${decision === 'Approve' ? 'button-primary' : 'button-outline'}`} disabled={saving}>{saving ? 'Saving…' : decision === 'Approve' ? 'Approve completion' : 'Return for rework'}</button></div></form></section></div>}
    </div>
  );
}
