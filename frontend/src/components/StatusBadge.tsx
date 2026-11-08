const statusTone: Record<string, string> = {
  Active: 'green', Completed: 'green', Approved: 'green', Assigned: 'blue', 'In progress': 'blue',
  'In Progress': 'blue', 'Completion submitted': 'amber', Pending: 'amber', 'Pending manager approval': 'amber', New: 'amber',
  Overdue: 'red', Declined: 'red', Cancelled: 'gray', Inactive: 'gray', Open: 'gray',
};

export function StatusBadge({ value }: { value?: string | null }) {
  const label = value || 'Not set';
  return <span className={`status-badge status-${statusTone[label] || 'gray'}`}><i />{label}</span>;
}
