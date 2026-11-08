import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BarChart3, Bell, Building2, CalendarDays, ChevronDown, ChevronRight, CircleHelp, ClipboardList, FileText, Home, Landmark, LogOut, Map, Menu, Package, Search, Settings, Users, Wrench, X } from 'lucide-react';
import { api, signOut, storedCredentials, type AuthResult } from '@/lib/api';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { AmcPage } from '@/pages/AmcPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { RecordsPage } from '@/pages/RecordsPage';
import { WorkOrdersPage } from '@/pages/WorkOrdersPage';

const workItems = [
  { to: '/requests', label: 'Requests', icon: ClipboardList, roles: ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER'] },
  { to: '/estimates', label: 'Estimates', icon: FileText, roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER'] },
  { to: '/work-orders', label: 'Work orders', icon: Wrench, roles: ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER', 'TECHNICIAN'] },
  { to: '/appointments', label: 'Service appointments', icon: CalendarDays, roles: ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER', 'TECHNICIAN'] },
  { to: '/service-reports', label: 'Service reports', icon: FileText, roles: ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER', 'TECHNICIAN'] },
  { to: '/scheduled-maintenance', label: 'Scheduled maintenance', icon: CalendarDays, roles: ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER'] },
];

const roleGroups = {
  service: ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER', 'TECHNICIAN'],
  finance: ['SUPER_ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR'],
  admin: ['SUPER_ADMIN'],
};

export default function App() {
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = storedCredentials();
    if (!stored) { setChecking(false); return; }
    api<{ email: string; roles: string[] }>('/auth/me')
      .then((profile) => setAuth(profile))
      .catch(() => setAuth(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const unauthorized = () => setAuth(null);
    window.addEventListener('servicepro:unauthorized', unauthorized);
    return () => window.removeEventListener('servicepro:unauthorized', unauthorized);
  }, []);

  function exit() { signOut(); setAuth(null); }

  if (checking) return <div className="app-loading"><img src="/servicepro-logo.jpeg" alt="ServicePro" /><span>Connecting to your workspace…</span></div>;
  if (!auth) return <LoginPage onSignedIn={setAuth} />;

  return <AppShell auth={auth} onSignOut={exit} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />;
}

function AppShell({ auth, onSignOut, mobileOpen, setMobileOpen }: { auth: AuthResult; onSignOut: () => void; mobileOpen: boolean; setMobileOpen: (open: boolean) => void }) {
  const location = useLocation();
  const [workExpanded, setWorkExpanded] = useState(location.pathname.startsWith('/requests') || location.pathname.startsWith('/work-orders') || ['/appointments', '/estimates', '/service-reports', '/scheduled-maintenance'].includes(location.pathname));
  const [searchOpen, setSearchOpen] = useState(false);
  const roles = auth.roles || [];
  const can = (group: keyof typeof roleGroups) => roles.some((role) => roleGroups[group].includes(role));
  const canManageService = roles.some((role) => ['SUPER_ADMIN', 'SERVICE_MANAGER', 'MANAGER'].includes(role));
  const pathTitles: Record<string, string> = {
    '/': 'Home', '/customers': 'Bank customers', '/branches': 'Branch management', '/assets': 'Customer assets',
    '/requests': 'Service requests', '/work-orders': 'Work orders', '/amcs': 'AMC contracts', '/technicians': 'Technicians',
    '/dispatch': 'Dispatch console', '/appointments': 'Service appointments', '/service-reports': 'Service reports',
    '/scheduled-maintenance': 'Scheduled maintenance', '/estimates': 'Estimates', '/billing': 'Billing',
    '/catalog': 'Catalog & pricing', '/reports': 'Reports', '/team': 'Team hub', '/settings': 'Settings',
  };

  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><img src="/servicepro-logo.jpeg" alt="ServicePro" /><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="company-switcher"><span className="company-avatar">SP</span><span><strong>ServicePro Services</strong><small>Operations workspace</small></span><ChevronDown size={15} /></div>
      <nav className="side-nav" aria-label="Main navigation">
        <NavItem to="/" label="Home" icon={<Home size={18} />} onNavigate={() => setMobileOpen(false)} />
        {(canManageService || can('finance')) && <NavItem to="/customers" label="Customers" icon={<Landmark size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {canManageService && <NavItem to="/branches" label="Branches" icon={<Building2 size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {canManageService && <NavItem to="/assets" label="Customer assets" icon={<Package size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {can('service') && <div className="nav-group">
          <button className={`nav-link nav-parent ${workExpanded ? 'nav-open' : ''}`} onClick={() => setWorkExpanded((expanded) => !expanded)} aria-expanded={workExpanded}><ClipboardList size={18} /><span>Work order management</span>{workExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
          {workExpanded && <div className="nav-children">{workItems.filter((item) => item.roles.some((role) => roles.includes(role))).map((item) => <NavItem key={item.to} to={item.to} label={item.label} icon={<item.icon size={16} />} nested onNavigate={() => setMobileOpen(false)} />)}</div>}
        </div>}
        {can('service') && <NavItem to="/dispatch" label="Dispatch console" icon={<Map size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {canManageService && <NavItem to="/amcs" label="AMC contracts" icon={<CalendarDays size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {canManageService && <NavItem to="/technicians" label="Workforce" icon={<Users size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {can('finance') && <NavItem to="/billing" label="Billing" icon={<FileText size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {can('finance') && <NavItem to="/catalog" label="Catalog & pricing" icon={<Package size={18} />} onNavigate={() => setMobileOpen(false)} />}
        {can('finance') && <NavItem to="/reports" label="Reports" icon={<BarChart3 size={18} />} onNavigate={() => setMobileOpen(false)} />}
        <NavItem to="/team" label="Team hub" icon={<Users size={18} />} onNavigate={() => setMobileOpen(false)} />
        {can('admin') && <NavItem to="/settings" label="Settings" icon={<Settings size={18} />} onNavigate={() => setMobileOpen(false)} />}
      </nav>
      <div className="sidebar-bottom"><div className="support-link"><CircleHelp size={17} /><span>Help & support</span></div><div className="sidebar-user"><span className="user-avatar">{auth.email.slice(0, 1).toUpperCase()}</span><div className="user-details"><strong>{auth.email}</strong><small>{roles.map((role) => role.replace(/_/g, ' ').toLowerCase()).join(', ')}</small></div><button className="icon-button signout-button" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></div></div>
    </aside>

    <div className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>ServicePro</span><ChevronRight size={14} /><strong>{pathTitles[location.pathname] || 'Workspace'}</strong></div></div><div className="topbar-actions">{searchOpen ? <input autoFocus className="global-search" placeholder="Search records" onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }} /> : null}<button className="icon-button topbar-tool" title="Search" onClick={() => setSearchOpen((open) => !open)}><Search size={18} /></button><button className="icon-button topbar-tool notification-button" title="Notifications are not configured"><Bell size={18} /></button><span className="topbar-divider" /><span className="topbar-avatar">{auth.email.slice(0, 1).toUpperCase()}</span></div></header>
      <main className="main-content" key={location.pathname}>
        <Routes>
          <Route path="/" element={roles.includes('TECHNICIAN') && !canManageService ? <WorkOrdersPage roles={roles} /> : <DashboardPage roles={roles} />} />
          <Route path="/customers" element={canManageService || can('finance') ? <RecordsPage kind="customers" canEdit={canManageService} /> : <ComingSoonPage title="Access restricted" detail="Bank customer records are available to service managers and authorized finance roles." />} />
          <Route path="/branches" element={canManageService ? <RecordsPage kind="branches" /> : <ComingSoonPage title="Access restricted" detail="Branch master records are available to service managers." />} />
          <Route path="/assets" element={canManageService ? <RecordsPage kind="assets" /> : <ComingSoonPage title="Access restricted" detail="Customer asset registers are available to service managers." />} />
          <Route path="/requests" element={canManageService ? <RecordsPage kind="service-requests" /> : <ComingSoonPage title="Access restricted" detail="Service request intake is available to service managers." />} />
          <Route path="/work-orders" element={<WorkOrdersPage roles={roles} />} />
          <Route path="/amcs" element={canManageService ? <AmcPage /> : <ComingSoonPage title="Access restricted" detail="AMC contract management is available to service managers." />} />
          <Route path="/technicians" element={canManageService ? <RecordsPage kind="technicians" /> : <ComingSoonPage title="Access restricted" detail="Technician profile management is available to service managers." />} />
          <Route path="/appointments" element={<AppointmentsPage roles={roles} email={auth.email} />} />
          <Route path="/service-reports" element={<ComingSoonPage title="Service reports" detail="Reports are captured in the completion workflow. A dedicated report search and attachment module is planned for a later phase." />} />
          <Route path="/scheduled-maintenance" element={<Navigate to="/amcs" replace />} />
          <Route path="/dispatch" element={<ComingSoonPage title="Field dispatch console" detail="Service assignment is available from Work Orders. Live GPS and route integrations are not configured; no delivery dispatch workflow is part of ServicePro." />} />
          <Route path="/estimates" element={<ComingSoonPage title="Estimates" detail="Quotation preparation, approvals, tax calculations and delivery require the later commercial phase." />} />
          <Route path="/billing" element={<ComingSoonPage title="Billing" detail="Invoices and accounting are not enabled. Invoice creation will require completed, approved, billable work and the accounting posting controls in the specification." />} />
          <Route path="/catalog" element={<ComingSoonPage title="Catalog & pricing" detail="Company-owned inventory and price lists are separate from customer assets and remain planned for a later phase." />} />
          <Route path="/reports" element={<ComingSoonPage title="Reports" detail="Operational dashboards use saved records. Exportable operational and financial reports are planned for later phases." />} />
          <Route path="/team" element={<ComingSoonPage title="Team hub" detail="Technician profiles and assignments are available under Workforce. User provisioning and role administration are not yet available." />} />
          <Route path="/settings" element={<ComingSoonPage title="Settings" detail="Company settings, user administration and configurable approval policies are planned. Login currently uses the configured backend administrator account." />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  </div>;
}

function NavItem({ to, label, icon, nested = false, onNavigate }: { to: string; label: string; icon: React.ReactNode; nested?: boolean; onNavigate: () => void }) {
  return <NavLink to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => `nav-link ${nested ? 'nav-child' : ''} ${isActive ? 'nav-active' : ''}`}>{icon}<span>{label}</span></NavLink>;
}

function ComingSoonPage({ title, detail }: { title: string; detail: string }) {
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">SERVICEPRO WORKSPACE</p><h1>{title}</h1><p className="page-subtitle">{detail}</p></div></div><section className="panel phase-panel"><span className="phase-mark"><Settings size={21} /></span><div><h2>Not available in this phase</h2><p>This area is intentionally not populated with sample data or unconfigured integration status.</p></div></section></div>;
}
