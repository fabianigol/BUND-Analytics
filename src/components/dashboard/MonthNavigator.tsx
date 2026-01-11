'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface MonthNavigatorProps {
  selectedMonth: Date
  onMonthChange: (date: Date) => void
}

const months = [
  { value: 0, label: 'Ene' },
  { value: 1, label: 'Feb' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Abr' },
  { value: 4, label: 'May' },
  { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' },
  { value: 7, label: 'Ago' },
  { value: 8, label: 'Sep' },
  { value: 9, label: 'Oct' },
  { value: 10, label: 'Nov' },
  { value: 11, label: 'Dic' },
]

export function MonthNavigator({ selectedMonth, onMonthChange }: MonthNavigatorProps) {
  const currentYear = selectedMonth.getFullYear()
  const currentMonthIndex = selectedMonth.getMonth()

  // Generar lista de años (desde 2020 hasta 2030)
  const years = Array.from({ length: 11 }, (_, i) => 2020 + i)

  const handleYearChange = (year: string) => {
    const newDate = new Date(selectedMonth)
    newDate.setFullYear(parseInt(year))
    onMonthChange(newDate)
  }

  const handleMonthClick = (monthIndex: number) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(monthIndex)
    onMonthChange(newDate)
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Selector de año */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Año:</span>
            <Select value={currentYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Separador vertical */}
          <div className="h-8 w-px bg-border" />

          {/* Botones de meses */}
          <div className="flex items-center gap-1 flex-wrap">
            {months.map((month) => (
              <Button
                key={month.value}
                variant={currentMonthIndex === month.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMonthClick(month.value)}
                className="h-8 px-3 text-xs"
              >
                {month.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
