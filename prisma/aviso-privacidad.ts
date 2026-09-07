/**
 * Borrador del aviso de privacidad.
 *
 * NO es una copia del aviso de otro gobierno. Un aviso de privacidad declara lo
 * que una institución concreta hace con los datos de la gente; copiar el de otro
 * municipio pondría en el sitio afirmaciones falsas sobre este.
 *
 * Este texto sigue la estructura que exige la LGPDPPSO y describe exactamente
 * lo que el sistema hace hoy —verificado contra el código: cifrado del teléfono,
 * qué sale en datos abiertos, qué se borra de las fotos—. Lo que el sistema no
 * puede saber (domicilio, Unidad de Transparencia, fundamento estatal) va
 * marcado como PENDIENTE, para que salte a la vista de quien lo revise.
 *
 * Necesita revisión jurídica antes de publicarse como definitivo.
 */
export function borradorAviso(municipio: string, telEmergencias: string): string {
  return `> **Borrador pendiente de revisión jurídica.** El texto describe con
> exactitud lo que el sistema hace con tus datos, pero todavía no lo revisa el
> área jurídica del municipio ni incluye los datos del responsable. Los apartados
> marcados como PENDIENTE deben completarse antes de considerarlo definitivo.

## 1. Quién es responsable de tus datos

El municipio de ${municipio}, a través de su área de atención ciudadana, es
responsable del tratamiento de los datos personales que nos proporcionas al
levantar un reporte.

**Domicilio:** PENDIENTE — domicilio oficial del ayuntamiento.

## 2. Qué datos recabamos

Al levantar un reporte podemos recabar:

- **Tu teléfono**, si decides darlo. Es opcional.
- **Tu nombre**, si decides darlo. También es opcional.
- **La descripción y la ubicación** del problema que reportas.
- **Las fotografías** que subas.

Puedes levantar un reporte **sin dar teléfono ni nombre**. Si no dejas teléfono,
no podremos avisarte cuando se resuelva ni pedirte que califiques la atención.

No recabamos datos personales sensibles. Si los escribes dentro de la
descripción, se tratarán con la misma protección que el resto del texto libre:
no se publican.

## 3. Para qué los usamos

Las siguientes finalidades son necesarias para darte el servicio:

- Atender tu reporte y turnarlo al área que corresponde.
- Avisarte cuando cambie de estado o quede resuelto.
- Pedirte que califiques la atención al cierre.

Estas otras no son necesarias, y puedes oponerte a ellas sin que afecte la
atención de tu reporte:

- Publicar la fotografía del antes y el después en la galería pública, **solo
  después de que una persona del municipio la revise y la autorice**.
- Usar tus datos de contacto para encuestas de satisfacción.

## 4. Fundamento legal

PENDIENTE — artículos aplicables de la Ley General de Protección de Datos
Personales en Posesión de Sujetos Obligados y de la ley estatal correspondiente,
así como el reglamento municipal que da atribuciones al área de atención
ciudadana.

## 5. Cómo protegemos tu teléfono

Tu número se guarda **cifrado**. Dentro del sistema, el personal ve solamente
una versión enmascarada (por ejemplo \`77••••4567\`). Para ver el número
completo hace falta un perfil autorizado, y **cada consulta queda registrada**
con el nombre de quien la hizo y la fecha.

## 6. Qué publicamos y qué no

El tablero público y los datos abiertos **nunca** incluyen tu teléfono ni tu
nombre. Tampoco publicamos:

- La descripción que escribiste, porque es texto libre donde pueden aparecer
  datos de otras personas.
- La dirección exacta que diste.

Las coordenadas del reporte se publican **redondeadas a unos once metros**:
suficiente para ubicar un bache en un mapa, insuficiente para señalar una
vivienda.

De las fotografías que subes se eliminan los metadatos antes de guardarlas,
incluida la ubicación GPS que registra el teléfono al tomarlas.

## 7. Transferencias

No transferimos tus datos personales a terceros ajenos al municipio, salvo las
transferencias previstas en la ley que no requieren tu consentimiento, como los
requerimientos de autoridad competente.

Los mensajes que intercambias con nuestro asistente por WhatsApp o Telegram
viajan por la infraestructura de esas plataformas, sujetas a sus propias
políticas.

## 8. Cómo oponerte o limitar el uso de tus datos

Para oponerte a las finalidades que no son necesarias, o para limitar el uso o
divulgación de tus datos, presenta tu solicitud ante la Unidad de Transparencia
del municipio con los datos de contacto del apartado 10.

## 9. Tus derechos

Puedes solicitar en cualquier momento el **acceso, rectificación, cancelación u
oposición** al tratamiento de tus datos personales, así como revocar el
consentimiento que nos diste.

Para ejercerlos necesitas presentar una solicitud con tu identificación, la
descripción clara de los datos sobre los que quieres ejercer el derecho, y el
folio del reporte si lo tienes a la mano.

## 10. Unidad de Transparencia

PENDIENTE — domicilio, teléfono, correo electrónico y horario de atención de la
Unidad de Transparencia del municipio.

## 11. Cambios a este aviso

Cualquier modificación se publica en esta misma página, con número de versión y
fecha. Las versiones anteriores se conservan y pueden consultarse en la Unidad
de Transparencia.

## 12. Emergencias

Este sistema **no atiende emergencias**. Si hay riesgo para alguien, marca al
${telEmergencias}.
`
}
