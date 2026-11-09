import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function test() {
  console.log("Testando conexão REST com Supabase...");
  const { data, error } = await supabase.from("collective_goals").select("*");
  if (error) {
    console.error("Erro na consulta (as tabelas podem ainda estar sendo criadas):", error.message);
  } else {
    console.log("Sucesso! Metas encontradas no banco remoto:", data.length);
    data.forEach(g => console.log(" - " + g.title_pt));
  }
}

test();
