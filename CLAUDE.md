# Gestión Terreno (solicitud de camioneta) — notas para Claude

PWA de solicitud de vehículo y ficha pre-terreno. Repo `cvenegas-sernageomin/gestion-terreno` (rama `main`).
No tiene ficha en la memoria todavía: si se trabaja en profundidad, crear `proyecto-gestion-terreno`.

## Reglas
- Un solo `index.html` sin build + `sw.js` (`CACHE='solicitud-camioneta-vN'`, subirlo en cada cambio).
- Plantillas generadas con `scripts/construir_plantilla_*.py`.

## Verificar
Servidor: config `solicitud-camioneta-pwa` (puerto 8792) en `.claude/launch.json`.
