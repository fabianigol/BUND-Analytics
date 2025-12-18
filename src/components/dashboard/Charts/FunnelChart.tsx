'use client'

import { useEffect, useRef, useState } from 'react'
// @ts-ignore - FunnelGraph.js no tiene tipos TypeScript
import FunnelGraph from 'funnel-graph-js'
import 'funnel-graph-js/dist/css/main.min.css'
import 'funnel-graph-js/dist/css/theme.min.css'

// Estilos personalizados para mejorar la leyenda
const customFunnelStyles = `
  .funnel-graph {
    font-family: inherit;
  }
  .funnel-graph__container {
    position: relative;
  }
  .funnel-graph__legend {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    margin-top: 20px !important;
    padding: 16px !important;
    background: rgba(0, 0, 0, 0.02) !important;
    border-radius: 8px !important;
  }
  .funnel-graph__legend-item {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 4px 0 !important;
  }
  .funnel-graph__legend-color {
    width: 16px !important;
    height: 16px !important;
    border-radius: 4px !important;
    flex-shrink: 0 !important;
  }
  .funnel-graph__legend-label {
    font-size: 14px !important;
    font-weight: 500 !important;
    color: #1f2937 !important;
  }
  .funnel-graph__label {
    font-size: 14px !important;
    font-weight: 600 !important;
    fill: #1f2937 !important;
  }
  .funnel-graph__percent {
    font-size: 12px !important;
    font-weight: 500 !important;
    fill: #059669 !important;
  }
`

interface FunnelData {
  labels: string[]
  subLabels?: string[]
  colors: string[] | string[][]
  values: number[] | number[][]
}

interface FunnelChartProps {
  title: string
  data: FunnelData
  direction?: 'horizontal' | 'vertical'
  displayPercent?: boolean
  height?: number
  campaignNames?: string[] // Nombres de las campañas para la leyenda personalizada
}

export function FunnelChart({
  title,
  data,
  direction = 'horizontal',
  displayPercent = true,
  height = 400,
  campaignNames = [],
}: FunnelChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const [containerId] = useState(() => `funnel-${Math.random().toString(36).substr(2, 9)}`)
  
  // Extraer colores de la primera etapa para la leyenda
  const getLegendColors = () => {
    if (!data.colors || data.colors.length === 0) return []
    if (Array.isArray(data.colors[0])) {
      // Si es un array 2D (múltiples campañas), tomar los colores de la primera etapa
      return data.colors[0] as string[]
    }
    // Si es un array 1D, devolver solo el primer color
    return [data.colors[0] as string]
  }
  
  const legendColors = getLegendColors()

  useEffect(() => {
    if (!data || !data.labels || data.labels.length === 0) return

    // Esperar a que el DOM esté completamente renderizado
    const timer = setTimeout(() => {
      const container = containerRef.current
      if (!container) {
        console.error('Container ref is null')
        return
      }

      // Limpiar gráfico anterior si existe
      if (graphRef.current) {
        try {
          container.innerHTML = ''
        } catch (e) {
          console.warn('Error clearing container:', e)
        }
        graphRef.current = null
      }

      try {
        // Asegurarse de que el contenedor tiene un ID
        if (!container.id) {
          container.id = containerId
        }

        // Verificar que el contenedor es un HTMLElement válido
        if (!(container instanceof HTMLElement)) {
          console.error('Container is not an HTMLElement')
          return
        }

        // Usar el selector del ID en lugar del elemento directamente
        const graph = new FunnelGraph({
          container: `#${containerId}`, // Usar selector string
          data: {
            labels: data.labels,
            subLabels: data.subLabels,
            colors: data.colors,
            values: data.values,
          },
          direction: direction,
          gradientDirection: 'horizontal',
          displayPercent: displayPercent,
          width: container.offsetWidth > 0 ? container.offsetWidth : 800,
          height: height,
          subLabelValue: 'percent',
        })

        graph.draw()
        graphRef.current = graph
      } catch (error) {
        console.error('Error drawing funnel chart:', error)
        console.error('Container element:', container)
        console.error('Container type:', typeof container)
        console.error('Is HTMLElement:', container instanceof HTMLElement)
      }
    }, 300)

    // Cleanup
    return () => {
      clearTimeout(timer)
      if (graphRef.current) {
        graphRef.current = null
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [data, direction, displayPercent, height, containerId])

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: customFunnelStyles }} />
      <div 
        id={containerId}
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: `${height}px`, 
          minHeight: `${height}px`,
          position: 'relative'
        }} 
      />
      {/* Leyenda personalizada */}
      {campaignNames.length > 0 && legendColors.length > 0 && (
        <div className="flex flex-wrap gap-4 justify-center pt-4 border-t">
          {campaignNames.map((name, index) => {
            const color = legendColors[index] || '#7C2D12'
            return (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium text-foreground">
                  {name}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
