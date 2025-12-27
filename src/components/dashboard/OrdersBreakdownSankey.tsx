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
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils/format'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Registrar el controlador de Sankey solo una vez
let isRegistered = false
if (typeof window !== 'undefined' && !isRegistered) {
  ChartJS.register(SankeyController, Flow, CategoryScale, LinearScale, Tooltip, Legend)
  isRegistered = true
}

interface OrdersBreakdownSankeyProps {
  totalOrders: number
  ordersOnline: number
  ordersFromMedicion: number
  ordersFromFitting: number
  ordersWithoutAppointment: number
}

export function OrdersBreakdownSankey({
  totalOrders,
  ordersOnline,
  ordersFromMedicion,
  ordersFromFitting,
  ordersWithoutAppointment,
}: OrdersBreakdownSankeyProps) {
  // Crear nodos para el Sankey
  const nodes = [
    {
      id: 'total',
      name: `Total Pedidos (${formatNumber(totalOrders)})`,
      value: totalOrders,
      level: 0,
      color: '#3b82f6', // Azul
    },
    {
      id: 'online',
      name: `Online (${formatNumber(ordersOnline)})`,
      value: ordersOnline,
      level: 1,
      color: '#8b5cf6', // Púrpura
    },
    {
      id: 'medicion',
      name: `Medición (${formatNumber(ordersFromMedicion)})`,
      value: ordersFromMedicion,
      level: 1,
      color: '#10b981', // Verde
    },
    {
      id: 'fitting',
      name: `Fitting (${formatNumber(ordersFromFitting)})`,
      value: ordersFromFitting,
      level: 1,
      color: '#f59e0b', // Naranja
    },
    {
      id: 'sin-cita',
      name: `Sin Cita (${formatNumber(ordersWithoutAppointment)})`,
      value: ordersWithoutAppointment,
      level: 1,
      color: '#6b7280', // Gris
    },
  ]

  // Crear enlaces desde Total Pedidos hacia cada categoría
  const links = [
    {
      source: 'total',
      target: 'online',
      value: ordersOnline,
      color: '#8b5cf6',
    },
    {
      source: 'total',
      target: 'medicion',
      value: ordersFromMedicion,
      color: '#10b981',
    },
    {
      source: 'total',
      target: 'fitting',
      value: ordersFromFitting,
      color: '#f59e0b',
    },
    {
      source: 'total',
      target: 'sin-cita',
      value: ordersWithoutAppointment,
      color: '#6b7280',
    },
  ].filter(link => link.value > 0) // Solo mostrar enlaces con valor > 0

  // Filtrar nodos que no tienen enlaces (valor 0)
  const activeNodes = nodes.filter(node => {
    if (node.id === 'total') return true // Siempre mostrar el nodo total
    return links.some(link => link.target === node.id)
  })

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: es })
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
    const flows: Array<{ from: string; to: string; flow: number }> = links.map((link) => {
      const sourceNode = activeNodes.find((n) => n.id === link.source)
      const targetNode = activeNodes.find((n) => n.id === link.target)
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
            label: 'Flujo de Pedidos',
            data: flows,
            colorFrom: (c: any) => {
              const flow = c.dataset.data[c.dataIndex]
              const sourceNode = activeNodes.find((n) => n.name === flow.from)
              return sourceNode?.color || '#3b82f6'
            },
            colorTo: (c: any) => {
              const flow = c.dataset.data[c.dataIndex]
              const targetNode = activeNodes.find((n) => n.name === flow.to)
              return targetNode?.color || '#3b82f6'
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
        nodeGap: 30,
        // @ts-ignore - Chart.js sankey plugin options
        nodePadding: 20,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const flow = context.raw
                const value = typeof flow.flow === 'number' ? flow.flow : Number(flow.flow) || 0
                if (value >= 1000000) {
                  return `${flow.from} → ${flow.to}: ${(value / 1000000).toFixed(1)}M`
                } else if (value >= 1000) {
                  return `${flow.from} → ${flow.to}: ${(value / 1000).toFixed(1)}k`
                }
                return `${flow.from} → ${flow.to}: ${value.toLocaleString('es-ES')}`
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
  }, [isMounted, activeNodes, links])

  if (totalOrders === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Desglose de Pedidos - {currentMonth}</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center h-[400px] p-6">
          <p className="text-sm text-muted-foreground">No hay pedidos disponibles</p>
        </div>
      </Card>
    )
  }

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Desglose de Pedidos - {currentMonth}</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center h-[400px] p-6">
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </Card>
    )
  }

  if (links.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Desglose de Pedidos - {currentMonth}</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center h-[400px] p-6">
          <p className="text-sm text-muted-foreground">No hay datos disponibles para mostrar el diagrama.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Desglose de Pedidos - {currentMonth}</CardTitle>
      </CardHeader>
      <div style={{ height: '400px', position: 'relative', padding: '1.5rem' }}>
        <canvas ref={canvasRef} />
      </div>
    </Card>
  )
}

