const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID_RECEIVE = process.env.CHANNEL_ID_RECEIVE;
const CHANNEL_ID_REPORT = process.env.CHANNEL_ID_REPORT;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const META_SEMANAL = 7; // horas

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



// ---------------- GIST ----------------
async function obterLogsDoGist() {
  try {
    const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
    });
    if (!resp.ok) {
      console.error('❌ Falha ao ler Gist:', resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    const conteudo = data.files['logs.txt']?.content || '';
    return conteudo.split('\n').filter(Boolean);
  } catch (err) {
    console.error('⚠️ Erro ao ler Gist:', err);
    return [];
  }
}

async function atualizarGist(linha) {
  try {
    const logsAtuais = await obterLogsDoGist();
    const novoConteudo = [...logsAtuais, linha].join('\n');

    const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: { 'logs.txt': { content: novoConteudo } } }),
    });

    if (!resp.ok) {
      console.error('❌ Falha ao atualizar Gist:', resp.status, await resp.text());
    } else {
      console.log('☁️ Gist atualizado:', linha);
    }
  } catch (err) {
    console.error('❌ Erro ao atualizar Gist:', err);
  }
}

// ---------------- CÁLCULO ----------------
function timeToMinutes(timeStr) {
  const [h, m, s] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0) + ((s || 0) / 60);
}

function calcularHorasSemanais(logs, inicio, fim) {
  const usuarios = {};

  // Agrupa por usuário e por data
  logs.forEach((linha) => {
    const match = linha.match(/🕘 (.+) \((\d+)\) => Data: (\d{1,2}\/\d{1,2}\/\d{4}) \| (ENTRADA|SAIDA): (\d{1,2}:\d{1,2}:\d{1,2})/);
    if (!match) return;
    const [, nome, id, data, tipo, hora] = match;
    const chave = `${nome}|${id}`;
    if (!usuarios[chave]) usuarios[chave] = {};
    if (!usuarios[chave][data]) usuarios[chave][data] = [];
    usuarios[chave][data].push({ tipo, hora });
  });

  const resultados = [];
  const agora = new Date();

  for (const chave in usuarios) {
    const [nome, id] = chave.split('|');
    let totalMinutos = 0;
    let emServico = false;

    for (const data in usuarios[chave]) {
      const registros = usuarios[chave][data].sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));

      for (let i = 0; i < registros.length; i++) {
        if (registros[i].tipo === 'ENTRADA') {
          const entrada = timeToMinutes(registros[i].hora);
          const proximo = registros[i + 1];
          let saida;

          if (proximo && proximo.tipo === 'SAIDA') {
            saida = timeToMinutes(proximo.hora);
            i++;
          } else {
            const horaAgora = agora.getHours().toString().padStart(2, '0') + ':' +
              agora.getMinutes().toString().padStart(2, '0') + ':' +
              agora.getSeconds().toString().padStart(2, '0');
            saida = timeToMinutes(horaAgora);
            emServico = true;
          }

          if (saida < entrada) saida += 24 * 60;
          totalMinutos += saida - entrada;
        }
      }
    }

    const horas = (totalMinutos / 60).toFixed(2);
    const metaCumprida = horas >= META_SEMANAL ? '✅ Meta cumprida' : '❌ Meta não atingida';
    resultados.push(`${nome} | ${id} trabalhou ${horas}h nos últimos 7 dias. ${metaCumprida}${emServico ? ' (Em serviço)' : ''}`);
  }

  const inicioF = inicio.toLocaleDateString('pt-BR');
  const fimF = fim.toLocaleDateString('pt-BR');
  return [`Relatório de metas semana do dia ${inicioF} a ${fimF}`, ...resultados].join('\n');
}

// ---------------- RELATÓRIO ----------------
async function gerarRelatorio(channel) {
  const logs = await obterLogsDoGist();
  if (!logs.length) return channel.send('❌ Nenhum log encontrado no Gist.');

  const agora = new Date();
  const fim = agora;
  const inicio = new Date();
  inicio.setDate(fim.getDate() - 7);

  const relatorio = calcularHorasSemanais(logs, inicio, fim);
  await channel.send('```' + relatorio + '```');
}

// ---------------- COMANDOS ----------------
const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(TOKEN);
const commands = [{ name: 'relatorio', description: 'Gera manualmente o relatório semanal de metas.' }];

async function registrarComandos() {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Comando /relatorio registrado.');
  } catch (err) {
    console.error('Erro ao registrar comandos:', err);
  }
}

// ---------------- LISTENERS ----------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== 'relatorio') return;

  try {
    await interaction.deferReply();
    const logs = await obterLogsDoGist();
    if (!logs.length) {
      await interaction.editReply('❌ Nenhum log encontrado no Gist.');
      return;
    }

    const agora = new Date();
    const fim = agora;
    const inicio = new Date();
    inicio.setDate(fim.getDate() - 7);

    const relatorio = calcularHorasSemanais(logs, inicio, fim);
    await interaction.editReply('```' + relatorio + '```');
  } catch (err) {
    console.error('Erro ao gerar relatório:', err);
    try {
      if (interaction.deferred || interaction.replied)
        await interaction.editReply('❌ Erro ao gerar o relatório.');
    } catch {}
  }
});

client.on('messageCreate', async (msg) => {
  try {
    if (msg.author?.bot) return;
    if (!CHANNEL_ID_RECEIVE || msg.channel.id !== CHANNEL_ID_RECEIVE) return;

    const texto = msg.content.trim();
    const regex = /🕘 (.+) \((\d+)\) => Data: (\d{1,2}\/\d{1,2}\/\d{4}) \| (ENTRADA|SAIDA): (\d{1,2}:\d{1,2}:\d{1,2})/;
    if (!regex.test(texto)) return;

    console.log('🕘 Log capturado:', texto);
    await atualizarGist(texto);
  } catch (err) {
    console.error('Erro ao processar mensagem:', err);
  }
});

// ---------------- AGENDAMENTO ----------------
cron.schedule('0 23 * * 6', async () => {
  try {
    const canal = await client.channels.fetch(CHANNEL_ID_REPORT);
    await gerarRelatorio(canal);
  } catch (err) {
    console.error('[CRON ERROR]', err);
  }
});

// ---------------- BOOT ----------------
client.once('ready', async () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
  await registrarComandos();
});

// ---------------- EXPRESS KEEP-ALIVE ----------------
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
app.listen(3000, () => console.log('🌐 Servidor Express ativo'));

cron.schedule('*/5 * * * *', () => {
  fetch('https://controle-ponto-bot.onrender.com').catch(() => {});
});

client.login(TOKEN);
