export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div 
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-8 md:justify-end md:px-8 md:py-12"
      style={{
        backgroundImage: 'url(/312a39fd8e869a7520cfa7c0f74b9c0d72798a03dc398bae640484142010e0cb.png)'
      }}
    >
      {/* Eslogan en la parte inferior izquierda - oculto en móviles */}
      <div className="absolute bottom-8 left-8 z-10 hidden md:block lg:bottom-12 lg:left-12">
        <p className="text-2xl font-sans font-semibold text-white leading-tight lg:text-4xl">
          <span className="italic"></span>
        </p>
      </div>
      
      {/* Contenedor del formulario */}
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl">
        {children}
      </div>
    </div>
  )
}

