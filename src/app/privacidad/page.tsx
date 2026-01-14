import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad | BUND · Studio',
  description: 'Política de privacidad de BUND Studio',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="mb-8">
          <Link 
            href="/" 
            className="text-primary hover:underline text-sm mb-4 inline-block"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-4xl font-bold mb-4">Política de Privacidad</h1>
          <p className="text-muted-foreground">Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Información que Recopilamos</h2>
            <p className="text-muted-foreground mb-4">
              BUND Studio recopila información necesaria para proporcionar nuestros servicios de análisis y gestión de datos de marketing. 
              Esta información incluye:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Datos de autenticación y acceso a cuentas de servicios integrados (Google Analytics, Shopify, Meta Ads)</li>
              <li>Datos de análisis y métricas de rendimiento de marketing</li>
              <li>Información de citas y reservas</li>
              <li>Datos de ventas y transacciones</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Uso de la Información</h2>
            <p className="text-muted-foreground mb-4">
              Utilizamos la información recopilada para:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Proporcionar servicios de análisis y visualización de datos</li>
              <li>Mejorar nuestros servicios y funcionalidades</li>
              <li>Generar reportes y métricas de rendimiento</li>
              <li>Gestionar integraciones con servicios de terceros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Almacenamiento y Seguridad</h2>
            <p className="text-muted-foreground">
              Todos los datos se almacenan de forma segura utilizando servicios de infraestructura en la nube con altos estándares de seguridad. 
              Implementamos medidas técnicas y organizativas apropiadas para proteger sus datos contra acceso no autorizado, alteración, 
              divulgación o destrucción.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Compartir Información</h2>
            <p className="text-muted-foreground">
              No vendemos, alquilamos ni compartimos su información personal con terceros, excepto cuando sea necesario para proporcionar 
              nuestros servicios o cuando la ley lo requiera. Solo compartimos datos con servicios integrados autorizados (Google Analytics, 
              Shopify, Meta Ads) mediante conexiones OAuth seguras.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Sus Derechos</h2>
            <p className="text-muted-foreground mb-4">
              Usted tiene derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Acceder a sus datos personales</li>
              <li>Rectificar datos inexactos</li>
              <li>Solicitar la eliminación de sus datos</li>
              <li>Revocar el consentimiento para el procesamiento de datos</li>
              <li>Desconectar integraciones en cualquier momento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Cookies y Tecnologías Similares</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies y tecnologías similares para mantener sesiones de usuario, autenticación y mejorar la experiencia del servicio. 
              Puede gestionar las preferencias de cookies a través de la configuración de su navegador.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Cambios a esta Política</h2>
            <p className="text-muted-foreground">
              Nos reservamos el derecho de actualizar esta política de privacidad ocasionalmente. Le notificaremos cualquier cambio 
              significativo publicando la nueva política en esta página y actualizando la fecha de "Última actualización".
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Contacto</h2>
            <p className="text-muted-foreground">
              Si tiene preguntas sobre esta política de privacidad o sobre cómo manejamos sus datos, puede contactarnos a través de 
              la página de integraciones de la aplicación o mediante el correo electrónico asociado a su cuenta.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t">
          <Link 
            href="/" 
            className="text-primary hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
