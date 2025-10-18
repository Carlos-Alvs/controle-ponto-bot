const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- Configurações principais ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID_RECEIVE = process.env.CHANNEL_ID_RECEIVE;
const CHANNEL_ID_REPORT = process.env.CHANNEL_ID_REPORT;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const META_SEMANAL = 7; // Meta semanal em horas
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

// --- Dependência dinâmica ---
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// --- Utilitário ---
function timeToMinutes(timeStr) {
  const [h, m, s] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0) + ((s || 0) / 60);
}

// --- Cálculo das horas semanais ---
function calcularHorasSemanais(logs, dataInicio, dataFim) {
  const usuarios = {};

  logs.forEach((log) => {
    const match = log.match(/🕘 (.+) \((\d+)\) => Data: (\d{1,2}\/\d{1,2}\/\d{4}) \| (ENTRADA|SAIDA): (\d{1,2}:\d{1,2}:\d{1,2})/);
    if (!match) return;

    const [, nome, id, data, tipo, hora] = match;
    const key = `${nome}|${id}`;
    if (!usuarios[key]) usuarios[key] = [];
    usuarios[key].push({ data, tipo, hora });
  });

  const resultados = [];
  const agora = new Date();

  for (const key in usuarios) {
    const [nome, id] = key.split('|');
    const registros = usuarios[key].sort(
      (a, b) =>
        new Date(a.data.split('/').reverse().join('-')) - new Date(b.data.split('/').reverse().join('-')) ||
        timeToMinutes(a.hora) - timeToMinutes(b.hora)
    );

    let totalMinutos = 0;
    let emServico = false;

    for (let i = 0; i < registros.length; i++) {
      const atual = registros[i];
      const proximo = registros[i + 1];

      if (atual.tipo === 'ENTRADA') {
        let entrada = timeToMinutes(atual.hora);
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

    const horas = (totalMinutos / 60).toFixed(2);
    const metaCumprida = horas >= META_SEMANAL ? '✅ Meta cumprida' : '❌ Meta não atingida';
    const observacao = emServico ? ' (Em serviço)' : '';
    resultados.push(`${nome} | ${id} trabalhou ${horas}h nos últimos 7 dias. ${metaCumprida}${observacao}`);
  }

  const inicioFormatado = dataInicio.toLocaleDateString('pt-BR');
  const fimFormatado = dataFim.toLocaleDateString('pt-BR');
  return [`Relatório de metas semana do dia ${inicioFormatado} a ${fimFormatado}`, ...resultados].join('\n');
}

// --- Leitura de logs (Gist) ---
async function obterLogsDoGist() {
  try {
    const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });
    const data = await resp.json();
    return data.files['logs.txt']?.content?.split('\n').filter(Boolean) || [];
  } catch (err) {
    console.error('⚠️ Falha ao ler Gist:', err);
    return [];
  }
}

// --- Atualização do Gist ---
async function atualizarGist(novaLinha) {
  try {
    const atual = await obterLogsDoGist();
    const atualizado = [...atual, novaLinha].join('\n');

    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: { 'logs.txt': { content: atualizado } }
      })
    });

    console.log('☁️ Log sincronizado no Gist:', novaLinha);
  } catch (err) {
    console.error('❌ Erro ao atualizar Gist:', err);
  }
}

// --- Geração de relatório ---
async function gerarRelatorio(channel) {
  const conteudo = await obterLogsDoGist();
  if (!conteudo.length) return channel.send('❌ Nenhum log encontrado no Gist.');

  const agora = new Date();
  const dataFim = agora;
  const dataInicio = new Date();
  dataInicio.setDate(dataFim.getDate() - 7);

  const relatorio = calcularHorasSemanais(conteudo, dataInicio, dataFim);
  await channel.send('```' + relatorio + '```');
}

// --- Slash Command ---
const commands = [{ name: 'relatorio', description: 'Gera manualmente o relatório semanal de metas.' }];
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registrarComandos() {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Comando /relatorio registrado.');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
}

// --- Cron semanal (sábado 23h) ---
cron.schedule('0 23 * * 6', async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID_REPORT);
    await gerarRelatorio(channel);
  } catch (err) {
    console.error('[CRON ERROR]', err);
  }
});

// --- Comando manual /relatorio ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === 'relatorio') {
    try {
      await interaction.deferReply({ ephemeral: false });
      const channel = await client.channels.fetch(CHANNEL_ID_REPORT);
      const conteudo = await obterLogsDoGist();

      if (!conteudo.length) {
        await interaction.editReply('❌ Nenhum log encontrado no Gist.');
        return;
      }

      const agora = new Date();
      const dataFim = agora;
      const dataInicio = new Date();
      dataInicio.setDate(dataFim.getDate() - 7);

      const relatorio = calcularHorasSemanais(conteudo, dataInicio, dataFim);
      await interaction.editReply('```' + relatorio + '```');
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      if (interaction.deferred || interaction.replied)
        await interaction.editReply('❌ Ocorreu um erro ao gerar o relatório.');
      else
        await interaction.reply('❌ Ocorreu um erro ao gerar o relatório.');
    }
  }
});

// --- Recebe logs do canal e envia pro Gist ---
client.on('messageCreate', async (msg) => {
  try {
    if (msg.author?.bot) return;
    if (!CHANNEL_ID_RECEIVE || msg.channel.id !== CHANNEL_ID_RECEIVE) return;

    const texto = msg.content.trim();
    const regex = /🕘 (.+) \((\d+)\) => Data: (\d{1,2}\/\d{1,2}\/\d{4}) \| (ENTRADA|SAIDA): (\d{1,2}:\d{1,2}:\d{1,2})/;
    if (!regex.test(texto)) return;

    console.log('✅ Log recebido:', texto);
    await atualizarGist(texto);
  } catch (err) {
    console.error('Erro ao processar mensagem de log:', err);
  }
});

// --- Inicialização ---
client.once('ready', async () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
  await registrarComandos();
});

// --- Servidor Express (Render keep-alive) ---
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
app.listen(3000, () => console.log('🌐 Servidor Express ativo'));

// --- Auto-ping ---
const pingTimer = require('node-cron');
pingTimer.schedule('*/5 * * * *', () => {
  fetch('https://controle-ponto-bot.onrender.com').catch(() => {});
});

client.login(TOKEN);
