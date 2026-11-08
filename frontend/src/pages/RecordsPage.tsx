import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, Search, X } from 'lucide-react';
import { api, type Asset, type Branch, type Customer, type PageResult, type ServiceRequest, type Technician } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

type Kind = 'customers' | 'branches' | 'assets' | 'technicians' | 'service-requests';
type Field = { name: string; label: string; type?: string; required?: boolean; options?: Array<{ value: string; label: string }> };
type Column = { key: string; label: string; sortable?: boolean };
type Row = Record<string, unknown> & { id: number };

const configurations: Record<Kind, { title: string; singular: string; description: string; columns: Column[]; fields: Field[] }> = {
  customers: {
    title: 'Bank customers', singular: 'Bank customer', description: 'Manage bank accounts and their service contacts.',
    columns: [{ key: 'code', label: 'Customer code', sortable: true }, { key: 'name', label: 'Bank / customer', sortable: true }, { key: 'gstin', label: 'GSTIN' }, { key: 'contactName', label: 'Primary contact' }, { key: 'phone', label: 'Phone' }, { key: 'active', label: 'Status' }],
    fields: [{ name: 'code', label: 'Customer code', required: true }, { name: 'name', label: 'Bank / customer name', required: true }, { name: 'gstin', label: 'GSTIN' }, { name: 'billingAddress', label: 'Billing address' }, { name: 'contactName', label: 'Primary contact' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'active', label: 'Active customer', type: 'checkbox' }],
  },
  branches: {
    title: 'Branch management', singular: 'Branch', description: 'Keep branch codes unique within each bank customer.',
    columns: [{ key: 'code', label: 'Branch code', sortable: true }, { key: 'name', label: 'Branch', sortable: true }, { key: 'customerName', label: 'Bank / customer', sortable: true }, { key: 'city', label: 'City' }, { key: 'managerName', label: 'Branch contact' }, { key: 'phone', label: 'Phone' }],
    fields: [{ name: 'customerId', label: 'Bank / customer', type: 'select', required: true }, { name: 'code', label: 'Branch code', required: true }, { name: 'name', label: 'Branch name', required: true }, { name: 'address', label: 'Street address', required: true }, { name: 'city', label: 'City' }, { name: 'state', label: 'State' }, { name: 'postalCode', label: 'PIN code' }, { name: 'managerName', label: 'Branch contact' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'active', label: 'Active branch', type: 'checkbox' }],
  },
  assets: {
    title: 'Customer asset register', singular: 'Customer asset', description: 'Bank-owned equipment is tracked separately from ServicePro company inventory.',
    columns: [{ key: 'code', label: 'Asset ID', sortable: true }, { key: 'name', label: 'Asset', sortable: true }, { key: 'category', label: 'Category' }, { key: 'customerName', label: 'Bank' }, { key: 'branchName', label: 'Branch' }, { key: 'serialNumber', label: 'Serial number' }, { key: 'conditionStatus', label: 'Condition' }],
    fields: [{ name: 'branchId', label: 'Bank branch', type: 'select', required: true }, { name: 'code', label: 'Asset ID', required: true }, { name: 'name', label: 'Asset name', required: true }, { name: 'category', label: 'Category', required: true }, { name: 'serialNumber', label: 'Serial number' }, { name: 'manufacturer', label: 'Manufacturer' }, { name: 'model', label: 'Model' }, { name: 'installedOn', label: 'Installation date', type: 'date' }, { name: 'warrantyUntil', label: 'Warranty until', type: 'date' }, { name: 'conditionStatus', label: 'Condition', type: 'select', options: ['Good', 'Needs attention', 'Out of service'].map((value) => ({ value, label: value })) }],
  },
  technicians: {
    title: 'Technician management', singular: 'Technician', description: 'Manage an expandable service workforce. No skill-based assignment is used.',
    columns: [{ key: 'employeeCode', label: 'Employee ID', sortable: true }, { key: 'name', label: 'Technician', sortable: true }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'status', label: 'Status' }],
    fields: [{ name: 'employeeCode', label: 'Employee ID', required: true }, { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' }, { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'].map((value) => ({ value, label: value })) }],
  },
  'service-requests': {
    title: 'Service requests', singular: 'Service request', description: 'Record bank complaints and convert eligible requests into work orders.',
    columns: [{ key: 'requestNumber', label: 'Request ID', sortable: true }, { key: 'createdAt', label: 'Reported', sortable: true }, { key: 'customerName', label: 'Bank / customer', sortable: true }, { key: 'branchName', label: 'Branch' }, { key: 'assetName', label: 'Asset' }, { key: 'summary', label: 'Service summary' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }],
    fields: [{ name: 'customerId', label: 'Bank / customer', type: 'select', required: true }, { name: 'branchId', label: 'Branch', type: 'select', required: true }, { name: 'assetId', label: 'Asset (optional)', type: 'select' }, { name: 'summary', label: 'Issue summary', required: true }, { name: 'description', label: 'Issue details', type: 'textarea', required: true }, { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Normal', 'High', 'Urgent'].map((value) => ({ value, label: value })) }, { name: 'reportedBy', label: 'Reported by' }],
  },
};

export function RecordsPage({ kind, canEdit = true }: { kind: Kind; canEdit?: boolean }) {
  const config = configurations[kind];
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [result, setResult] = useState<PageResult<Row>>({ items: [], page: 0, size: 20, total: 0 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<'create' | 'convert' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [conversion, setConversion] = useState({ technicianId: '', scheduledStart: '' });
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ page: String(page), size: '20', search });
      if (kind === 'service-requests' && statusFilter) query.set('status', statusFilter);
      const pageData = await api<PageResult<Row>>(`/${kind}?${query}`);
      setResult(pageData);
      if (kind === 'branches' || kind === 'assets' || kind === 'service-requests') {
        const [customerData, branchData, assetData] = await Promise.all([
          api<PageResult<Customer>>('/customers?page=0&size=100'),
          api<PageResult<Branch>>('/branches?page=0&size=100'),
          api<PageResult<Asset>>('/assets?page=0&size=100'),
        ]);
        setCustomers(customerData.items); setBranches(branchData.items); setAssets(assetData.items);
      }
      if (kind === 'service-requests') setTechnicians((await api<PageResult<Technician>>('/technicians?page=0&size=100')).items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Records could not be loaded.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [kind, page, search, statusFilter]);

  const rows = useMemo(() => {
    if (!sortKey) return result.items;
    return [...result.items].sort((a, b) => String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true }) * (sortDirection === 'asc' ? 1 : -1));
  }, [result.items, sortKey, sortDirection]);

  function openCreate() {
    const initial: Record<string, string | boolean> = {};
    config.fields.forEach((field) => {
      if (field.type === 'checkbox') initial[field.name] = true;
      else if (field.type === 'select') initial[field.name] = field.options?.[0]?.value || '';
      else initial[field.name] = '';
    });
    setForm(initial); setEditingId(null); setError(''); setModal('create');
  }

  function openEdit(row: Row) {
    const initial: Record<string, string | boolean> = {};
    config.fields.forEach((field) => {
      const value = row[field.name];
      initial[field.name] = field.type === 'checkbox' ? Boolean(value) : value == null ? '' : String(value);
    });
    setForm(initial); setEditingId(row.id); setError(''); setModal('create');
  }

  function openConvert(request: ServiceRequest) {
    setSelectedRequest(request); setConversion({ technicianId: '', scheduledStart: '' }); setError(''); setModal('convert');
  }

  function optionsFor(field: Field) {
    if (field.name === 'customerId') return customers.map((customer) => ({ value: String(customer.id), label: `${customer.name} (${customer.code})` }));
    if (field.name === 'branchId') return branches.map((branch) => ({ value: String(branch.id), label: `${branch.customerName} · ${branch.name} (${branch.code})` }));
    if (field.name === 'assetId') return assets.map((asset) => ({ value: String(asset.id), label: `${asset.name} · ${asset.code} · ${asset.branchName}` }));
    return field.options || [];
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const body: Record<string, unknown> = { ...form };
      for (const key of ['customerId', 'branchId', 'assetId']) if (body[key] === '') body[key] = null; else if (body[key]) body[key] = Number(body[key]);
      if (kind === 'service-requests' && !body.assetId) body.assetId = null;
      await api(editingId ? `/${kind}/${editingId}` : `/${kind}`, { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setModal(null); setMessage(`${config.singular} ${editingId ? 'updated' : 'saved'}.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Record could not be saved.'); }
    finally { setSaving(false); }
  }

  async function convertRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedRequest) return;
    setSaving(true); setError('');
    try {
      await api(`/service-requests/${selectedRequest.id}/work-order`, { method: 'POST', body: JSON.stringify({
        technicianId: conversion.technicianId ? Number(conversion.technicianId) : null,
        scheduledStart: conversion.scheduledStart ? new Date(conversion.scheduledStart).toISOString().slice(0, 19) : null,
      }) });
      setModal(null); setMessage('Work order created from the service request.'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Work order could not be created.'); }
    finally { setSaving(false); }
  }

  function changeSort(column: Column) {
    if (!column.sortable) return;
    if (sortKey === column.key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else { setSortKey(column.key); setSortDirection('asc'); }
  }

  return (
    <div className="page-stack">
      <div className="page-heading"><div><p className="eyebrow">SERVICE OPERATIONS</p><h1>{config.title}</h1><p className="page-subtitle">{config.description}</p></div>{canEdit && <button className="button button-primary" onClick={openCreate}><Plus size={16} />{kind === 'service-requests' ? 'New complaint' : `Add ${config.singular.toLowerCase()}`}</button>}</div>
      {message && <div className="success-banner">{message}<button className="text-button" onClick={() => setMessage('')} aria-label="Dismiss message"><X size={15} /></button></div>}
      {error && !modal && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Retry</button></div>}
      <section className="panel records-panel">
        <div className="records-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => { setPage(0); setSearch(event.target.value); }} placeholder={`Search ${config.title.toLowerCase()}…`} aria-label={`Search ${config.title}`} /></label>
          {kind === 'service-requests' && <select className="toolbar-select" value={statusFilter} onChange={(event) => { setPage(0); setStatusFilter(event.target.value); }} aria-label="Filter by status"><option value="">All statuses</option>{['New', 'Under review', 'Approved', 'Converted to work order', 'On hold', 'Closed'].map((value) => <option key={value}>{value}</option>)}</select>}
          <span className="result-count">{result.total.toLocaleString()} records</span>
        </div>
        <div className="table-scroll"><table className="data-table"><thead><tr>{config.columns.map((column) => <th key={column.key}><button className={`sort-button ${column.sortable ? '' : 'sort-static'}`} onClick={() => changeSort(column)}>{column.label}{sortKey === column.key ? sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : null}</button></th>)}{kind === 'service-requests' ? <th>Action</th> : null}</tr></thead>
          <tbody>{loading ? <tr><td className="table-message" colSpan={config.columns.length + 1}>Loading {config.title.toLowerCase()}…</td></tr> : rows.length === 0 ? <tr><td className="table-message" colSpan={config.columns.length + 1}><strong>{search ? 'No matching records' : `No ${config.title.toLowerCase()} yet`}</strong><span>{search ? 'Try another search.' : 'Add a record to start building your service workspace.'}</span></td></tr> : rows.map((row) => <tr key={row.id}>{config.columns.map((column) => <td key={column.key}>{renderCell(row[column.key], column.key)}</td>)}<td>{kind === 'service-requests' ? canEdit && <button className="button button-small button-outline" disabled={String(row.status) === 'Converted to work order'} onClick={() => openConvert(row as unknown as ServiceRequest)}>{String(row.status) === 'Converted to work order' ? 'Converted' : 'Create work order'}</button> : canEdit && <button className="icon-button compact" title={`Edit ${config.singular.toLowerCase()}`} aria-label={`Edit ${config.singular.toLowerCase()}`} onClick={() => openEdit(row)}><Pencil size={15} /></button>}</td></tr>)}</tbody>
        </table></div>
        <div className="table-footer"><span>Showing {result.total === 0 ? 0 : page * result.size + 1}–{Math.min((page + 1) * result.size, result.total)} of {result.total}</span><div className="pagination"><button aria-label="Previous page" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(value - 1, 0))}><ChevronLeft size={17} /></button><span>Page {page + 1} of {Math.max(1, Math.ceil(result.total / result.size))}</span><button aria-label="Next page" disabled={(page + 1) * result.size >= result.total || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
      </section>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModal(null); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="record-modal-title"><div className="modal-heading"><div><p className="eyebrow">SERVICEPRO RECORD</p><h2 id="record-modal-title">{modal === 'convert' ? 'Create work order' : `${editingId ? 'Edit' : 'Add'} ${config.singular.toLowerCase()}`}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={19} /></button></div>
        {modal === 'convert' ? <form onSubmit={convertRequest} className="record-form"><div className="form-context"><strong>{selectedRequest?.requestNumber} · {selectedRequest?.summary}</strong><span>{selectedRequest?.customerName} · {selectedRequest?.branchName}</span></div><label>Assign technician<select value={conversion.technicianId} onChange={(event) => setConversion({ ...conversion, technicianId: event.target.value })}><option value="">Leave unassigned</option>{technicians.map((tech) => <option value={tech.id} key={tech.id}>{tech.name} · {tech.employeeCode}</option>)}</select></label><label>Appointment date and time<input type="datetime-local" value={conversion.scheduledStart} onChange={(event) => setConversion({ ...conversion, scheduledStart: event.target.value })} /></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Creating…' : 'Create work order'}</button></div></form> : <form onSubmit={submit} className="record-form"><div className="form-grid">{config.fields.map((field) => <FieldControl key={field.name} field={field} value={form[field.name]} options={optionsFor(field)} onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))} />)}</div>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save record'}</button></div></form>}
      </section></div>}
    </div>
  );
}

function FieldControl({ field, value, options, onChange }: { field: Field; value: string | boolean | undefined; options: Array<{ value: string; label: string }>; onChange: (value: string | boolean) => void }) {
  if (field.type === 'checkbox') return <label className="checkbox-field"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>;
  if (field.type === 'select') return <label>{field.label}{field.required && <span className="required-mark"> *</span>}<select required={field.required} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}><option value="">Choose…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if (field.type === 'textarea') return <label className="form-span-two">{field.label}{field.required && <span className="required-mark"> *</span>}<textarea required={field.required} rows={3} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>;
  return <label>{field.label}{field.required && <span className="required-mark"> *</span>}<input type={field.type || 'text'} required={field.required} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>;
}

function renderCell(value: unknown, key: string) {
  if (key === 'active' || key === 'status' || key === 'conditionStatus') return <StatusBadge value={typeof value === 'boolean' ? value ? 'Active' : 'Inactive' : String(value ?? '')} />;
  if (key === 'createdAt' && value) return <span className="date-cell">{new Date(String(value)).toLocaleDateString()}</span>;
  return value == null || value === '' ? <span className="muted">—</span> : String(value);
}
