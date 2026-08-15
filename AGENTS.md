# AGENTS.md — Reglas del ecosistema Ma'hai

Reglas aprendidas de incidentes reales en este proyecto (instalador Ma'hai +
sus apps Tauri). Un review de IA o cualquier agente debe chequear el diff
contra esto antes de aprobar un commit.

## Rust / Tauri

- **Nunca usar `tauri-plugin-fs` para escribir archivos elegidos por el
  usuario** (diálogo "Guardar como"). Ese plugin solo da permiso de
  escritura dentro de directorios propios de la app, nunca en la ruta que
  devuelve el diálogo nativo. Usar un comando Rust propio
  (`write_text_file`/`write_binary_file` en `src-tauri/src/lib.rs`) con
  `std::fs::write` directo.
- El nombre del paquete en `Cargo.toml` es siempre `name = "app"` → el
  binario compilado siempre se llama `app.exe`, sin importar el nombre
  visible del producto. No asumir que el nombre del exe coincide con el
  nombre de la app.
- Cualquier allowlist de ejecutables lanzables (ej. `ALLOWED_EXE` en el hub
  Ma'hai) tiene que mantenerse en sync a mano con `installer/staging/` y el
  `.iss` del instalador — no hay chequeo automático que avise si falta uno.

## Datos de usuario / localStorage

- Si una app siembra datos por defecto en `localStorage` con un check tipo
  "si está vacío, sembrar" (`if (!data.length) seed()`), y esos datos por
  defecto crecen en versiones futuras (ej. recetas nuevas agregadas al
  array de seed), **los usuarios existentes nunca van a recibir los datos
  nuevos**, porque el store ya no está vacío. Cualquier lógica de seed debe
  ser incremental/versionada, nunca un check binario de "vacío o no".
- Un instalador o limpiador de caché **nunca** debe borrar `Local Storage`,
  `IndexedDB` ni `Session Storage` de WebView2 — ahí viven los datos reales
  del usuario (recetas, entradas de bitácora, etc.). Solo limpiar `Cache`,
  `Code Cache`, `GPUCache`, `ShaderCache` y similares.
- Cualquier opción de "borrado completo" / reseteo de datos de usuario debe
  ser opt-in explícito, con advertencia clara de que es irreversible, y el
  botón/opción por defecto debe ser siempre la alternativa NO destructiva.

## Vite / build

- Scripts clásicos (`<script src="...">` sin `type="module"`) no se
  bundlean con Vite — tienen que vivir en `public/` (se copian verbatim a
  `dist/` en la misma ruta relativa), nunca sueltos en la raíz de `www/`.

## Git / releases / historial

- **Nunca** agregar `Co-Authored-By: Claude` ni ninguna atribución de IA a
  los mensajes de commit.
- Cualquier script que reemplace un artefacto ya publicado (asset de
  release, tag, build) debe **verificar explícitamente que el reemplazo se
  subió con éxito antes de borrar el original**. Nunca encadenar
  "subir → borrar" como pasos incondicionales sin chequear el resultado del
  paso anterior — un fallo de red a mitad de camino puede dejar el artefacto
  borrado sin reemplazo.
- Antes de tocar un repo, hacer `git fetch` + revisar
  `git log HEAD..origin/<rama>` por si hay commits que no se conocen
  todavía.
