import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export function HealthPage() {
  const [status, setStatus] = useState<string>('Checking...');
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setStatus(data.status ?? 'UP');
          setTimestamp(new Date(data.timestamp).toISOString());
        } else {
          setStatus('Unavailable');
        }
      })
      .catch(() => {
        setStatus('Unavailable');
      });
  }, []);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Backend Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-slate-600">API endpoint:</p>
        <p className="font-mono text-sm text-slate-900">{API_BASE_URL}/health</p>
        <p className="mt-4 text-lg font-semibold text-slate-900">Status: {status}</p>
        {timestamp ? <p className="text-sm text-slate-600">Last check: {timestamp}</p> : null}
      </CardContent>
    </Card>
  );
}
