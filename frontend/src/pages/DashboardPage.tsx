import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Landmark, MapPin, PackageSearch, Wrench } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type DashboardData, type Technician } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

const emptyDashboard: DashboardData = {
  customers: 0, branches: 0, assets: 0, activeAmcs: 0, newRequests: 0,
  inProgress: 0, completedWorkOrders: 0, upcomingMaintenance: 0, recentWorkOrders: [], upcomingCycles: [],
};

export function DashboardPage({ roles }: { roles: string[] }) {
  const navigate = useNavigate();
  const canManageService = roles.some((role) => ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER'].includes(role));
  const [data, setData] = useState<DashboardData | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashboard, roster] = await Promise.all([
        api<DashboardData>('/dashboard'),
        canManageService ? api<{ items: Technician[] }>('/technicians?page=0&size=100') : Promise.resolve({ items: [] as Technician[] }),
      ]);
      setData(dashboard);
      setTechnicians(roster.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = data || emptyDashboard;
  const activeTechnicians = technicians.filter((technician) => technician.status === 'Active').length;
  const workTotal = stats.inProgress + stats.completedWorkOrders;
  const openRatio = workTotal ? Math.round((stats.inProgress / workTotal) * 100) : 0;

  return (
    <div className="page-stack">
      <div className="page-heading dashboard-heading">
        <div><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>Good morning</h1><p className="page-subtitle">Here’s the current picture across your service operation.</p></div>
        <div className="heading-actions"><span className="date-chip"><CalendarDays size={16} />{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span><button className="button button-primary" onClick={() => navigate('/requests')}><ClipboardList size={16} />New service request</button></div>
      </div>

      {error && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Retry</button></div>}

      <section className="metric-grid" aria-label="Operational metrics">
        <Metric title="Bank customers" value={stats.customers} icon={<Landmark />} hint="Customer accounts" href="/customers" color="blue" loading={loading} />
        <Metric title="Branches" value={stats.branches} icon={<MapPin />} hint="Registered locations" href="/branches" color="green" loading={loading} />
        <Metric title="Customer assets" value={stats.assets} icon={<PackageSearch />} hint="Equipment under service" href="/assets" color="orange" loading={loading} />
        <Metric title="Active AMC contracts" value={stats.activeAmcs} icon={<CheckCircle2 />} hint="Within contract dates" href="/amcs" color="purple" loading={loading} />
        <Metric title="New complaints" value={stats.newRequests} icon={<Activity />} hint="Awaiting review" href="/requests" color="red" loading={loading} />
        <Metric title="Work orders in progress" value={stats.inProgress} icon={<Wrench />} hint="Active field work" href="/work-orders" color="navy" loading={loading} />
        <Metric title="Completed work orders" value={stats.completedWorkOrders} icon={<CheckCircle2 />} hint="Approved completion" href="/work-orders" color="green" loading={loading} />
        <Metric title="Upcoming maintenance" value={stats.upcomingMaintenance} icon={<CalendarDays />} hint="Current and future cycles" href="/amcs" color="orange" loading={loading} />
      </section>

      <section className="dashboard-grid">
        <div className="panel work-panel">
          <div className="panel-heading"><div><h2>Recent work orders</h2><p>Latest activity recorded in ServicePro</p></div><Link className="panel-link" to="/work-orders">View all <ArrowRight size={15} /></Link></div>
          {loading ? <div className="loading-inline">Loading work orders…</div> : stats.recentWorkOrders.length === 0 ? <EmptyState title="No work orders yet" message="Convert a saved service request to start the work-order workflow." href="/requests" link="View service requests" /> : (
            <div className="table-scroll"><table className="data-table"><thead><tr><th>Work order</th><th>Bank / branch</th><th>Service summary</th><th>Technician</th><th>Status</th></tr></thead><tbody>
              {stats.recentWorkOrders.map((order) => <tr key={order.id}><td><Link className="table-primary-link" to="/work-orders">{order.workOrderNumber}</Link><small>{new Date(order.createdAt).toLocaleDateString()}</small></td><td><strong>{order.customerName}</strong><small>{order.branchName}</small></td><td className="truncate-cell">{order.summary}</td><td>{order.technicianName || <span className="muted">Unassigned</span>}</td><td><StatusBadge value={order.status} /></td></tr>)}
            </tbody></table></div>
          )}
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading"><div><h2>Work order status</h2><p>Saved work-order totals</p></div><span className="panel-icon"><Activity size={18} /></span></div>
          {loading ? <div className="loading-inline">Loading status…</div> : workTotal === 0 ? <EmptyState title="No status data" message="Status distribution appears as work orders are recorded." /> : (
            <div className="chart-content"><div className="chart-total"><strong>{workTotal}</strong><span>in-progress and completed</span></div><div className="bar-chart" role="img" aria-label={`${stats.inProgress} in progress and ${stats.completedWorkOrders} completed work orders`}><div className="bar-column"><div className="bar-track"><div className="bar-fill bar-open" style={{ height: `${Math.max(openRatio, 7)}%` }} /></div><strong>{stats.inProgress}</strong><span>In progress</span></div><div className="bar-column"><div className="bar-track"><div className="bar-fill bar-complete" style={{ height: `${Math.max(100 - openRatio, 7)}%` }} /></div><strong>{stats.completedWorkOrders}</strong><span>Completed</span></div></div></div>
          )}
        </div>

        <div className="panel schedule-panel">
          <div className="panel-heading"><div><h2>Monthly service schedule</h2><p>Upcoming AMC asset cycles</p></div><Link className="panel-link" to="/amcs">Manage AMC <ArrowRight size={15} /></Link></div>
          {loading ? <div className="loading-inline">Loading maintenance…</div> : stats.upcomingCycles.length === 0 ? <EmptyState title="No service cycles scheduled" message="Create a cycle from an active monthly AMC contract." href="/amcs" link="Open AMC contracts" /> : <div className="schedule-list">{stats.upcomingCycles.map((cycle) => <div className="schedule-row" key={cycle.id}><span className="schedule-date"><strong>{String(cycle.serviceMonth).padStart(2, '0')}</strong><small>{cycle.serviceYear}</small></span><div className="schedule-detail"><strong>{cycle.assetName}</strong><span>{cycle.customerName} · {cycle.branchName}</span></div><StatusBadge value={cycle.status} /></div>)}</div>}
        </div>

        {canManageService && <div className="panel team-panel">
          <div className="panel-heading"><div><h2>Technician roster</h2><p>{activeTechnicians} active of {technicians.length} registered</p></div><Link className="panel-link" to="/technicians">Manage team <ArrowRight size={15} /></Link></div>
          {loading ? <div className="loading-inline">Loading roster…</div> : technicians.length === 0 ? <EmptyState title="No technicians registered" message="Add team members to assign work orders." href="/technicians" link="Add a technician" /> : <div className="roster-list">{technicians.slice(0, 5).map((tech) => <div className="roster-row" key={tech.id}><span className="avatar-initials">{tech.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><strong>{tech.name}</strong><small>{tech.employeeCode}</small></div><StatusBadge value={tech.status} /></div>)}</div>}
        </div>}
      </section>
    </div>
  );
}

function Metric({ title, value, icon, hint, href, color, loading }: { title: string; value: number; icon: React.ReactNode; hint: string; href: string; color: string; loading: boolean }) {
  return <Link className={`metric-card metric-${color}`} to={href}><span className="metric-icon">{icon}</span><span className="metric-copy"><span className="metric-title">{title}</span><strong>{loading ? '—' : value.toLocaleString()}</strong><small>{hint}</small></span><ArrowRight className="metric-arrow" size={16} /></Link>;
}

function EmptyState({ title, message, href, link }: { title: string; message: string; href?: string; link?: string }) {
  return <div className="empty-state"><span className="empty-mark"><ClipboardList size={18} /></span><strong>{title}</strong><p>{message}</p>{href && link ? <Link className="text-button" to={href}>{link} <ArrowRight size={14} /></Link> : null}</div>;
}

