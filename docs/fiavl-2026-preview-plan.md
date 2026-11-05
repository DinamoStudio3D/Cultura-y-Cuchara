# FIAVL 2026 — plan de integración en Preview

Estado: **rama de pruebas; no publicado en producción**.

## Objetivo
Integrar la programación FIAVL 2026 y Fiestas de Loja con una agenda consultable por fecha, categoría, título y escenario, y un mapa con un marcador por lugar.

## Componentes existentes verificados
- `js/events-billboard.js`: carrusel limitado a 15 próximos eventos.
- `index.html`: función `renderAgendaUI()` y filtros de agenda; existe prueba `scripts/test-public-agenda-search.mjs`.

## Reglas de implementación
1. No alterar `main`, Firebase de producción ni el Worker activo.
2. Mantener la cartelera de portada en 15 eventos; agenda completa en vista independiente.
3. Usar un identificador estable por función (título + fecha + hora + lugar), preservando funciones repetidas.
4. Un marcador por escenario, con lista de eventos y enlaces «Cómo llegar».
5. Solo usar coordenadas verificadas; para lugares sin coordenadas mostrar dirección o búsqueda textual sin afirmar precisión.
6. No importar registros provisionales sin validación contra el PDF de 52 páginas.
7. Probar filtros, accesibilidad, móvil y escritorio antes de pedir autorización de publicación.

## Datos disponibles fuera del repositorio
Se han preparado CSV preliminares por fecha (12–22 de noviembre), catálogo de lugares y prototipo HTML local. **Aún no se han subido a esta rama**: deben normalizarse y comprobarse primero.

## Próximos cambios de código
- Definir fuente de datos de agenda ampliada y evitar interferencias con `siteContent/events`.
- Incorporar una vista FIAVL accesible desde la agenda actual.
- Añadir capa de marcadores FIAVL con agrupación por escenario.
- Preparar una Preview Vercel y ejecutar pruebas sin tocar producción.
