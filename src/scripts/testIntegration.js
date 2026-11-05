// =====================================================================
// TRUENO INVENTARIO - Integration & Health Endpoint Verification
// =====================================================================

const app = require('../app');
const http = require('http');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runIntegrationTests() {
  console.log('====================================================');
  console.log('🧪 VERIFICACIÓN DE ENDPOINTS Y HEALTH CHECK');
  console.log('====================================================\n');

  // Start test server on dynamic ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health check on /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, '/api/health responde con HTTP 200');
    assert(healthData.success === true, '/api/health data.success === true');
    assert(healthData.status === 'online', '/api/health data.status === "online"');

    // 2. Health check on /health (Render compatibility)
    const rootHealthRes = await fetch(`${baseUrl}/health`);
    const rootHealthData = await rootHealthRes.json();
    assert(rootHealthRes.status === 200, '/health responde con HTTP 200');
    assert(rootHealthData.success === true, '/health data.success === true');

    // 3. Unauthenticated requests to protected endpoints should return 401
    const protectedRoutes = [
      '/api/products',
      '/api/clients',
      '/api/sales',
      '/api/debts',
      '/api/settings',
      '/api/pending-sales',
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${baseUrl}${route}`);
      assert(res.status === 401, `Ruta protegida ${route} rechaza acceso sin token (HTTP 401)`);
    }

    // 4. Auth validation: empty login body
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(loginRes.status === 400, 'POST /api/auth/login sin datos retorna HTTP 400');

    // 5. CORS headers test
    const corsRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://trueno-frontend.onrender.com' },
    });
    assert(corsRes.headers.get('access-control-allow-origin') === 'https://trueno-frontend.onrender.com', 'CORS permite origen frontend de Render');

    console.log('\n====================================================');
    console.log(`🎯 RESULTADOS: ${passed}/${passed + failed} PRUEBAS EXITOSAS`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error durante pruebas de integración:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

runIntegrationTests();

