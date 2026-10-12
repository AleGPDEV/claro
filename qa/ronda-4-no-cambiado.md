# Claro · Informe para QA tras la ronda 4

Este informe lista lo que **no** se cambió, lo que se resolvió **distinto** a lo sugerido y lo que quedó **sin verificar**, con el motivo. Lo que no aparece acá se corrigió como pedía la revisión. 105 tests unitarios.

## 1. Resuelto como se sugería

- **R4 #1 · Intercambio con una tercera moneda.** Al intercambiar, el cambio guardado de los movimientos en otras monedas se divide por el cambio vigente. Con el caso de la revisión (400 UYU a 40, segunda ARS a 1400) el gasto pasa a valer 14.000 ARS. Hay un test que además comprueba que deshacer el intercambio devuelve los valores de partida y que actualizar el cambio después no mueve el histórico.

## 2. Resuelto distinto a lo sugerido

**R4 #2 · Dos gastos en una línea.** QA sugería no sumar si la palabra del medio es de otra categoría, o mostrar el aviso de duda. Se hizo otra cosa: la línea se **parte en dos**. Se anota el primer gasto y el texto del segundo queda escrito en la entrada, listo para agregarlo con otro Enter. Mientras tanto se muestra un aviso.
- Motivo: no sumar deja igual un gasto sin anotar; partir conserva los dos, cada uno en su categoría.
- Límites:
  - Solo se parte si la palabra del medio tiene una categoría reconocida y distinta de la del primer tramo. "uber 10 y taxi 5" (misma categoría) sigue sumando 15 en un solo gasto con la nota "Uber".
  - Si el primer tramo no tiene categoría y la palabra del medio sí ("cosas 100 y farmacia 40"), también se parte.
  - Solo cuenta **una** palabra en medio. "super 1200 y la farmacia 400" ni suma ni parte: toma 400 con el aviso de varios números.
  - Para decidir no se usan las categorías aprendidas del usuario, solo el diccionario.
  - El segundo gasto conserva la fecha escrita ("ayer…"), pero no el "+" de ingreso ni la moneda mencionada en el primero.
  - Con tres gastos en una línea se parte de a uno por vez.

**R4 #3 · Cantidad al final después de "y".** Se corrigió solo el patrón que reportó la revisión: "y" + plural + entero chico ("café 150 y medialunas 2" registra 150).
- No cubierto: sin la "y" ("café 150 medialunas 2") sigue tomando 2, con el aviso de varios números.
- Motivo: tratar como cantidad todo número precedido de un plural rompe casos frecuentes donde ese número es el precio ("2 cafés 7", "pago 3 cuotas 1200" funcionan porque el último número es el monto).

**R4 #4 · Aviso de año.** De las dos opciones sugeridas se tomó la segunda: el aviso sale solo si el número coincide con el año actual o el siguiente. No se mira si está pegado a palabras de fecha.
- Consecuencia: "nafta 2000", "super 1950" y "4 amigos asado 2000" ya no avisan. Un año pasado ("concierto 2025") tampoco avisa.
- "concierto 2026" sigue registrando 2026, con aviso (pendiente desde R1 #8).

## 3. Decisiones que se mantienen (aceptadas por QA en la ronda 4)

- USD como moneda principal por defecto; la moneda de carga es la del país.
- Tipo de cambio manual, sin consultar ningún servicio.
- Datos solo en el dispositivo, sin cuenta ni sincronización.

## 4. Pendiente de rondas anteriores, sin cambios

| Origen | Estado | Motivo |
|---|---|---|
| R1 #8 · "concierto 2026" toma 2026 | Con aviso | Con un único número no se distingue un año de un precio |
| R2 #1 · Priorizar la coincidencia más específica | No implementado | Gana la primera palabra reconocida; una frase gana a una palabra |
| R2 #2 · Prefijos | Eliminados | Daban falsos positivos; "restaurantito" va a Otros |
| R2 #2 · "matrícula" a secas | Va a Educación | Solo "matrícula del auto / coche / moto" va a Transporte |
| R1 #16 · "seguro" a secas | Va a Otros | Sin contexto no se sabe de qué es |
| R2 #8 · Tope de montos | 10.000 millones | Arbitrario |
| R1 #1 · Borrado de datos en Safari | Mitigado, no resuelto | Sin instalar la app, Safari puede borrar igual |
| R3 #3 · Intercambio | El histórico queda con el cambio de hoy | No hay datos históricos de tipo de cambio |
| R3 #6 · Fecha pasada | Cambio del movimiento más cercano | Ídem. Editar la fecha de un movimiento no recalcula su cambio |
| R3 #1 · Bloqueo de la segunda moneda | Solo con fijos, no con movimientos | Cada movimiento guarda su propio cambio |
| R3 #4 · Cantidades | Heurística | Entero hasta 31 seguido de plural; "2 cafés" solo registra 2; lista de no-plurales no exhaustiva |

## 5. Comportamientos que conviene que QA conozca

- Los fijos se valoran con el cambio actual; cada cobro generado guarda el del momento.
- Cambiar la principal a una tercera moneda re-etiqueta lo anotado en la principal con los mismos números, previa confirmación. Los cambios guardados en movimientos de otras monedas no se tocan en ese caso.
- Tras un intercambio, los movimientos en la nueva principal conservan su cambio guardado aunque no se use: sirve para deshacer el intercambio sin pérdida.

## 6. Sin verificar

| Qué | Estado |
|---|---|
| Intercambio de monedas | Ahora con test unitario (es una función pura del modelo); no probado en pantalla después del cambio |
| Dos gastos en una línea | Con tests y probado en pantalla: dos Enter dejan Super 1200 y Farmacia 400, cada uno en su categoría |
| Bloqueo al quitar o cambiar la segunda moneda con fijos | Sin test propio y sin probar en pantalla (QA lo confirmó en la ronda 4) |
| Resto de acciones del almacén (`store.ts`) | Sin tests |
| Dos pestañas en un navegador real | No probado |
| Instalación en iPhone y Android, uso sin conexión | No probado en dispositivo |
| CSV abierto en Excel | Solo tests del formato |
| Lector de pantalla | No probado |
