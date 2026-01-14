'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Ha ocurrido un error. Inténtalo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full p-6 md:p-8 lg:p-10">
      {/* Cabecera del formulario */}
      <div className="mb-6 space-y-3 md:mb-8 md:space-y-4">
        {/* Logo */}
        <div className="mb-4 flex justify-start">
          <Image
            src="/LOG.png"
            alt="Logo"
            width={150}
            height={60}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">
          Bienvenido al futuro de la moda a medida
        </h1>
        <div className="space-y-2">
          <p className="text-xs text-gray-600 md:text-sm">
            Si tienes cualquier duda escribe a Juan.{' '}
            <a 
              href="mailto:support@bundcompany.com" 
              className="text-blue-600 hover:underline"
            >
              deberiasabersuemail@bundcompany.com
            </a>
          </p>
        </div>
        
        {/* Línea separadora con OR */}
        <div className="relative my-4 md:my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">O</span>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleLogin} className="space-y-6">
        {error && (
          <div className="rounded-none bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700">
            Tu email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-none border-gray-300 bg-gray-50 focus:border-gray-400 focus:ring-gray-400"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-gray-700">
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-none border-gray-300 bg-gray-50 focus:border-gray-400 focus:ring-gray-400"
            required
          />
        </div>

        {/* Botón de envío */}
        <Button
          type="submit"
          className="h-12 w-full rounded-none bg-black text-white hover:bg-gray-800 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            'Iniciar sesión'
          )}
        </Button>

        <p className="text-center text-sm text-gray-500">
          ¿Problemas para acceder?{' '}
          <a 
            href="mailto:supporte@bundcompany.com" 
            className="text-blue-600 hover:underline"
          >
            Contacta con Juan
          </a>
        </p>
        
        <p className="text-center text-xs text-gray-400 mt-4">
          <a 
            href="/privacidad" 
            className="hover:text-gray-600 hover:underline"
          >
            Política de Privacidad
          </a>
        </p>
      </form>
    </div>
  )
}

