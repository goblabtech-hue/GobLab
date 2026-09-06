# Roadmap posterior al MVP

Lo que el SPEC §13 pide **documentar, no implementar**. El MVP —las seis fases
del plan— está completo; esto es lo que sigue, con lo que cada cosa costaría de
verdad y de qué depende.

El orden no es caprichoso: primero lo que multiplica el valor de lo que ya
existe, después lo que abre frentes nuevos.

---

## 1. PWA instalable

**Qué es.** Que el sitio se pueda "instalar" en el celular como una app, con
ícono propio, y que la vista de cuadrilla funcione con mala señal.

**Por qué primero.** La cuadrilla trabaja en la calle, muchas veces donde no hay
red. Hoy, si pierde señal al subir la evidencia, pierde la foto y el viaje.

**Qué implica.** Manifiesto y service worker; cola local de cierres pendientes
que se sincroniza al recuperar señal. Lo caro no es el service worker: es
resolver qué pasa cuando dos cierres del mismo reporte llegan desfasados.

**Depende de.** Nada. Se puede hacer ya.

---

## 2. SMS como respaldo de notificación

**Qué es.** Si el aviso por WhatsApp o Telegram no llega, mandarlo por SMS.

**Por qué importa.** No toda la gente tiene WhatsApp activo, y quien reporta por
la web solo dejó un número. Sin esto, un porcentaje de ciudadanos nunca se
entera de que su reporte se resolvió, y por lo tanto nunca califica — que es la
métrica principal del tablero.

**Qué implica.** Un `MessagingProvider` más. La interfaz ya existe, así que es
un archivo nuevo, igual que fue Telegram.

**Depende de.** Contratar un proveedor de SMS. Tiene costo por mensaje, a
diferencia de todo lo demás del sistema.

---

## 3. Encuesta tipo NPS semestral por WhatsApp

**Qué es.** Preguntar dos veces al año, a quien haya reportado, qué tan probable
es que recomiende el servicio.

**Por qué importa.** La calificación actual mide **un reporte**. El NPS mide la
confianza en el municipio, que es lo que hace que la gente vuelva a reportar en
vez de rendirse.

**Qué implica.** Un flujo más del bot y una tabla de campañas. Cuidado con la
frecuencia: una encuesta que llega seguido se percibe como spam y quema el
canal para los avisos que sí importan.

**Depende de.** Que el bot esté en producción con volumen real.

---

## 4. Panel público comparativo mes contra mes por dependencia

**Qué es.** Publicar el desempeño de cada dependencia, no solo el agregado del
municipio.

**Por qué importa.** Es el paso natural del tablero: hoy se publica qué tan bien
cumple el municipio; esto publica quién cumple dentro del municipio.

**Qué implica.** Los datos ya existen — es lo que muestra `/ejecutivo`. El
trabajo real no es técnico: es la decisión política de publicarlo, y acordar
cómo se lee sin que se vuelva un ranking para castigar áreas con más carga.

**Depende de.** Una decisión de la autoridad, no de programación.

---

## 5. Presupuesto participativo ligado a colonias

**Qué es.** Que las colonias con más reportes de un tipo entren a una bolsa de
obra pública votable.

**Por qué importa.** Cierra el ciclo: hoy el sistema atiende síntomas —tapa
baches— y esto atacaría las causas. Además le da a la gente una razón para
reportar más allá de su problema personal.

**Qué implica.** Módulo de votación con identidad verificada, que es un problema
distinto y más difícil que todo lo que hay hoy: el sistema actual funciona
justamente porque **no** exige identificarse.

**Depende de.** Presupuesto etiquetado y reglas de operación. Es el punto más
lejano de la lista.

---

## 6. Integración con órdenes de trabajo y nómina

**Qué es.** Que cerrar un reporte genere la orden de trabajo del sistema
administrativo del municipio.

**Por qué importa.** Hoy la cuadrilla captura dos veces: aquí y en el sistema
interno. La doble captura siempre termina en datos que no cuadran.

**Qué implica.** Depende por completo de qué sistema usa el municipio y de si
expone una API. Puede ser un día o puede ser imposible.

**Depende de.** Un inventario de los sistemas administrativos actuales. **Hacer
ese inventario antes que nada**, porque puede cambiar el orden de esta lista.

---

## 7. Portal de transparencia con actas de cabildo

**Qué es.** Publicar actas y acuerdos junto al tablero de atención.

**Por qué va al final.** Es valioso, pero es un producto distinto que comparte
poco con lo que ya existe: no usa el ciclo del reporte, ni el bot, ni los
indicadores. Conviene tratarlo como un proyecto aparte y no como una fase más
de este.

---

## Lo que deliberadamente NO está en el roadmap

- **App nativa.** Una PWA cubre lo mismo sin dos tiendas de aplicaciones, dos
  procesos de revisión y dos bases de código que mantener con presupuesto
  municipal.
- **Cuentas de ciudadano.** Que la gente pueda reportar sin registrarse es una
  decisión de diseño, no una carencia: cada campo obligatorio pierde gente.
- **Chat en vivo con operador.** El escalamiento actual —marcar la conversación
  y que un operador la retome— resuelve el mismo problema sin exigir que haya
  alguien conectado todo el día.
