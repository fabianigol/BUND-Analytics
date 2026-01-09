'use client'

/**
 * AnimatedCard - Card con animaciones sutiles
 * Mejora la experiencia visual con transiciones suaves
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends React.ComponentProps<typeof Card> {
  delay?: number;
  hoverEffect?: boolean;
  slideFrom?: 'left' | 'right' | 'top' | 'bottom' | 'none';
}

export function AnimatedCard({
  children,
  className,
  delay = 0,
  hoverEffect = true,
  slideFrom = 'bottom',
  ...props
}: AnimatedCardProps) {
  // Animaciones de entrada según dirección
  const slideAnimations = {
    left: 'animate-in slide-in-from-left-4',
    right: 'animate-in slide-in-from-right-4',
    top: 'animate-in slide-in-from-top-4',
    bottom: 'animate-in slide-in-from-bottom-4',
    none: 'animate-in fade-in',
  };
  
  const slideAnimation = slideAnimations[slideFrom];
  
  return (
    <Card
      className={cn(
        slideAnimation,
        'duration-500',
        hoverEffect && 'transition-all hover:shadow-lg hover:scale-[1.02]',
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
      {...props}
    >
      {children}
    </Card>
  );
}

/**
 * FadeIn - Wrapper para animaciones de fade in
 */
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 300, className }: FadeInProps) {
  return (
    <div
      className={cn('animate-in fade-in', className)}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {children}
    </div>
  );
}

/**
 * SlideIn - Wrapper para animaciones de slide in
 */
interface SlideInProps {
  children: React.ReactNode;
  from?: 'left' | 'right' | 'top' | 'bottom';
  delay?: number;
  duration?: number;
  className?: string;
}

export function SlideIn({ 
  children, 
  from = 'bottom', 
  delay = 0, 
  duration = 500,
  className,
}: SlideInProps) {
  const animations = {
    left: 'animate-in slide-in-from-left-4',
    right: 'animate-in slide-in-from-right-4',
    top: 'animate-in slide-in-from-top-4',
    bottom: 'animate-in slide-in-from-bottom-4',
  };
  
  return (
    <div
      className={cn(animations[from], className)}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Stagger - Container para efectos stagger en múltiples elementos
 */
interface StaggerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function Stagger({ children, staggerDelay = 50, className }: StaggerProps) {
  const childrenArray = React.Children.toArray(children);
  
  return (
    <div className={className}>
      {childrenArray.map((child, index) => (
        <FadeIn key={index} delay={index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}
