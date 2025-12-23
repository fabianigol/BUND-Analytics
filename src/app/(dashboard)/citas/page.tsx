'use client'

import { Header } from '@/components/dashboard/Header'
import { Card, CardContent } from '@/components/ui/card'

export default function CitasPage() {
  return (
    <div className="flex flex-col">
      <Header
        title="Citas"
        subtitle="Gestión y análisis de citas"
      />

      <div className="flex-1 space-y-6 p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium text-muted-foreground">
              La integración de citas estará disponible próximamente
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos trabajando en una nueva integración para gestionar tus citas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
