/**
 * Custom hook optimizado para cargar y gestionar datos de patrones
 * Incluye memoización, caching y manejo de estados
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PatternsResponse, InsightsResponse } from '@/types/patterns';

interface UsePatternsOptions {
  years: number[];
  stores: string | string[];
  enabled?: boolean;
}

interface UsePatternsReturn {
  patternsData: PatternsResponse | null;
  insightsData: InsightsResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Cache simple en memoria (se podría reemplazar con React Query o SWR)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function getCacheKey(years: number[], stores: string | string[]): string {
  const storesStr = Array.isArray(stores) ? stores.sort().join(',') : stores;
  return `patterns:${years.sort().join(',')}:${storesStr}`;
}

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
  if (isExpired) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function usePatterns({ years, stores, enabled = true }: UsePatternsOptions): UsePatternsReturn {
  const [patternsData, setPatternsData] = useState<PatternsResponse | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Crear clave de cache estable
  const cacheKey = useMemo(() => getCacheKey(years, stores), [years, stores]);
  
  const fetchData = useCallback(async () => {
    if (!enabled || years.length === 0) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Intentar obtener del cache
      const cachedPatterns = getFromCache<PatternsResponse>(`${cacheKey}:patterns`);
      const cachedInsights = getFromCache<InsightsResponse>(`${cacheKey}:insights`);
      
      if (cachedPatterns && cachedInsights) {
        setPatternsData(cachedPatterns);
        setInsightsData(cachedInsights);
        setLoading(false);
        return;
      }
      
      const storesParam = Array.isArray(stores) ? stores.join(',') : stores;
      
      // Cargar datos en paralelo
      const [patternsResponse, insightsResponse] = await Promise.all([
        fetch(`/api/citas/historical/patterns?years=${years.join(',')}&stores=${storesParam}&patternType=all`),
        fetch(`/api/citas/historical/insights?years=${years.join(',')}&stores=${storesParam}&insightTypes=all`),
      ]);
      
      if (!patternsResponse.ok || !insightsResponse.ok) {
        throw new Error('Error al cargar datos');
      }
      
      const patterns = await patternsResponse.json();
      const insights = await insightsResponse.json();
      
      // Guardar en cache
      setCache(`${cacheKey}:patterns`, patterns);
      setCache(`${cacheKey}:insights`, insights);
      
      setPatternsData(patterns);
      setInsightsData(insights);
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
      console.error('Error loading patterns:', err);
    } finally {
      setLoading(false);
    }
  }, [years, stores, enabled, cacheKey]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return {
    patternsData,
    insightsData,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook para limpiar el cache manualmente
 */
export function useClearPatternsCache() {
  return useCallback(() => {
    cache.clear();
  }, []);
}

/**
 * Hook para obtener información del cache
 */
export function usePatternsCacheInfo() {
  return useMemo(() => ({
    size: cache.size,
    keys: Array.from(cache.keys()),
  }), [cache.size]);
}
