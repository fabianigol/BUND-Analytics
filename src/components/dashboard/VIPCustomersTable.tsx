'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatCurrencyByCountry } from '@/lib/utils/format'
import { format, parseISO } from 'date-fns'
import { Calendar, MapPin } from 'lucide-react'

interface VIPCustomer {
  email: string
  name: string
  city: string | null
  ltv: number
  currency: string
  orderCount: number
  hasNextAppointment: boolean
  nextAppointmentDate?: string
}

interface VIPCustomersTableProps {
  customers: VIPCustomer[]
  className?: string
}

export function VIPCustomersTable({ customers, className }: VIPCustomersTableProps) {
  if (customers.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base font-medium">Top 10 Clientes VIP</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No hay clientes VIP disponibles.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-medium">Top 10 Clientes VIP</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead className="text-right">LTV</TableHead>
              <TableHead className="text-center">Próxima Cita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer, index) => {
              // Determinar medalla y color para top 3
              const getMedalInfo = (position: number) => {
                if (position === 0) {
                  return { emoji: '🥇', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' }
                } else if (position === 1) {
                  return { emoji: '🥈', bgColor: 'bg-gray-200', textColor: 'text-gray-700' }
                } else if (position === 2) {
                  return { emoji: '🥉', bgColor: 'bg-orange-200', textColor: 'text-orange-700' }
                }
                return null
              }

              const medalInfo = getMedalInfo(index)

              return (
                <TableRow key={customer.email} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {medalInfo ? (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${medalInfo.bgColor} text-lg`}>
                          {medalInfo.emoji}
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{customer.name || customer.email}</p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {customer.orderCount} pedido{customer.orderCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.city ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <MapPin className="h-3 w-3 mr-1" />
                        {customer.city}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold">
                      {customer.currency === 'MXN' 
                        ? formatCurrencyByCountry(customer.ltv, 'MX')
                        : formatCurrency(customer.ltv)
                      }
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {customer.hasNextAppointment && customer.nextAppointmentDate ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(parseISO(customer.nextAppointmentDate), 'dd MMM')}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin cita</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

