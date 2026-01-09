'use client'

/**
 * SkeletonLoader - Loaders skeleton para mejor UX durante carga
 */

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Skeleton base animado
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

/**
 * Skeleton para Card con header
 */
export function SkeletonCard({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para gráfica
 */
export function SkeletonChart({ height = 350 }: { height?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/4 mb-2" />
        <Skeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para tabla
 */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, idx) => (
              <Skeleton key={idx} className="h-4 flex-1" />
            ))}
          </div>
          
          {/* Data rows */}
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <Skeleton key={colIdx} className="h-8 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para KPI cards
 */
export function SkeletonKPI() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Card key={idx}>
          <CardContent className="pt-6">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton para badges
 */
export function SkeletonBadges({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} className="h-7 w-32" />
      ))}
    </div>
  );
}

/**
 * Skeleton completo para vista de patrones
 */
export function SkeletonPatternsView() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/4 mb-3" />
          <Skeleton className="h-4 w-1/2 mb-4" />
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-7 w-32" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-9 w-16" />
            ))}
          </div>
        </CardHeader>
      </Card>
      
      {/* Insights skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent>
          <SkeletonBadges count={6} />
        </CardContent>
      </Card>
      
      {/* Charts skeleton */}
      <SkeletonChart height={400} />
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <SkeletonChart height={350} />
        <SkeletonChart height={350} />
      </div>
      
      {/* Table skeleton */}
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
