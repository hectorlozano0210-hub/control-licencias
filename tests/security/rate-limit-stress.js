/**
 * Script de Verificación de Carga y Rate Limiting (Stress Test)
 * 
 * Uso:
 *   node tests/security/rate-limit-stress.js
 *   node tests/security/rate-limit-stress.js --url=http://localhost:3000/api/v1/license/activate --requests=25 --concurrency=5
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

// Parseo de argumentos de línea de comandos
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    acc[key] = val || true;
  }
  return acc;
}, {});

const TARGET_URL = args.url || process.env.TARGET_URL || "http://localhost:3000/api/v1/license/activate";
const TOTAL_REQUESTS = parseInt(args.requests || "25", 10);
const CONCURRENCY = parseInt(args.concurrency || "5", 10);
const SIMULATED_IP = args.ip || `198.51.100.${Math.floor(Math.random() * 200) + 10}`;

console.log("\n========================================================");
console.log("🛡️  SUITE DE ESTRÉS Y PRUEBA DE RATE LIMITING");
console.log("========================================================");
console.log(`🎯 Objetivo:           ${TARGET_URL}`);
console.log(`📦 Total Solicitudes:  ${TOTAL_REQUESTS}`);
console.log(`⚡ Concurrencia:       ${CONCURRENCY}`);
console.log(`🌐 IP Simulada:        ${SIMULATED_IP}`);
console.log("========================================================\n");

// Payload para prueba de activación
const payload = JSON.stringify({
  license_key: "TEST-XXXX-YYYY-ZZZZ",
  app_slug: "test-app",
  machine_fingerprint: "hwid_stress_test_device_12345",
  device_name: "StressTest-Node",
  app_version: "1.0.0",
});

function sendRequest(requestId) {
  return new Promise((resolve) => {
    const urlObj = new URL(TARGET_URL);
    const isHttps = urlObj.protocol === "https:";
    const client = isHttps ? https : http;

    const startTime = Date.now();
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "X-Forwarded-For": SIMULATED_IP,
        "User-Agent": "Security-Stress-Tester/1.0",
      },
      timeout: 5000,
    };

    const req = client.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const duration = Date.now() - startTime;
        resolve({
          id: requestId,
          status: res.statusCode,
          headers: {
            limit: res.headers["ratelimit-limit"],
            remaining: res.headers["ratelimit-remaining"],
            reset: res.headers["ratelimit-reset"],
            retryAfter: res.headers["retry-after"],
          },
          duration,
          body,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        id: requestId,
        status: 0,
        error: err.message,
        duration: Date.now() - startTime,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        id: requestId,
        status: 408,
        error: "TIMEOUT",
        duration: Date.now() - startTime,
      });
    });

    req.write(payload);
    req.end();
  });
}

async function runStressTest() {
  const results = [];
  let completed = 0;
  let running = 0;
  let index = 0;

  return new Promise((resolve) => {
    function next() {
      while (running < CONCURRENCY && index < TOTAL_REQUESTS) {
        index++;
        running++;
        const currentId = index;

        sendRequest(currentId).then((res) => {
          running--;
          completed++;
          results.push(res);

          const statusIcon = res.status === 429 ? "🛑 [429 BLOCKED]" : res.status === 200 ? "✅ [200 OK]" : `⚠️ [${res.status}]`;
          const rem = res.headers && res.headers.remaining !== undefined ? `Rem: ${res.headers.remaining}` : "";
          const reset = res.headers && res.headers.reset !== undefined ? `Reset: ${res.headers.reset}s` : "";

          console.log(
            `#${String(res.id).padStart(2, "0")} | ${statusIcon.padEnd(16)} | ${String(res.duration).padStart(4)}ms | ${rem.padEnd(10)} | ${reset}`
          );

          if (completed === TOTAL_REQUESTS) {
            resolve(results);
          } else {
            next();
          }
        });
      }
    }

    next();
  });
}

(async () => {
  try {
    const results = await runStressTest();

    const statusCounts = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const count429 = statusCounts[429] || 0;
    const countAllowed = TOTAL_REQUESTS - count429;
    const avgDuration = Math.round(results.reduce((acc, r) => acc + r.duration, 0) / results.length);

    console.log("\n========================================================");
    console.log("📊 RESUMEN EJECUTIVO DE LA PRUEBA DE ESTRÉS");
    console.log("========================================================");
    console.log(`Total Peticiones:        ${TOTAL_REQUESTS}`);
    console.log(`Peticiones Permitidas:   ${countAllowed}`);
    console.log(`Peticiones Bloqueadas:   ${count429} (HTTP 429 Too Many Requests)`);
    console.log(`Latencia Promedio:       ${avgDuration}ms`);
    console.log("Distribución de Códigos HTTP:", statusCounts);

    if (count429 > 0) {
      console.log("\n🎯 RESULTADO: ÉXITO. El Rate Limiter se activó correctamente.");
      console.log("Las políticas de estrangulamiento y defensa DDoS están operando.");
    } else {
      console.log("\n⚠️ AVISO: No se recibieron códigos 429.");
      console.log("Verifica que el servidor esté levantado o aumenta el número de peticiones con --requests=50.");
    }
    console.log("========================================================\n");
  } catch (error) {
    console.error("Error ejecutando la prueba de estrés:", error);
    process.exit(1);
  }
})();
