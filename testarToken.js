// testarToken.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const TOKEN = process.env.GITHUB_TOKEN; // coloque seu token no .env
const GIST_ID = process.env.GIST_ID;    // ou cole direto aqui

// --- TESTE AUTOMÁTICO DE TOKEN/GIST NO RENDER ---
async function testarTokenRender() {
  const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
  const TOKEN = process.env.GITHUB_TOKEN;
  const GIST_ID = process.env.GIST_ID;

  if (!TOKEN || !GIST_ID) {
    console.error('⚠️ GITHUB_TOKEN ou GIST_ID não definidos — teste ignorado.');
    return;
  }

  try {
    console.log('🔍 Testando token de acesso (Render)...');

    const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'User-Agent': 'controle-ponto-bot'
      },
    });

    if (!resp.ok) {
      console.error(`❌ Falha ao ler Gist (${resp.status}):`, await resp.text());
      return;
    }

    const gist = await resp.json();
    console.log('✅ Gist acessado com sucesso! Arquivos:', Object.keys(gist.files));

    // Teste de escrita (acrescenta uma linha de status)
    const linhaTeste = `Teste Render OK em ${new Date().toLocaleString('pt-BR')}`;
    const novoConteudo = (gist.files['logs.txt']?.content || '') + '\n' + linhaTeste;

    const patchResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'controle-ponto-bot'
      },
      body: JSON.stringify({
        files: { 'logs.txt': { content: novoConteudo } }
      }),
    });

    if (!patchResp.ok) {
      console.error(`❌ Falha ao atualizar Gist (${patchResp.status}):`, await patchResp.text());
    } else {
      console.log('☁️ Teste Render OK: Gist atualizado com sucesso.');
    }
  } catch (err) {
    console.error('❌ Erro ao testar token no Render:', err);
  }
}

// Executa o teste uma vez no início
testarTokenRender();


if (!TOKEN || !GIST_ID) {
  console.error("❌ Erro: GITHUB_TOKEN ou GIST_ID não definido no .env");
  process.exit(1);
}

(async () => {
  try {
    console.log("🔍 Testando token de acesso...");

    // 1️⃣ Verifica se consegue ler o Gist
    const getResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "User-Agent": "controle-ponto-bot",
      },
    });

    if (!getResp.ok) {
      console.error(`❌ Falha ao ler Gist (${getResp.status}):`, await getResp.text());
      return;
    }

    const gist = await getResp.json();
    console.log(`✅ Gist acessado com sucesso! Arquivos disponíveis:`);
    console.log(Object.keys(gist.files));

    // 2️⃣ Teste opcional: tenta escrever uma linha temporária (não obrigatório)
    const testLine = `Teste do bot em ${new Date().toLocaleString("pt-BR")}`;
    const newContent = (gist.files["logs.txt"]?.content || "") + "\n" + testLine;

    const patchResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "controle-ponto-bot",
      },
      body: JSON.stringify({
        files: {
          "logs.txt": {
            content: newContent,
          },
        },
      }),
    });

    if (!patchResp.ok) {
      console.error(`❌ Falha ao atualizar Gist (${patchResp.status}):`, await patchResp.text());
      return;
    }

    console.log("☁️ Teste bem-sucedido: o Gist foi atualizado!");
  } catch (err) {
    console.error("⚠️ Erro inesperado:", err);
  }
})();