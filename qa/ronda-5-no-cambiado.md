# Claro · Informe para QA tras la ronda 5

Este informe lista lo que **no** se cambió, lo que se resolvió **distinto** a lo sugerido y lo que quedó **sin verificar**, con el motivo. Lo que no aparece acá se corrigió como pedía la revisión. 114 tests unitarios.

## 1. Resuelto como se sugería

- **R5 #1 · Moneda al partir la línea.** La línea se parte primero y la moneda se busca después, en cada tramo por separado. El tramo que queda escrito es el texto original, sin reemplazos. "super 30 y farmacia 10 usd" anota Super 30 UYU y deja "farmacia 10 usd", que se anota como 10 USD. Con tests y probado en pantalla.
- **R5 #2 · Confirmación tras partir.** El aviso "✓ Anotado: … Deshacer" se muestra aunque la entrada ya tenga escrito el segundo gasto. Probado en pantalla.
- **R5 #4 · Nota al sumar.** Se conservan los conceptos: "alquiler 25000 y luz 3000" queda como "Alquiler y luz"; "uber 10 y taxi 5", como "Uber y taxi".

## 2. Resuelto distinto a lo sugerido

**R5 #3 · Monto antes del concepto.** No se agregó un caso especial: se rehízo la forma de partir. Antes se miraba la palabra entre dos números; ahora la línea se divide en **tramos** por "y", "+" o "más", y cada tramo se interpreta solo (monto, moneda, signo y categoría). Así da igual el orden: "1200 super y 400 farmacia" parte igual que "super 1200 y farmacia 400".
- "+1500 sueldo y super 500" anota un ingreso de 1500 y deja "super 500" como gasto.
- "-200 devolución amazon y super 300" anota la devolución de 200 y deja "super 300".

Reglas actuales, para que QA las pueda atacar:
- Un "y", "+" o "más" separa tramos solo si hay un monto a cada lado. En "pan y queso 200" o "café 3,50 y 2 medialunas" forma parte de la nota.
- Tramos seguidos se **suman** en un solo movimiento si el siguiente no tiene categoría reconocida o tiene la misma, y además dicen la misma moneda (o ninguno la dice).
- La línea se **parte** donde un tramo tiene una categoría reconocida distinta, o donde cambia la moneda mencionada.
- Ya no hay límite de una palabra en medio: "super 1200 y la farmacia 400" ahora parte (en la ronda 4 tomaba 400 con aviso).

**Cambio de criterio propio, no pedido por QA:** si solo uno de los tramos dice la moneda, la línea se parte en vez de sumarse. "alquiler 20000 y luz 50 usd" anota Alquiler 20.000 en la moneda de carga y deja "luz 50 usd".
- Motivo: sumar ahí daría 20.050 USD, el mismo tipo de error silencioso y grande del hallazgo #1.
- Costo: "uber 10 y 5 propina usd" también se parte (Uber 10 en la moneda de carga, y queda "5 propina usd"). Para sumar en dólares hay que decir la moneda en los dos tramos.

## 3. Límites conocidos de la función

- El "+" inicial (ingreso) vale solo para el primer tramo; el resto se anota como gasto. Antes figuraba como carencia; ahora es el comportamiento buscado (R5 #3).
- Al sumar varios tramos, si alguno lleva signo negativo o la palabra "devolución", toda la suma se anota como devolución.
- La nota de una suma une los conceptos siempre con "y", aunque se haya escrito "+" o "más".
- Para decidir si se parte no se usan las categorías aprendidas del usuario, solo el diccionario.
- Con tres o más gastos se anota de a uno; cada Enter deja escrito el resto.
- La regla de cantidades se amplió: un entero hasta 31 también es cantidad si sigue a un plural que abre el tramo ("y medialunas 2", "entradas 2 cine 30"). Sin la "y" y en medio del tramo ("café 150 medialunas 2") sigue tomando 2 con aviso.

## 4. Decisiones que se mantienen (aceptadas por QA)

- USD como moneda principal por defecto; la moneda de carga es la del país.
- Tipo de cambio manual, sin consultar ningún servicio.
- Datos solo en el dispositivo, sin cuenta ni sincronización.

## 5. Pendiente de rondas anteriores, sin cambios

| Origen | Estado | Motivo |
|---|---|---|
| R1 #8 · "concierto 2026" toma 2026 | Con aviso (solo año actual o siguiente) | Con un único número no se distingue un año de un precio |
| R2 #1 · Priorizar la coincidencia más específica | No implementado | Gana la primera palabra reconocida; una frase gana a una palabra |
| R2 #2 · Prefijos | Eliminados | Daban falsos positivos; "restaurantito" va a Otros |
| R2 #2 · "matrícula" a secas | Va a Educación | Solo "matrícula del auto / coche / moto" va a Transporte |
| R1 #16 · "seguro" a secas | Va a Otros | Sin contexto no se sabe de qué es |
| R2 #8 · Tope de montos | 10.000 millones | Arbitrario |
| R1 #1 · Borrado de datos en Safari | Mitigado, no resuelto | Sin instalar la app, Safari puede borrar igual |
| R3 #3 · Intercambio | El histórico queda con el cambio de hoy | No hay datos históricos de tipo de cambio |
| R3 #6 · Fecha pasada | Cambio del movimiento más cercano | Ídem. Editar la fecha de un movimiento no recalcula su cambio |
| R3 #1 · Bloqueo de la segunda moneda | Solo con fijos | Cada movimiento guarda su propio cambio |

## 6. Otros cambios de esta ronda

- `vite.config.ts`: el servidor de desarrollo ahora vigila los archivos por sondeo. No afecta a lo publicado. Motivo: durante esta ronda sirvió dos veces un módulo viejo, y la primera prueba en pantalla del punto 1 mostró el comportamiento anterior hasta reiniciarlo.

## 7. Sin verificar

| Qué | Estado |
|---|---|
| Partir con monedas distintas y confirmación con "Deshacer" | Con tests y probado en pantalla |
| Partir cuando solo un tramo dice la moneda | Con tests; no probado en pantalla |
| Bloqueo al quitar o cambiar la segunda moneda con fijos | Sin test propio; QA lo confirmó en la ronda 4 |
| Acciones del almacén (`store.ts`), salvo el intercambio | Sin tests |
| Dos pestañas en un navegador real | No probado |
| Instalación en iPhone y Android, uso sin conexión | No probado en dispositivo |
| CSV abierto en Excel | Solo tests del formato |
| Lector de pantalla | No probado |
