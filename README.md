# ⚡ TRUENO INVENTARIO - BACKEND REST API
Sistema Empresarial de Gestión de Inventario, Ventas, Clientes y Créditos.  
Construido con **Node.js**, **Express.js**, **MongoDB Atlas** y **Mongoose**.

---

## 📋 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
3. [Requisitos Previos](#-requisitos-previos)
4. [Instalación y Configuración](#-instalación-y-configuración)
5. [Variables de Entorno](#-variables-de-entorno)
6. [Conexión con MongoDB Atlas](#-conexión-con-mongodb-atlas)
7. [Migración de Datos (`localStorage.json`)](#-migración-de-datos-localstoragejson)
8. [Ejecución](#-ejecución)
9. [Catálogo de Endpoints REST](#-catálogo-de-endpoints-rest)
10. [Modelos y Estructura de Datos](#-modelos-y-estructura-de-datos)
11. [Reglas de Negocio y Seguridad](#-reglas-de-negocio-y-seguridad)
12. [Pruebas Automatizadas](#-pruebas-automatizadas)

---

## 📖 Descripción General

Trueno Backend es la plataforma centralizada para la persistencia, validación y sincronización de datos de **Trueno Inventario 219**. Reemplaza por completo el almacenamiento local efímero (`localStorage`) por una base de datos distribuida en la nube con **MongoDB Atlas**, garantizando consistencia transaccional, seguridad en autenticación mediante **JWT + bcrypt** y reglas de negocio para inventario multinivel (tienda y bodega), ventas y abonos a deudas.

---

## 🏗️ Arquitectura del Proyecto

```text
trueno-backend/
│
├── src/
│   ├── config/
│   │   └── database.js               # Conexión centralizada y eventos de MongoDB Atlas
│   │
│   ├── models/                       # Modelos Mongoose con esquemas e índices optimizados
│   │   ├── User.js                   # Usuarios y autenticación
│   │   ├── Product.js                # Catálogo de productos y stock dual (tienda/bodega)
│   │   ├── Client.js                 # Directorio de clientes
│   │   ├── Sale.js                   # Ventas, detalle de items y métodos de pago
│   │   ├── Debt.js                   # Deudas generadas y abonos parciales
│   │   ├── InventoryMovement.js      # Auditoría de entradas, salidas y transferencias
│   │   ├── Category.js               # Categorías del inventario
│   │   ├── Config.js                 # Ajustes de tienda y contadores secuenciales
│   │   └── PendingSale.js            # Ventas pausadas / en espera
│   │
│   ├── controllers/                  # Controladores de solicitudes HTTP
│   │   ├── auth.controller.js
│   │   ├── product.controller.js
│   │   ├── client.controller.js
│   │   ├── sale.controller.js
│   │   ├── debt.controller.js
│   │   ├── payment.controller.js
│   │   ├── inventory.controller.js
│   │   ├── category.controller.js
│   │   ├── config.controller.js
│   │   └── dashboard.controller.js
│   │
│   ├── routes/                       # Enrutamiento modular con prefijo /api/
│   │   ├── auth.routes.js
│   │   ├── product.routes.js
│   │   ├── client.routes.js
│   │   ├── sale.routes.js
│   │   ├── debt.routes.js
│   │   ├── payment.routes.js
│   │   ├── inventory.routes.js
│   │   ├── category.routes.js
│   │   ├── config.routes.js
│   │   └── dashboard.routes.js
│   │
│   ├── middlewares/                  # Filtros y validaciones
│   │   ├── auth.js                   # Autenticación JWT y roles RBAC
│   │   ├── errorHandler.js           # Manejo global y centralizado de excepciones
│   │   └── validate.js               # Validación de esquemas y tipos en request body
│   │
│   ├── services/                     # Lógica de negocio y transacciones
│   │   ├── inventory.service.js      # Movimientos de stock y transferencias bodega
│   │   ├── sale.service.js           # Procesamiento de venta, deducción y créditos
│   │   ├── debt.service.js           # Registro de abonos y recálculo de saldos
│   │   └── dashboard.service.js      # Agregaciones analíticas y métricas
│   │
│   ├── utils/                        # Funciones auxiliares y estandarización
│   │   ├── helpers.js                # Generador de tokens, paginación, async handler
│   │   └── apiResponse.js            # Respuestas HTTP uniformes (success, paginated, error)
│   │
│   ├── validators/                   # Esquemas declarativos de validación
│   │   ├── auth.validators.js
│   │   ├── product.validators.js
│   │   ├── client.validators.js
│   │   └── sale.validators.js
│   │
│   ├── scripts/                      # Scripts de mantenimiento y migración
│   │   ├── seedFromLocalStorage.js   # Migrador idempotente de datos
│   │   ├── checkSeedStatus.js        # Verificador de integridad en base de datos
│   │   └── testSuite.js              # Suite de pruebas automatizadas
│   │
│   ├── app.js                        # Configuración de Express, middlewares y rutas
│   └── server.js                     # Punto de entrada y graceful shutdown
│
├── localStorage.json                 # Fuente original de datos a migrar
├── .env                              # Variables de entorno (ignorado en git)
├── .env.example                      # Plantilla de variables de entorno
├── .gitignore                        # Archivos y carpetas excluidas de git
├── package.json                      # Manifiesto y dependencias del proyecto
└── README.md                         # Documentación técnica completa
```

---

## 💻 Requisitos Previos

- **Node.js**: v18.0.0 o superior (Recomendado v20+ o v24).
- **npm**: v9.0.0 o superior.
- **Cuenta en MongoDB Atlas** (Cluster gratuito M0 o superior).

---

## 🚀 Instalación y Configuración

1. **Clonar o ingresar al directorio del backend:**
   ```bash
   cd trueno-backend
   ```

2. **Instalar dependencias de producción:**
   ```bash
   npm install
   ```

3. **Configurar el archivo de variables de entorno:**
   Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

---

## 🔐 Variables de Entorno

Edita el archivo `.env` con los valores correspondientes:



## ☁️ Conexión con MongoDB Atlas

1. Ingresa a tu consola de [MongoDB Atlas](https://cloud.mongodb.com/).
2. En **Security > Database Access**, crea un usuario con privilegios de lectura/escritura (`readWriteAnyDatabase`).
3. En **Security > Network Access**, agrega tu dirección IP actual o `0.0.0.0/0` (permitir acceso desde cualquier IP).
4. En **Deployment > Database**, pulsa en **Connect > Drivers > Node.js**.
5. Copia la URI de conexión resultante y reemplázala en el valor de `MONGODB_URI` en tu archivo `.env`.

---

## 🔄 Migración de Datos (`localStorage.json`)

El script de migración analiza el archivo `localStorage.json` existente e inserta todos los registros en MongoDB Atlas de forma **idempotente** (evita duplicados si se ejecuta múltiples veces) y **resuelve referencias relacionales**:

### Ejecución de la Migración:
```bash
npm run seed
```

El script ejecutará las siguientes fases:
1. Conexión segura con el cluster de MongoDB Atlas.
2. Lectura y validación de `localStorage.json`.
3. Creación o vinculación del usuario administrador.
4. Sincronización de configuración de tienda (`trueno_config`) y contadores secuenciales (`trueno_id_counters`).
5. Extracción y registro de categorías únicas.
6. Inserción de los **477 productos** con preservación de `originalId`, stock de tienda y stock de bodega.
7. Inserción de los **48 clientes** con historiales de compra.
8. Inserción de las **73 ventas** con vinculación a sus respectivos clientes y productos.
9. Inserción de las **36 deudas** y sus correspondientes abonos históricos, vinculándolas a las ventas.
10. Registro de movimientos iniciales de auditoría de inventario.
11. Generación de reporte en `migration-report.json`.

### Verificación de Estado:
```bash
npm run seed:check
```

---

## 🏃 Ejecución

### Modo Desarrollo (con reinicio automático por nodemon):
```bash
npm run dev
```

### Modo Producción:
```bash
npm start
```

El servidor quedará disponible en: `http://localhost:3000/api`

---

## 📡 Catálogo de Endpoints REST

Todas las respuestas tienen un formato JSON estándar:
```json
{
  "success": true,
  "message": "Descripción de la operación",
  "data": { ... }
}
```

### 1. Autenticación (`/api/auth`)
| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/auth/register` | Registro de nuevo usuario | Público |
| POST | `/api/auth/login` | Inicio de sesión y entrega de JWT | Público |
| GET | `/api/auth/me` | Perfil y configuración del usuario activo | Privado |
| POST | `/api/auth/logout` | Cierre de sesión | Privado |

### 2. Productos e Inventario (`/api/products`)
| Método | Endpoint | Query Params | Descripción |
|---|---|---|---|
| GET | `/api/products` | `search`, `category`, `lowStock`, `page`, `limit`, `all` | Lista productos con filtros |
| GET | `/api/products/:id` | - | Obtener producto por ObjectId o ID original |
| POST | `/api/products` | - | Crear nuevo producto con ID auto-incremental |
| PUT | `/api/products/:id` | - | Actualizar producto existente |
| DELETE | `/api/products/:id` | - | Eliminar producto |

### 3. Clientes (`/api/clients`)
| Método | Endpoint | Query Params | Descripción |
|---|---|---|---|
| GET | `/api/clients` | `search`, `all`, `page`, `limit` | Listado de clientes |
| GET | `/api/clients/:id` | - | Detalle de cliente |
| POST | `/api/clients` | - | Registrar nuevo cliente |
| PUT | `/api/clients/:id` | - | Actualizar datos del cliente |
| DELETE | `/api/clients/:id` | - | Eliminar cliente |
| GET | `/api/clients/:id/sales` | - | Historial de compras del cliente |
| GET | `/api/clients/:id/debts` | - | Historial de créditos/deudas del cliente |

### 4. Ventas (`/api/sales`)
| Método | Endpoint | Query Params | Descripción |
|---|---|---|---|
| GET | `/api/sales` | `status`, `paymentMethod`, `startDate`, `endDate`, `all` | Listado de ventas realizadas |
| GET | `/api/sales/:id` | - | Detalle de una venta con productos y deuda |
| POST | `/api/sales` | - | Registrar venta (descuenta stock, crea crédito si aplica) |
| POST | `/api/sales/:id/cancel` | - | Anular venta y restituir stock en bodega/tienda |

### 5. Deudas y Abonos (`/api/debts`, `/api/payments`)
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/debts` | Listado de deudas (filtros por `status`: `pendiente`, `pagada`, `vencida`) |
| GET | `/api/debts/:id` | Detalle de una deuda con desglose de abonos |
| POST | `/api/debts` | Crear una deuda manual |
| POST | `/api/debts/:id/payments` | Registrar abono a una deuda específica |
| GET | `/api/payments` | Historial global de todos los abonos efectuados |
| POST | `/api/payments` | Registrar un nuevo abono |

### 6. Movimientos de Inventario (`/api/inventory`)
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/inventory` | Estado general de existencias y valoración de inventario |
| POST | `/api/inventory/movements` | Registro de entrada, salida o ajuste manual de stock |
| GET | `/api/inventory/movements` | Registro histórico de auditoría de movimientos |
| POST | `/api/inventory/transfer` | Transferir unidades entre Tienda y Bodega |

### 7. Categorías y Configuración (`/api/categories`, `/api/config`)
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/categories` | Obtener categorías disponibles |
| POST | `/api/categories` | Crear nueva categoría |
| DELETE | `/api/categories/:name` | Eliminar categoría |
| GET | `/api/config` | Obtener ajustes de la tienda (impuestos, moneda, umbral) |
| PUT | `/api/config` | Actualizar ajustes de la tienda |

### 8. Métricas del Dashboard (`/api/dashboard`)
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/dashboard/summary` | Resumen ejecutivo: ventas hoy/mes, alertas stock bajo, top 5 más vendidos, deudas pendientes |

---

## 🛡️ Reglas de Negocio y Seguridad

1. **Gestión Dual de Stock**: Los productos manejan `stock` (disponible en mostrador) y `warehouseStock` (reserva en bodega). Las ventas descuentan directamente del stock de mostrador.
2. **Generación Automática de Créditos**: Cuando una venta se realiza con método `Crédito` o el monto pagado es inferior al total, el sistema crea automáticamente una `Debt` con su saldo pendiente y la asocia a la venta.
3. **Consistencia en Abonos**: Al abonar a una deuda, el sistema actualiza automáticamente el saldo (`balance`), cambia el estado a `pagada` si llega a 0, y actualiza la venta original a `pagada`.
4. **Protección Multicapa**:
   - Cabeceras HTTP endurecidas con `helmet`.
   - Sanitización contra inyección de operadores NoSQL con `express-mongo-sanitize`.
   - Limitador de tasa contra ataques de fuerza bruta (`express-rate-limit`).
   - Autenticación asimétrica basada en `Bearer Token` JWT.
   - Aislamiento multi-usuario: todas las consultas validan la pertenencia del documento al usuario autenticado (`user: req.user._id`).

---

## 🧪 Pruebas Automatizadas

El proyecto incluye una suite de pruebas de integración completa ejecutada sobre una base de datos en memoria:

```bash
npm test
```

Verifica:
- Registro y hashing con bcrypt.
- Generación y expiración de JWT.
- Integración de los 477 productos, 48 clientes, 73 ventas y 36 deudas de `localStorage.json`.
- Descuento de existencias al vender.
- Generación y saldo de créditos.
- Abonos y finiquito de deudas.
- Transferencia tienda <-> bodega.
- Cálculo de métricas del dashboard.

