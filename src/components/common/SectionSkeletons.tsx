import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="h-24 bg-muted/60 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-28 bg-muted/50 rounded-xl" />
        <div className="h-28 bg-muted/50 rounded-xl" />
        <div className="h-28 bg-muted/50 rounded-xl" />
        <div className="h-28 bg-muted/50 rounded-xl" />
      </div>
      <div className="h-64 bg-muted/40 rounded-xl" />
    </div>
  );
}

export function TeamSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="h-10 bg-muted/60 rounded-lg w-full max-w-sm" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted/60" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted/60 rounded w-3/4" />
                <div className="h-3 bg-muted/40 rounded w-1/2" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MessengerSkeleton() {
  return (
    <div className="flex h-full animate-pulse">
      <div className="w-full sm:w-80 border-r border-border p-3 space-y-3">
        <div className="h-9 bg-muted/60 rounded-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-full bg-muted/60" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 bg-muted/60 rounded w-2/3" />
              <div className="h-3 bg-muted/40 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 bg-muted/60 rounded-md w-36" />
        <div className="h-8 bg-muted/60 rounded-md w-24" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted/40 rounded-lg p-2" />
        ))}
      </div>
    </div>
  );
}
