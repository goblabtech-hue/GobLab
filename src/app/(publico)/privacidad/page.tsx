import { obtenerConfiguracion } from '@/infrastructure/config'
import { Alerta } from '@/components/ui/alerta'

export const metadata = {
  title: 'Aviso de privacidad',
  description: 'Qué datos recabamos al levantar un reporte, para qué los usamos y qué derechos tienes.',
}

/**
 * Aviso de privacidad (SPEC §7).
 *
 * PENDIENTE: el texto describe con exactitud lo que el sistema hace hoy con los
 * datos, pero un aviso de privacidad es un documento legal. Debe revisarlo el
 * área jurídica del municipio y completar los datos del responsable y de la
 * Unidad de Transparencia antes de publicarlo. Ver PENDIENTES.md.
 */
export default async function Privacidad() {
  const municipio = await obtenerConfiguracion()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Aviso de privacidad</h1>
      <p className="mt-2 text-tinta-suave">
        Qué datos te pedimos, para qué los usamos y qué puedes hacer al respecto.
      </p>

      <Alerta tipo="aviso" titulo="Borrador pendiente de revisión jurídica" className="mt-5">
        Este texto describe con exactitud lo que el sistema hace hoy con tus
        datos, pero todavía no lo revisa el área jurídica del municipio ni
        incluye los datos del responsable ni de la Unidad de Transparencia.
      </Alerta>

      <div className="mt-6 space-y-6 text-pretty [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1.5 [&_p]:text-tinta-suave [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-tinta-suave">
        <section>
          <h2>Quién trata tus datos</h2>
          <p>
            El municipio de {municipio.nombre}, a través de su área de
            atención ciudadana, es responsable del tratamiento de los datos
            personales que nos proporcionas al levantar un reporte.
          </p>
        </section>

        <section>
          <h2>Qué datos recabamos</h2>
          <ul>
            <li><strong>Tu teléfono</strong>, si decides dejarlo. Es opcional.</li>
            <li><strong>Tu nombre</strong>, si decides dejarlo. También es opcional.</li>
            <li><strong>La descripción y la ubicación</strong> del problema que reportas.</li>
            <li><strong>Las fotos</strong> que subas.</li>
          </ul>
          <p>
            Puedes levantar un reporte sin dar teléfono ni nombre. Si no dejas
            teléfono, no podremos avisarte cuando se resuelva ni pedirte que
            califiques la atención.
          </p>
        </section>

        <section>
          <h2>Para qué los usamos</h2>
          <ul>
            <li>Atender tu reporte y turnarlo al área que corresponde.</li>
            <li>Avisarte cuando cambie de estado o quede resuelto.</li>
            <li>Pedirte que califiques la atención al cierre.</li>
            <li>Medir cuánto tardamos y publicar esas cifras en el tablero público.</li>
          </ul>
        </section>

        <section>
          <h2>Cómo protegemos tu teléfono</h2>
          <p>
            Tu número se guarda cifrado. Dentro del sistema, el personal ve
            solamente una versión enmascarada (por ejemplo{' '}
            <code className="rounded bg-lienzo px-1 py-0.5 text-sm">55••••1212</code>);
            para ver el número completo hace falta un perfil autorizado, y cada
            consulta queda registrada con el nombre de quien la hizo.
          </p>
        </section>

        <section>
          <h2>Qué publicamos y qué no</h2>
          <p>
            El tablero público y los datos abiertos <strong>nunca</strong> incluyen
            tu teléfono ni tu nombre. Tampoco publicamos la descripción que
            escribiste ni la dirección exacta, porque son textos libres donde
            pueden aparecer datos de otras personas. Las coordenadas se publican
            redondeadas a unos once metros.
          </p>
          <p>
            Las fotos solo aparecen en la galería de antes y después si una
            persona del municipio las revisó y autorizó.
          </p>
        </section>

        <section>
          <h2>Tus derechos</h2>
          <p>
            Puedes solicitar el acceso, la rectificación, la cancelación o la
            oposición al tratamiento de tus datos personales, así como revocar el
            consentimiento que nos diste. La solicitud se presenta ante la Unidad
            de Transparencia del municipio.
          </p>
        </section>

        <section>
          <h2>Cambios a este aviso</h2>
          <p>
            Cualquier modificación se publicará en esta misma página.
          </p>
        </section>
      </div>
    </div>
  )
}
