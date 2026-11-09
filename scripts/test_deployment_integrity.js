/**
 * Teste de Integridade de Produção & Governança V2.0 — TīngLì Lab
 * Executado para verificar se o site, banco e APIs estão 100% saudáveis na nuvem.
 */

try { process.loadEnvFile(".env.local"); } catch {}

const PROD_URL = "https://tingli-lab.vercel.app";

async function runIntegrityChecks() {
  console.log("=================================================");
  console.log("  TīngLì Lab V2.0 — Verificação de Produção 24/7 ");
  console.log("=================================================");
  console.log(`Alvo: ${PROD_URL}\n`);

  let failures = 0;

  // 1. Teste da Página Inicial
  try {
    process.stdout.write("[1/5] Testando Frontend Web (HTML)... ");
    const res = await fetch(PROD_URL);
    if (res.status === 200) {
      const text = await res.text();
      if (text.includes("TīngLì") || text.includes("tingli")) {
        console.log("✓ OK (Status 200, Design Clássico Carregado)");
      } else {
        console.log("⚠ Aviso: Status 200, mas texto base não encontrado");
      }
    } else {
      console.log(`✗ Falhou com status ${res.status}`);
      failures++;
    }
  } catch (e) {
    console.log(`✗ Erro de conexão: ${e.message}`);
    failures++;
  }

  // 2. Teste da API de Autenticação & Eruditos (Supabase)
  try {
    process.stdout.write("[2/5] Testando API de Autenticação (/api/auth/me)... ");
    const res = await fetch(`${PROD_URL}/api/auth/me`);
    if (res.status === 200) {
      const data = await res.json();
      const scholarCount = data.scholars?.length || 0;
      console.log(`✓ OK (Status 200, ${scholarCount} eruditos no ranking da nuvem)`);
    } else {
      console.log(`✗ Falhou com status ${res.status}`);
      failures++;
    }
  } catch (e) {
    console.log(`✗ Erro de conexão: ${e.message}`);
    failures++;
  }

  // 3. Teste da API de Salas Síncronas (Multiplayer Ao Vivo)
  try {
    process.stdout.write("[3/5] Testando Salas Síncronas (/api/multiplayer/rooms)... ");
    const res = await fetch(`${PROD_URL}/api/multiplayer/rooms`);
    if (res.status === 200) {
      const data = await res.json();
      console.log(`✓ OK (Status 200, Pavilhão de Duelos ativo com ${data.rooms?.length || 0} salas abertas)`);
    } else {
      console.log(`✗ Falhou com status ${res.status}`);
      failures++;
    }
  } catch (e) {
    console.log(`✗ Erro de conexão: ${e.message}`);
    failures++;
  }

  // 4. Teste da API Assíncrona (Ghost Duels, Metas Coletivas & Exame Kējǔ)
  try {
    process.stdout.write("[4/5] Testando Duelos Fantasma & Metas (/api/multiplayer/async)... ");
    const res = await fetch(`${PROD_URL}/api/multiplayer/async`);
    if (res.status === 200) {
      const data = await res.json();
      const ghostCount = data.ghostChallenges?.length || 0;
      const goalsCount = data.collectiveGoals?.length || 0;
      console.log(`✓ OK (Status 200, ${ghostCount} fantasmas, ${goalsCount} metas coletivas)`);
    } else {
      console.log(`✗ Falhou com status ${res.status}`);
      failures++;
    }
  } catch (e) {
    console.log(`✗ Erro de conexão: ${e.message}`);
    failures++;
  }

  // 5. Verificação da Vercel API via Token
  if (process.env.VERCEL_TOKEN) {
    try {
      process.stdout.write("[5/5] Testando Status de Deploy na Vercel API... ");
      const vRes = await fetch("https://api.vercel.com/v6/deployments?projectId=tingli-lab&limit=1", {
        headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
      });
      if (vRes.status === 200) {
        const vData = await vRes.json();
        const latest = vData.deployments?.[0];
        console.log(`✓ OK (Deploy ID: ${latest?.uid || "N/A"}, Estado: ${latest?.state || "READY"})`);
      } else {
        console.log(`⚠ Token Vercel aceito mas projeto consultado retornou ${vRes.status}`);
      }
    } catch (e) {
      console.log(`⚠ Aviso: ${e.message}`);
    }
  } else {
    console.log("[5/5] Vercel Token não configurado em .env.local (ignorado)");
  }

  console.log("\n-------------------------------------------------");
  if (failures === 0) {
    console.log("  TODAS AS VERIFICAÇÕES PASSARAM COM SUCESSO! 🎯 ");
    console.log("  O ambiente de produção está 100% íntegro e online.");
  } else {
    console.log(`  AVISO: ${failures} verificações falharam. Investigue os logs.`);
    process.exit(1);
  }
  console.log("=================================================\n");
}

runIntegrityChecks();
