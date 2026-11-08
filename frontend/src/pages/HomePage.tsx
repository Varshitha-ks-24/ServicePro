import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function HomePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-500">Overview</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">ServicePro Phase 1</h2>
        </div>
        <Button>Review status</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Backend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Spring Boot foundation, security baseline, health endpoint.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Frontend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Vite + React + TypeScript + Tailwind + shadcn/ui shell.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">MySQL-ready configuration with local H2 fallback for boot validation.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
