'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface ClubHeroProps {
  storeName: string
  slug: string
}

export function ClubHero({ storeName, slug }: ClubHeroProps) {
  const [imgError, setImgError] = useState(false)
  
  // Mapeo de slugs a nombres de archivo reales (maneja inconsistencias de nombres)
  // Solo incluir imágenes que realmente existen
  const getImagePath = (storeSlug: string): string => {
    const imageMap: Record<string, string> = {
      'zaragoza': 'ZARAGOZA.jpg',
      'malaga': 'MALAGA.jpg',
      'madrid': 'madrid.jpg',
      'barcelona': 'barcelona.jpg',
      'bilbao': 'bilbao.jpg',
      'murcia': 'murcia.jpg',
      'sevilla': 'sevilla.jpg',
      'cdmx': 'mexico.jpg',
      // valencia no tiene imagen aún, usar placeholder automático
    }
    
    const mappedName = imageMap[storeSlug.toLowerCase()]
    if (mappedName) {
      return `/clubs/${mappedName}`
    }
    
    // Fallback: intentar con el slug tal cual (minúsculas)
    // Si no existe, el componente mostrará placeholder automáticamente
    return `/clubs/${storeSlug.toLowerCase()}.jpg`
  }

  const imagePath = getImagePath(slug)

  // Placeholder SVG cuando no hay imagen
  const placeholderSvg = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <rect fill="#e5e7eb" width="1600" height="900"/>
      <text fill="#9ca3af" font-family="sans-serif" font-size="48" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${storeName}</text>
    </svg>
  `)}`

  // Función para manejar error al cargar imagen
  const handleImageError = () => {
    setImgError(true)
  }

  return (
    <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
      {!imgError ? (
        <Image
          src={imagePath}
          alt={storeName}
          fill
          className="object-cover"
          onError={handleImageError}
          unoptimized
        />
      ) : (
        <img
          src={placeholderSvg}
          alt={storeName}
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white">{storeName}</h1>
      </div>
    </div>
  )
}

