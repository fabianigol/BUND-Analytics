'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { SankeyController, Flow } from 'chartjs-chart-sankey'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Registrar el controlador de Sankey solo una vez
let isRegistered = false
if (typeof window !== 'undefined' && !isRegistered) {
  ChartJS.register(SankeyController, Flow, CategoryScale, LinearScale, Tooltip, Legend)
  isRegistered = true
}

interface SankeyNode {
  id: string
  name: string
  value: number
  level: number
  color?: string
}

interface SankeyLink {
  source: string
  target: string
  value: number
  color?: string
}

interface SankeyChartProps {
  title: string
  description?: string
  nodes: SankeyNode[]
  links: SankeyLink[]
  height?: number
}

// Función para obtener el color de un nodo
function getNodeColor(nodeId: string, nodes: SankeyNode[]): string {
  const node = nodes.find((n) => n.id === nodeId)
  return node?.color || '#7C2D12'
}

export function SankeyChart({
  title,
  description,
  nodes,
  links,
  height = 500,
}: SankeyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<ChartJS<'sankey'> | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted || !canvasRef.current || links.length === 0) return

    // Asegurar que Chart.js está registrado
    if (!ChartJS.registry.getController('sankey')) {
      ChartJS.register(SankeyController, Flow, CategoryScale, LinearScale, Tooltip, Legend)
    }

    // Destruir el gráfico anterior si existe
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
    }

    // Preparar datos para Chart.js Sankey
    // El formato esperado es un array de objetos con from, to, flow
    const flows: Array<{ from: string; to: string; flow: number }> = links.map((link) => {
      // Obtener los nombres de los nodos
      const sourceNode = nodes.find((n) => n.id === link.source)
      const targetNode = nodes.find((n) => n.id === link.target)
      return {
        from: sourceNode?.name || link.source,
        to: targetNode?.name || link.target,
        flow: link.value,
      }
    })

    // Crear el gráfico
    chartInstanceRef.current = new ChartJS(canvasRef.current, {
      type: 'sankey',
      data: {
        datasets: [
          {
            label: 'Flujo de Gasto',
            data: flows,
            colorFrom: (c: any) => {
              const flow = c.dataset.data[c.dataIndex]
              const sourceNode = nodes.find((n) => n.name === flow.from)
              return sourceNode?.color || getNodeColor(flow.from, nodes)
            },
            colorTo: (c: any) => {
              const flow = c.dataset.data[c.dataIndex]
              const targetNode = nodes.find((n) => n.name === flow.to)
              return targetNode?.color || getNodeColor(flow.to, nodes)
            },
            colorMode: 'gradient',
            priority: {
              mode: 'value' as any,
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: {
          from: 'from',
          to: 'to',
          flow: 'flow',
        },
        layout: {
          padding: {
            top: 20,
            bottom: 20,
            left: 20,
            right: 20,
          },
        },
        // @ts-ignore - Chart.js sankey plugin options
        nodeGap: 30, // Espaciado entre nodos en la misma columna
        // @ts-ignore - Chart.js sankey plugin options
        nodePadding: 20, // Espaciado interno de los nodos
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const flow = context.raw
                return `${flow.from} → ${flow.to}: ${flow.flow.toLocaleString('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                })}`
              },
            },
          },
        },
      },
    })

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
      }
    }
  }, [isMounted, nodes, links, height])

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (links.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay datos disponibles para mostrar el diagrama.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ height: `${height}px`, position: 'relative' }}>
          <canvas ref={canvasRef} />
        </div>
      </CardContent>
    </Card>
  )
}

