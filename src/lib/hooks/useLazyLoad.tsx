/**
 * Custom hook para lazy loading de secciones
 * Carga componentes solo cuando entran en el viewport
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface UseLazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export function useLazyLoad(options: UseLazyLoadOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '100px',
    enabled = true,
  } = options;
  
  const [isVisible, setIsVisible] = useState(!enabled);
  const [hasBeenVisible, setHasBeenVisible] = useState(!enabled);
  const elementRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!enabled) return;
    
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
          } else {
            setIsVisible(false);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, [enabled, threshold, rootMargin]);
  
  return {
    ref: elementRef,
    isVisible,
    hasBeenVisible,
  };
}

/**
 * Componente wrapper para lazy loading
 */
interface LazyLoadSectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  className?: string;
}

export function LazyLoadSection({
  children,
  fallback,
  threshold,
  rootMargin,
  className,
}: LazyLoadSectionProps): React.JSX.Element {
  const { ref, hasBeenVisible } = useLazyLoad({ threshold, rootMargin });
  
  const defaultFallback = <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando...</div>;
  
  return (
    <div ref={ref} className={className}>
      {hasBeenVisible ? children : (fallback ?? defaultFallback)}
    </div>
  );
}
