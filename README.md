# IPTV Player para Samsung Smart TV (Tizen OS)

Un reproductor de IPTV optimizado para televisores Samsung Smart TV con Tizen OS. Permite cargar listas M3U8 y acceder mediante la API de Xtream Codes, incluyendo soporte de guía de programación (EPG), canales favoritos, motor de búsqueda rápida y navegación fluida mediante el mando a distancia (D-Pad).

---

## 🚀 Características Principales

- **Soporte de Múltiples Fuentes**: Carga y gestión de listas de reproducción M3U8 y conexiones mediante la API de Xtream Codes.
- **Rendimiento Optimizado**: Uso de Web Workers (`js/m3u-worker.js`) para parsear listas masivas de canales (más de 10k canales) en segundo plano y una lista virtual (`js/virtual-list.js`) para evitar retrasos en el renderizado de la UI de la Smart TV.
- **Guía de Programación (EPG)**: Carga y mapeo dinámico de guías en formato XMLTV en segundo plano. Muestra lo que se está emitiendo "Ahora" y lo que viene "Después".
- **Canales Favoritos**: Añade o quita canales de tu lista de favoritos de forma rápida.
- **Búsqueda Instantánea**: Filtrado rápido de canales mediante teclado en pantalla o teclado físico.
- **Navegación Intuitiva**: Interfaz diseñada para una resolución de 1080p, completamente adaptada al uso del D-Pad y los botones de colores del mando a distancia de Samsung.
- **Reproducción Integrada**: Uso del objeto nativo `avplayer` (`application/avplayer`) de Samsung Tizen para garantizar la mejor compatibilidad y decodificación de vídeo por hardware.

---

## 🛠️ Estructura del Proyecto

La aplicación está construida sobre tecnologías web estándar (HTML5, CSS y JavaScript vainilla) e integrada con las APIs de Tizen:

- `index.html`: Estructura base de la aplicación y definición de las vistas (Configuración, Canales, Reproductor y EPG).
- `config.xml`: Archivo de configuración del Widget de Tizen (definición de ID de aplicación, versión, orientación horizontal, permisos de red y accesos al sistema de archivos).
- `css/`:
  - `main.css`: Estilos visuales globales de la interfaz adaptados a una pantalla de TV (1920x1080).
  - `components.css`: Estilos para botones, inputs, modales y listas.
- `js/`:
  - [app.js](js/app.js): Controlador principal y enrutador de vistas (Setup, Canales, Reproductor y EPG).
  - [playlist.js](js/playlist.js): Módulo encargado de parsear archivos M3U8 y comunicarse con la API de Xtream Codes.
  - [m3u-worker.js](js/m3u-worker.js): Web Worker utilizado para el parseo asíncrono y de alto rendimiento de listas M3U8.
  - [epg.js](js/epg.js): Gestor de la guía de programación XMLTV/EPG.
  - [keyHandler.js](js/keyHandler.js): Mapeador de eventos y capturador de las teclas físicas del mando a distancia.
  - [player.js](js/player.js): Módulo de control de la API de Samsung AVPlayer.
  - [virtual-list.js](js/virtual-list.js): Renderizador virtual de lista de canales para soportar miles de elementos con memoria limitada.
  - [favorites.js](js/favorites.js): Persistencia y gestión de la lista de canales favoritos.
  - [storage.js](js/storage.js): Capa de abstracción para guardar datos y listas en el localStorage del televisor.
  - [search.js](js/search.js): Lógica de búsqueda y filtrado interactivo.

---

## 🎮 Controles del Mando a Distancia (D-Pad)

El manejo de la aplicación está optimizado para mandos a distancia estándar de Samsung Smart TV:

- **Cruceta (Arriba / Abajo)**: Desplazarse por la lista activa de canales o categorías.
- **Cruceta (Izquierda / Derecha)**: Mover el foco entre la barra lateral de grupos y la cuadrícula de canales.
- **ENTER / OK**: Reproducir el canal seleccionado o confirmar la selección de un grupo.
- **Botón Amarillo**: Añadir o quitar el canal enfocado a/de **Favoritos**.
- **Botón Rojo**: Abrir y cerrar la barra de búsqueda de canales.
- **Botón Verde**: Abrir la Guía de Programación completa (EPG).
- **Botón BACK / RETURN**:
  - Cerrar menús de búsqueda o pantallas secundarias.
  - En la vista principal, salir de la aplicación de Tizen.
- **Teclas de Canal (▲ / ▼)** (durante la reproducción): Cambiar al canal siguiente o anterior.
- **Botón INFO** (durante la reproducción): Mostrar u ocultar la barra de información del canal con la EPG.

---

## 💻 Desarrollo e Instalación en Tizen OS

Para desplegar y probar este proyecto en un televisor Samsung Smart TV real o en el emulador:

### Requisitos Previos
1. Instalar [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) con la extensión **Samsung TV Extension**.
2. Configurar la TV en **Modo Desarrollador** (Developer Mode) apuntando a la dirección IP de tu máquina de desarrollo.

### Despliegue
1. Clona este repositorio:
   ```bash
   git clone https://github.com/drosalop/IPTV-App.git
   ```
2. Abre Tizen Studio e importa el proyecto como un **Tizen Web Project**.
3. Asegúrate de generar y firmar la app con un **Certificate Profile** (de Samsung o Tizen) para poder instalarla.
4. Haz clic derecho sobre el proyecto en Tizen Studio, selecciona **Run As** -> **Tizen Web Application** para instalar y ejecutar en tu TV conectada.
5. Alternativamente, puedes generar el paquete `.wgt` y subirlo mediante la consola de comandos:
   ```bash
   tizen package -t wgt -o .
   tizen install -n IPTV-App.wgt -t <TV_Device_ID>
   ```
