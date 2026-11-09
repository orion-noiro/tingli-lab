import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

// Usando o Connection Pooler IPv4 da Supabase para a região us-east-2 (Ohio)
const connectionString = "postgresql://postgres.doizxoucpuaipitlvfvx:uNK0vVup5BrgFnmW@aws-0-us-east-2.pooler.supabase.com:6543/postgres";

async function main() {
  console.log("Conectando ao banco Supabase...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Conexão bem sucedida!");

    const schemaPath = path.join(process.cwd(), "scripts", "supabase_schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");

    console.log("Executando scripts/supabase_schema.sql...");
    await client.query(sql);
    console.log("Schema executado com sucesso!");

    // Verificar tabelas criadas
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("Tabelas no schema public:");
    res.rows.forEach((r) => console.log(" - " + r.table_name));

    // Verificar metas coletivas inseridas
    const goals = await client.query("SELECT id, title_pt, target_value FROM public.collective_goals;");
    console.log("Metas coletivas encontradas:", goals.rows.length);
  } catch (err) {
    console.error("Erro durante a configuração:", err);
  } finally {
    await client.end();
  }
}

main();
