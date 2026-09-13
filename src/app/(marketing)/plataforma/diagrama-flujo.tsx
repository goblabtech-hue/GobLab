/**
 * El recorrido completo de un reporte, como diagrama de flujo.
 *
 * Es un SVG escrito a mano —no una librería— porque se dibuja una sola vez y
 * tiene que verse igual en cualquier navegador. Cada nodo numerado es un paso
 * que hace alguien; los rombos son las dos decisiones que toman personas: la
 * de recepción y la del vecino. Las líneas de vuelta son las que no aparecen
 * en una lista: lo que pasa cuando algo se rechaza o no quedó.
 */

const MARINO = '#0b1a33'
const CIAN = '#007595'
const AZUL = '#155dfc'
const LIMA = '#8dc63f'
const ROJO = '#c2410c'

const ANCHO = 940
const COL_X = 130, COL_W = 400, COL_CX = COL_X + COL_W / 2   // columna principal
const LADO_X = 600, LADO_W = 290                              // columna lateral

type Paso = { n: number; y: number; h: number; titulo: string; lineas: string[] }

const PASOS: Paso[] = [
  { n: 1, y: 30, h: 118, titulo: 'El vecino reporta', lineas: ['Por WhatsApp, Telegram, la web o la app.', 'Manda foto y ubicación. Recibe folio al instante:', '«recibido, en validación».'] },
  { n: 2, y: 200, h: 100, titulo: 'Recepción: una persona lo lee', lineas: ['Ve el texto, las fotos y el lugar. No lo decide', 'un algoritmo: lo decide alguien, con su nombre.'] },
  { n: 3, y: 500, h: 118, titulo: 'Llega al área correcta', lineas: ['Se rutea por categoría. Al titular le llega aviso', 'por correo y Telegram. El plazo público', 'empieza a correr.'] },
  { n: 4, y: 670, h: 100, titulo: 'Se asigna a una cuadrilla', lineas: ['El supervisor elige quién va. A esa persona', 'le llega por WhatsApp o Telegram.'] },
  { n: 5, y: 822, h: 118, titulo: 'La cuadrilla atiende y sube la foto', lineas: ['Marca que empezó. Al terminar, foto del trabajo.', 'Sin foto no hay cierre: la evidencia queda en', 'el expediente, con hora y quién.'] },
  { n: 6, y: 1130, h: 100, titulo: 'El vecino califica y se cierra', lineas: ['Del 1 al 5. Si no contesta en 3 días,', 'se cierra solo y queda registrado así.'] },
  { n: 7, y: 1282, h: 100, titulo: 'Todo se ve', lineas: ['Tablero público por colonia e informe semanal', 'por dependencia: cumplimiento y pendientes.'] },
]

const DECISIONES = [
  { y: 400, texto: '¿Se registra?', sub: 'lo decide recepción' },
  { y: 1030, texto: '¿Quedó resuelto?', sub: 'al vecino le llega la foto' },
]

const ALTO = 1410

function Flecha({ d, color = MARINO, punta = true, discontinua = false }: { d: string; color?: string; punta?: boolean; discontinua?: boolean }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray={discontinua ? '6 6' : undefined} markerEnd={punta ? `url(#punta-${color === MARINO ? 'marino' : color === ROJO ? 'rojo' : 'lima'})` : undefined} />
}

function Etiqueta({ x, y, texto, color }: { x: number; y: number; texto: string; color: string }) {
  return (
    <g>
      <rect x={x - 22} y={y - 13} width={44} height={26} rx={13} fill={color} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">{texto}</text>
    </g>
  )
}

export function DiagramaFlujo() {
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-labelledby="flujo-titulo flujo-desc" className="mx-auto block h-auto w-full min-w-[720px] max-w-4xl">
        <title id="flujo-titulo">Cómo funciona DemosVoz, paso por paso</title>
        <desc id="flujo-desc">
          Un vecino reporta; recepción decide si se registra o no, y si no, se le avisa con el motivo. Si sí, llega al
          área, se asigna a una cuadrilla, que atiende y sube foto. El vecino confirma si quedó: si no, se reabre y
          vuelve a la cuadrilla; si sí, califica y se cierra. Todo se ve en el tablero público y el informe semanal.
        </desc>
        <defs>
          <linearGradient id="grad-paso" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={CIAN} /><stop offset="1" stopColor={AZUL} />
          </linearGradient>
          {[['marino', MARINO], ['rojo', ROJO], ['lima', LIMA]].map(([id, c]) => (
            <marker key={id} id={`punta-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* ── columna principal: flechas entre pasos ── */}
        <Flecha d={`M ${COL_CX} 148 V 198`} />
        <Flecha d={`M ${COL_CX} 300 V 338`} />
        <Flecha d={`M ${COL_CX} 462 V 498`} />
        <Etiqueta x={COL_CX + 34} y={480} texto="Sí" color={LIMA} />
        <Flecha d={`M ${COL_CX} 618 V 668`} />
        <Flecha d={`M ${COL_CX} 770 V 820`} />
        <Flecha d={`M ${COL_CX} 940 V 968`} />
        <Flecha d={`M ${COL_CX} 1092 V 1128`} />
        <Etiqueta x={COL_CX + 34} y={1110} texto="Sí" color={LIMA} />
        <Flecha d={`M ${COL_CX} 1230 V 1280`} />

        {/* ── decisión 1: No → aviso al vecino, fin ── */}
        <Flecha d={`M ${COL_CX + 120} 400 H ${LADO_X - 2}`} color={ROJO} />
        <Etiqueta x={COL_CX + 160} y={380} texto="No" color={ROJO} />
        <g>
          <rect x={LADO_X} y={352} width={LADO_W} height={96} rx={10} fill="#fff" stroke={ROJO} strokeWidth={2} />
          <text x={LADO_X + 16} y={378} fontSize={15} fontWeight={700} fill={ROJO}>No se registra</text>
          {['Al vecino le llega el motivo, escrito por', 'la persona que lo revisó. No es público', 'y no le llega al área.'].map((l, i) => (
            <text key={l} x={LADO_X + 16} y={400 + i * 18} fontSize={13} fill="#4a5f59">{l}</text>
          ))}
        </g>

        {/* ── nota junto al paso 5: plazo vencido ── */}
        <Flecha d={`M ${COL_X + COL_W} 880 H ${LADO_X - 2}`} color={MARINO} discontinua punta={false} />
        <g>
          <rect x={LADO_X} y={846} width={LADO_W} height={70} rx={10} fill="#fff" stroke={MARINO} strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={LADO_X + 16} y={870} fontSize={15} fontWeight={700} fill={MARINO}>Si el plazo vence</text>
          {['sin atenderse, el sistema alerta al área', 'y al supervisor, sin que nadie lo pida.'].map((l, i) => (
            <text key={l} x={LADO_X + 16} y={890 + i * 17} fontSize={13} fill="#4a5f59">{l}</text>
          ))}
        </g>

        {/* ── decisión 2: No → se reabre y vuelve a la cuadrilla ── */}
        <Flecha d={`M ${COL_CX + 120} 1030 H ${LADO_X - 2}`} color={ROJO} />
        <Etiqueta x={COL_CX + 160} y={1010} texto="No" color={ROJO} />
        <g>
          <rect x={LADO_X} y={990} width={LADO_W} height={80} rx={10} fill="#fff" stroke={ROJO} strokeWidth={2} />
          <text x={LADO_X + 16} y={1016} fontSize={15} fontWeight={700} fill={ROJO}>Se reabre</text>
          {['Con plazo nuevo. El área se entera', 'y la cuadrilla vuelve a ir.'].map((l, i) => (
            <text key={l} x={LADO_X + 16} y={1038 + i * 18} fontSize={13} fill="#4a5f59">{l}</text>
          ))}
        </g>
        {/* vuelta al paso 4 */}
        <Flecha d={`M ${LADO_X + LADO_W} 1030 H 906 V 720 H ${COL_X + COL_W + 2}`} color={ROJO} />
        <text x={924} y={880} fontSize={12} fontWeight={600} fill={ROJO} transform="rotate(-90 924 880)" textAnchor="middle">vuelve al paso 4</text>

        {/* ── rombos de decisión ── */}
        {DECISIONES.map((d) => (
          <g key={d.texto}>
            <polygon
              points={`${COL_CX},${d.y - 62} ${COL_CX + 120},${d.y} ${COL_CX},${d.y + 62} ${COL_CX - 120},${d.y}`}
              fill="#fff" stroke={LIMA} strokeWidth={3}
            />
            <text x={COL_CX} y={d.y - 2} textAnchor="middle" fontSize={19} fontWeight={800} fill={MARINO}>{d.texto}</text>
            <text x={COL_CX} y={d.y + 20} textAnchor="middle" fontSize={13} fill="#4a5f59">{d.sub}</text>
          </g>
        ))}

        {/* ── pasos numerados ── */}
        {PASOS.map((p) => (
          <g key={p.n}>
            <rect x={COL_X} y={p.y} width={COL_W} height={p.h} rx={12} fill="#fff" stroke="#dfe6e2" strokeWidth={1.5} />
            <circle cx={COL_X + 30} cy={p.y + 30} r={18} fill="url(#grad-paso)" />
            <text x={COL_X + 30} y={p.y + 36} textAnchor="middle" fontSize={17} fontWeight={800} fill="#fff">{p.n}</text>
            <text x={COL_X + 60} y={p.y + 36} fontSize={18} fontWeight={800} fill={MARINO}>{p.titulo}</text>
            {p.lineas.map((l, i) => (
              <text key={l} x={COL_X + 60} y={p.y + 62 + i * 19} fontSize={13.5} fill="#4a5f59">{l}</text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
