'use client'

import Link from 'next/link'
import { 
  LayoutDashboard, 
  Calendar, 
  ShoppingCart, 
  Megaphone, 
  BarChart3, 
  FileText,
  Settings,
  LogOut,
  TrendingUp,
  Users,
  DollarSign,
  Target
} from 'lucide-react'

const metrics = [
  { title: 'Ingresos Totales', value: '€45,678', change: '+8.3%', icon: DollarSign, color: 'bg-emerald-500' },
  { title: 'Citas del Mes', value: '156', change: '+12.5%', icon: Calendar, color: 'bg-blue-500' },
  { title: 'ROAS General', value: '3.24x', change: '+4.5%', icon: Target, color: 'bg-purple-500' },
  { title: 'Sesiones Web', value: '23.4K', change: '+9.8%', icon: Users, color: 'bg-amber-500' },
]

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, active: true },
  { name: 'Citas', href: '/citas', icon: Calendar },
  { name: 'Ventas', href: '/ventas', icon: ShoppingCart },
  { name: 'Paid Media', href: '/ads', icon: Megaphone },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Reportes', href: '/reportes', icon: FileText },
]

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#1E3A5F] flex items-center justify-center">
              <span className="text-xl font-bold text-white">B</span>
            </div>
            <span className="text-xl font-semibold text-slate-900">BUND</span>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4 px-3">
            Principal
          </p>
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    item.active
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4 px-3 mt-8">
            Configuración
          </p>
          <ul className="space-y-1">
            <li>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Settings className="h-5 w-5" />
                Ajustes
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <Link
            href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-500">Vista general del rendimiento de marketing</p>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                Sincronizar
              </button>
              <div className="h-10 w-10 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white font-medium">
                JF
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metrics.map((metric) => (
              <div key={metric.title} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{metric.title}</p>
                    <p className="text-2xl font-semibold text-slate-900">{metric.value}</p>
                    <p className="text-sm text-emerald-600 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {metric.change}
                    </p>
                  </div>
                  <div className={`${metric.color} p-3 rounded-xl`}>
                    <metric.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts placeholder */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Ingresos - Últimos 30 días</h3>
              <div className="h-64 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Gráfico de ingresos</p>
                  <p className="text-sm">Conecta las APIs para ver datos reales</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Rendimiento de Campañas</h3>
              <div className="h-64 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Gráfico de campañas</p>
                  <p className="text-sm">Conecta Meta Ads para ver datos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

