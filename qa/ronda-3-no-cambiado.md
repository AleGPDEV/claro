# Claro · Informe para QA tras la ronda 3

Versión: commit `0b785cc` · publicado como `claro-3b963bca28` · 100 tests unitarios.

Este informe lista lo que **no** se cambió, lo que se resolvió **distinto** a lo sugerido y lo que quedó **sin verificar**, con el motivo de cada cosa. Lo que no aparece acá se corrigió como pedía la revisión.

## 1. Decisiones que se mantienen a propósito

| Tema | Qué pedía QA | Qué se hizo | Por qué |
|---|---|---|---|
| Moneda principal por defecto (R3 #2) | Que la moneda local sea la principal | Sigue siendo USD. Se cambió la moneda de **carga**: un monto sin moneda se anota en la del país | Es un pedido explícito del dueño del producto: totales en USD. QA ofrecía la moneda de carga como alternativa |
| Tipo de cambio | — | Se carga a mano en Ajustes; no se consulta ningún servicio | La app no hace ninguna llamada de red con datos del usuario; es parte de la promesa de privacidad |
| Almacenamiento | — | Solo en el dispositivo, sin cuenta ni sincronización | Misma razón. Sincronizar exige servidor y cuentas |

## 2. Resuelto distinto a lo sugerido

**R3 #1 · Montos 1 a 1.** QA sugería impedir quitar o cambiar la segunda moneda si hay fijos *o movimientos* en ella. Se bloquea solo con **fijos**.
- Motivo: cada movimiento guarda su propio tipo de cambio, así que sigue valiendo lo mismo aunque la segunda moneda cambie o se quite. Los fijos no guardan cambio y por eso sí bloquean.
- Consecuencia: un movimiento en otra moneda **sin** cambio guardado (solo puede venir de una copia importada o editada a mano) no se suma a los totales y se muestra con el aviso "falta el tipo de cambio".

**R3 #3 · Intercambiar principal y segunda.** Se guarda el cambio vigente en cada movimiento de la principal anterior, como se sugería. Pero es el cambio **de hoy** para todo el histórico, no el de la fecha de cada movimiento.
- Motivo: no hay datos históricos de tipo de cambio.

**R3 #6 · Fecha pasada.** No se usa "el cambio de ese día" sino el del movimiento en esa moneda más cercano a esa fecha; si no hay ninguno más cercano que hoy, el de hoy.
- Motivo: el mismo, no hay histórico. Es una aproximación y se puede corregir a mano en la edición.
- No cubierto: cambiar la fecha de un movimiento ya cargado **no** recalcula su cambio.

**R3 #4 · Cantidades y sumas.** Es una heurística, con estos límites:
- Cantidad = entero de 1 o 2 cifras, hasta 31, seguido de una palabra de 4 letras o más terminada en "s". "50 medialunas 9000" no se detecta como cantidad.
- Si la cantidad es el único número, se toma como monto: "2 cafés" registra 2.
- Se suma solo con "y", "+" o "más", con a lo sumo **una** palabra en medio. "450 y la propina 50" no suma.
- Palabras terminadas en "s" que no son plural se excluyen por lista (lunes, martes, más, menos, gratis…); la lista no es exhaustiva.

**R3 #2 · "$".** Se interpreta como pesos solo si exactamente una de las dos monedas es un peso. Con dos pesos (ARS + UYU) o ninguno (USD + EUR), un "$" no indica moneda.

## 3. Pendiente de rondas anteriores

| Origen | Estado | Motivo |
|---|---|---|
| R1 #8 · "concierto 2026" toma 2026 | Sigue igual, con aviso | Con un único número no se puede distinguir un año de un precio, y 2026 es un monto normal en pesos |
| R2 #1 · Priorizar la coincidencia más específica | No implementado; se quitó "resto" | Sigue ganando la primera palabra reconocida. Una frase ("uber eats") gana a una palabra |
| R2 #2 · Prefijos | Se eliminó toda coincidencia por prefijo | Daba falsos positivos ("cursor"). Costo: derivados como "restaurantito" van a Otros |
| R2 #2 · "matrícula" a secas | Va a Educación | Solo "matrícula del auto / coche / moto" va a Transporte |
| R1 #16 · "seguro" a secas | Va a Otros | Sin más contexto no se sabe de qué es |
| R2 #8 · Tope de montos | 10.000 millones, al teclear y al importar | Es arbitrario; no hay un criterio mejor para "absurdo" |
| R1 #1 · Borrado de datos en Safari | Mitigado, no resuelto | `persist()` y el recordatorio de copias reducen el riesgo; si la app no está instalada, Safari puede borrar igual |

## 4. Comportamientos que conviene que QA conozca

- **Los fijos se valoran con el cambio actual.** "Gastos fijos al año" y el presupuesto libre se mueven cuando se actualiza el tipo de cambio. Cada cobro generado sí guarda el cambio de ese momento.
- **Cambiar la principal a una tercera moneda** (ni la principal ni la segunda) re-etiqueta lo anotado en la principal con los mismos números. Pide confirmación; está pensado para corregir un error de configuración.
- **El aviso de "anotaciones que no se suman"** cuenta movimientos y fijos juntos.
- **Tope de cobros atrasados de un fijo:** 600, y fecha de inicio no anterior a 5 años. Con datos importados más antiguos se registran los 600 más viejos y el resto se salta.

## 5. Sin verificar

| Qué | Estado |
|---|---|
| Bloqueo al quitar o cambiar la segunda moneda con fijos | Sin test y sin probar en pantalla |
| Intercambio de monedas con el cambio fijado en el histórico | Sin test; se probó el intercambio antes de este cambio |
| Cambio según la fecha (R3 #6) | Con test unitario; no probado en pantalla |
| Dos pestañas abiertas a la vez | Implementado; no probado con dos pestañas reales |
| Instalación en iPhone y Android, y uso sin conexión | No probado en dispositivo |
| CSV abierto en Excel | Solo tests del formato |
| Acciones del almacén (`store.ts`) | Sin tests: solo están cubiertos el parser, el modelo, las monedas y el CSV |
| Lector de pantalla | No probado |
