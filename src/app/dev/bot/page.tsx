import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hashTelefono } from '@/lib/telefono'
import { hayClasificadorIA } from '@/lib/ia/clasificador'
import { canalesActivos } from '@/lib/mensajeria'
import { municipio } from '@/lib/config'
import { Alerta } from '@/components/ui/alerta'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { SimuladorChat } from './chat'

export const metadata = { title: 'Simulador del bot' }
export const dynamic = 'force-dynamic'

const CHAT_DEMO = '5555000001'

/**
 * Simulador de conversación (SPEC §4.1): permite probar el flujo completo del
 * bot sin credenciales de Meta ni de Telegram.
 *
 * Solo en desarrollo: crea reportes reales sin verificar a nadie.
 */
export default async function PaginaSimulador({ searchParams }: PageProps<'/dev/bot'>) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { chat } = await searchParams
  const chatId = (typeof chat === 'string' && chat.trim()) || CHAT_DEMO

  const conversacion = await prisma.conversacionBot.findFirst({
    where: { canal: 'simulador', chatIdHash: hashTelefono(chatId) },
    orderBy: { updatedAt: 'desc' },
    include: { mensajes: { orderBy: { timestamp: 'asc' }, take: 100 } },
  })

  const canales = canalesActivos()
  const conIA = hayClasificadorIA()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Simulador del bot</h1>
      <p className="mt-1 text-tinta-suave">
        Prueba el flujo conversacional completo sin credenciales de WhatsApp ni
        de Telegram. Los reportes que crees aquí son reales.
      </p>

      <div className="mt-4 space-y-3">
        <Alerta tipo={conIA ? 'exito' : 'aviso'} titulo={conIA ? 'Clasificador de IA activo' : 'Sin ANTHROPIC_API_KEY: respaldo por menú'}>
          {conIA
            ? 'El bot entiende lenguaje natural y propone la categoría. Puedes escribirle como le escribirías a una persona.'
            : 'El bot funciona igual, pero en vez de adivinar la categoría te muestra el menú tradicional. Es el respaldo que exige el spec, y se prueba justo así.'}
        </Alerta>

        <Tarjeta>
          <TarjetaCuerpo className="p-3.5">
            <p className="mb-2 text-sm font-medium">Canales configurados</p>
            <ul className="flex flex-wrap gap-2">
              {canales.map((c) => (
                <li key={c.canal}>
                  <Insignia tono={c.listo ? 'verde' : 'neutro'}>
                    {c.canal}{c.listo ? '' : ` — falta ${c.falta}`}
                  </Insignia>
                </li>
              ))}
            </ul>
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      <div className="mt-5">
        <SimuladorChat
          chatId={chatId}
          mensajes={(conversacion?.mensajes ?? []).map((m) => ({
            id: m.id,
            direccion: m.direccion,
            texto: m.texto,
            hora: m.timestamp.toISOString(),
          }))}
          escalada={conversacion?.escaladaAHumano ?? false}
          telEmergencias={municipio.telEmergencias}
          centroLat={municipio.centroLat}
          centroLng={municipio.centroLng}
        />
      </div>
    </div>
  )
}
