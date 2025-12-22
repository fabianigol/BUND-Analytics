export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Lado izquierdo - Formulario */}
      <div className="flex w-full flex-col items-center justify-center bg-white p-6 md:w-1/2 md:p-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
      
      {/* Lado derecho - Imagen */}
      <div 
        className="hidden w-1/2 bg-cover bg-center bg-no-repeat md:block"
        style={{
          backgroundImage: 'url(/IMG_3258.jpg)'
        }}
      />
    </div>
  )
}

