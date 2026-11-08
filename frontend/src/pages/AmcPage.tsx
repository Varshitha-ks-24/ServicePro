import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarRange, ChevronDown, Plus, RefreshCw, X } from 'lucide-react';
import { api, type Amc, type Asset, type Branch, type Customer, type Cycle, type PageResult, type WorkOrder } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export function AmcPage() {
  const [contracts, setContracts] = useState<Amc[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedContract, setSelectedContract] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState<'contract' | 'cycle' | 'complete' | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [contractForm, setContractForm] = useState({ contractNumber: '', customerId: '', branchId: '', startsOn: '', endsOn: '', monthlyService: true });
  const today = new Date();
  const [cycleForm, setCycleForm] = useState({ serviceMonth: today.getMonth() + 1, serviceYear: today.getFullYear(), assetIds: [] as number[] });
  const [completionForm, setCompletionForm] = useState({ actualServiceDate: '', workOrderId: '', serviceReport: '' });

  async function load() {
    setLoading(true); setError('');
    try {
      const [amcData, customerData, branchData, assetData, workData] = await Promise.all([
        api<PageResult<Amc>>('/amcs?page=0&size=100'), api<PageResult<Customer>>('/customers?page=0&size=100'),
        api<PageResult<Branch>>('/branches?page=0&size=100'), api<PageResult<Asset>>('/assets?page=0&size=100'),
        api<PageResult<WorkOrder>>('/work-orders?page=0&size=100'),
      ]);
      setContracts(amcData.items); setCustomers(customerData.items); setBranches(branchData.items); setAssets(assetData.items); setWorkOrders(workData.items);
      if (!selectedContract && amcData.items.length) setSelectedContract(amcData.items[0].id);
      if (selectedContract && !amcData.items.some((contract) => contract.id === selectedContract)) setSelectedContract(amcData.items[0]?.id || null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'AMC records could not be loaded.'); }
    finally { setLoading(false); }
  }

  async function loadCycles(contractId: number) {
    try { setCycles(await api<Cycle[]>(`/amcs/${contractId}/cycles`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Service cycles could not be loaded.'); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selectedContract) void loadCycles(selectedContract); else setCycles([]); }, [selectedContract]);

  const contract = contracts.find((item) => item.id === selectedContract) || null;
  const eligibleAssets = useMemo(() => assets.filter((asset) => contract && asset.customerName === contract.customerName && (!contract.branchId || asset.branchId === contract.branchId)), [assets, contract]);

  function beginContract() {
    setContractForm({ contractNumber: '', customerId: '', branchId: '', startsOn: '', endsOn: '', monthlyService: true }); setError(''); setModal('contract');
  }

  function beginCycle() {
    if (!contract) return;
    setCycleForm({ serviceMonth: today.getMonth() + 1, serviceYear: today.getFullYear(), assetIds: [] }); setError(''); setModal('cycle');
  }

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const created = await api<Amc>('/amcs', { method: 'POST', body: JSON.stringify({
        ...contractForm, customerId: Number(contractForm.customerId), branchId: contractForm.branchId ? Number(contractForm.branchId) : null,
        startsOn: contractForm.startsOn, endsOn: contractForm.endsOn, status: 'Active',
      }) });
      setModal(null); setSelectedContract(created.id); setMessage('AMC contract saved.'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'AMC contract could not be saved.'); }
    finally { setSaving(false); }
  }

  async function generateCycles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!contract) return;
    setSaving(true); setError('');
    try {
      await api(`/amcs/${contract.id}/cycles`, { method: 'POST', body: JSON.stringify(cycleForm) });
      setModal(null); setMessage('Monthly service cycles created.'); await loadCycles(contract.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Service cycles could not be created.'); }
    finally { setSaving(false); }
  }

  async function cycleStatus(cycle: Cycle, status: string) {
    setSaving(true); setError(''); setMessage('');
    try {
      await api(`/amc-cycles/${cycle.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setMessage(`${cycle.assetCode} service marked ${status.toLowerCase()}.`); if (selectedContract) await loadCycles(selectedContract);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cycle status could not be updated.'); }
    finally { setSaving(false); }
  }

  function beginCompletion(cycle: Cycle) {
    setSelectedCycle(cycle); setCompletionForm({ actualServiceDate: new Date().toISOString().slice(0, 10), workOrderId: '', serviceReport: '' }); setError(''); setModal('complete');
  }

  async function completeCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedCycle) return;
    setSaving(true); setError('');
    try {
      await api(`/amc-cycles/${selectedCycle.id}/status`, { method: 'PUT', body: JSON.stringify({
        status: 'Completed', actualServiceDate: completionForm.actualServiceDate,
        workOrderId: Number(completionForm.workOrderId), serviceReport: completionForm.serviceReport,
      }) });
      setModal(null); setMessage(`${selectedCycle.assetCode} monthly service report saved.`); if (selectedContract) await loadCycles(selectedContract);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Service completion could not be saved.'); }
    finally { setSaving(false); }
  }

  const eligibleWorkOrders = selectedCycle ? workOrders.filter((order) => order.status === 'Completed' && order.assetName === selectedCycle.assetName && order.branchName === selectedCycle.branchName) : [];

  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">RECURRING SERVICE</p><h1>AMC contracts</h1><p className="page-subtitle">Track coverage and service by asset, branch and service month.</p></div><button className="button button-primary" onClick={beginContract}><Plus size={16} />New AMC contract</button></div>
      {message && <div className="success-banner">{message}<button className="text-button" onClick={() => setMessage('')}>Dismiss</button></div>}{error && !modal && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Retry</button></div>}
      <div className="amc-layout">
        <section className="panel contract-panel"><div className="panel-heading"><div><h2>Contracts</h2><p>{contracts.length} saved agreements</p></div><RefreshCw size={17} className="muted-icon" /></div>{loading ? <div className="loading-inline">Loading contracts…</div> : contracts.length === 0 ? <div className="empty-state"><strong>No AMC contracts yet</strong><p>Saved contracts and service cycles will appear here.</p><button className="text-button" onClick={beginContract}>Add a contract</button></div> : <div className="contract-list">{contracts.map((item) => <button key={item.id} className={`contract-item ${item.id === selectedContract ? 'selected' : ''}`} onClick={() => setSelectedContract(item.id)}><span className="contract-symbol"><CalendarRange size={17} /></span><span className="contract-copy"><strong>{item.contractNumber}</strong><small>{item.customerName} · {item.branchName}</small><small>{new Date(item.startsOn).toLocaleDateString()} – {new Date(item.endsOn).toLocaleDateString()}</small></span><StatusBadge value={item.status} /></button>)}</div>}</section>
        <section className="panel cycle-panel"><div className="panel-heading"><div><p className="eyebrow">{contract?.contractNumber || 'SERVICE PLAN'}</p><h2>{contract?.customerName || 'Monthly service cycles'}</h2><p>{contract ? `${contract.branchName} · ${contract.monthlyService ? 'Monthly asset service' : 'Contract coverage'}` : 'Select an AMC contract to review its service months.'}</p></div><div className="heading-actions">{contract?.monthlyService && <button className="button button-outline" onClick={beginCycle}><Plus size={15} />Generate service month</button>}<button className="icon-button" title="Refresh cycles" onClick={() => selectedContract && void loadCycles(selectedContract)}><RefreshCw size={16} /></button></div></div>
          {!contract ? <div className="empty-state"><strong>No contract selected</strong><p>Create or select a contract to manage covered assets.</p></div> : cycles.length === 0 ? <div className="empty-state"><strong>No service cycles recorded</strong><p>Cycles are created for a month and asset, not by a fixed next-service date.</p></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Service month</th><th>Bank / branch</th><th>Customer asset</th><th>Status</th><th>Actual date</th><th>Service report</th><th>Actions</th></tr></thead><tbody>{cycles.map((cycle) => <tr key={cycle.id}><td><strong>{new Date(cycle.serviceYear, cycle.serviceMonth - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong></td><td><strong>{cycle.customerName}</strong><small>{cycle.branchName}</small></td><td><strong>{cycle.assetName}</strong><small>{cycle.assetCode}</small></td><td><StatusBadge value={cycle.status} /></td><td>{cycle.actualServiceDate ? new Date(`${cycle.actualServiceDate}T00:00:00`).toLocaleDateString() : <span className="muted">—</span>}</td><td className="truncate-cell">{cycle.serviceReport || <span className="muted">No report</span>}</td><td>{cycle.status === 'Pending' ? <button className="button button-small button-outline" disabled={saving} onClick={() => void cycleStatus(cycle, 'In Progress')}>Start</button> : cycle.status === 'In Progress' ? <button className="button button-small button-primary" disabled={saving} onClick={() => beginCompletion(cycle)}>Complete</button> : <span className="muted">—</span>}</td></tr>)}</tbody></table></div>}
        </section>
      </div>

      {modal && <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">AMC MANAGEMENT</p><h2>{modal === 'contract' ? 'New AMC contract' : modal === 'cycle' ? 'Generate monthly service' : 'Complete monthly service'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={19} /></button></div>
        {modal === 'contract' && <form className="record-form" onSubmit={createContract}><div className="form-grid"><label>Contract number<input required value={contractForm.contractNumber} onChange={(event) => setContractForm({ ...contractForm, contractNumber: event.target.value })} /></label><label>Bank / customer<select required value={contractForm.customerId} onChange={(event) => setContractForm({ ...contractForm, customerId: event.target.value, branchId: '' })}><option value="">Choose bank…</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Branch coverage<select value={contractForm.branchId} onChange={(event) => setContractForm({ ...contractForm, branchId: event.target.value })}><option value="">All customer branches</option>{branches.filter((item) => String(item.customerId) === contractForm.customerId).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label><label>Starts on<input required type="date" value={contractForm.startsOn} onChange={(event) => setContractForm({ ...contractForm, startsOn: event.target.value })} /></label><label>Ends on<input required type="date" value={contractForm.endsOn} onChange={(event) => setContractForm({ ...contractForm, endsOn: event.target.value })} /></label><label className="checkbox-field"><input type="checkbox" checked={contractForm.monthlyService} onChange={(event) => setContractForm({ ...contractForm, monthlyService: event.target.checked })} />Monthly service required</label></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save contract'}</button></div></form>}
        {modal === 'cycle' && <form className="record-form" onSubmit={generateCycles}><div className="form-grid"><label>Service month<select value={cycleForm.serviceMonth} onChange={(event) => setCycleForm({ ...cycleForm, serviceMonth: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2024, index).toLocaleDateString(undefined, { month: 'long' })}</option>)}</select></label><label>Service year<input type="number" min="2020" max="2100" required value={cycleForm.serviceYear} onChange={(event) => setCycleForm({ ...cycleForm, serviceYear: Number(event.target.value) })} /></label><fieldset className="asset-picker form-span-two"><legend>Customer assets covered by this contract</legend>{eligibleAssets.length === 0 ? <p className="muted">No matching customer assets are registered yet.</p> : eligibleAssets.map((asset) => <label key={asset.id} className="asset-option"><input type="checkbox" checked={cycleForm.assetIds.includes(asset.id)} onChange={(event) => setCycleForm((old) => ({ ...old, assetIds: event.target.checked ? [...old.assetIds, asset.id] : old.assetIds.filter((id) => id !== asset.id) }))} /><span><strong>{asset.name}</strong><small>{asset.code} · {asset.branchName}</small></span></label>)}</fieldset></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving || !cycleForm.assetIds.length}>{saving ? 'Generating…' : 'Generate cycles'}</button></div></form>}
        {modal === 'complete' && <form className="record-form" onSubmit={completeCycle}><p className="form-context"><strong>{selectedCycle?.assetName} · {selectedCycle?.customerName} / {selectedCycle?.branchName}</strong><span>Service must be recorded within {selectedCycle && new Date(selectedCycle.serviceYear, selectedCycle.serviceMonth - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.</span></p><label>Actual service date<input required type="date" value={completionForm.actualServiceDate} onChange={(event) => setCompletionForm({ ...completionForm, actualServiceDate: event.target.value })} /></label><label>Completed work order<select required value={completionForm.workOrderId} onChange={(event) => setCompletionForm({ ...completionForm, workOrderId: event.target.value })}><option value="">Choose completed work order…</option>{eligibleWorkOrders.map((order) => <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.summary}</option>)}</select></label>{eligibleWorkOrders.length === 0 && <div className="notice-line">No completed work order is linked to this asset yet. Complete its work order before closing the monthly cycle.</div>}<label>Service report<textarea required rows={4} value={completionForm.serviceReport} onChange={(event) => setCompletionForm({ ...completionForm, serviceReport: event.target.value })} /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving || !eligibleWorkOrders.length}>{saving ? 'Saving…' : 'Complete service cycle'}</button></div></form>}
      </section></div>}
    </div>
  );
}
