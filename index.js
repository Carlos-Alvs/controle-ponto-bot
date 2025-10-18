const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // necessário para ler o texto das mensagens
  ],
});

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID_RECEIVE = process.env.CHANNEL_ID_RECEIVE; // canal onde o bot lê os logs
const CHANNEL_ID_REPORT = process.env.CHANNEL_ID_REPORT;   // canal onde o bot envia relatórios
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const META_SEMANAL = 7; // Meta semanal em horas

// utils
function timeToMinutes(timeStr) {
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 60 + m + (s ? s / 60 : 0);
}

function calcularHorasSemanais(logs, dataInicio, dataFim) {
  const usuarios = {};

  logs.forEach((log) => {
    const match = log.match(/🕘 (.+) \((\d+)\) => Data: (\d{1,2}\/\d{1,2}\/\d{4}) \| (ENTRADA|SAIDA): (\d{2}:\d{2}:\d{2})/);
    if (!match) return;

    const [, nome, id, data, tipo, hora] = match;
    const key = `${nome}|${id}`;
    if (!usuarios[key]) usuarios[key] = [];
    usuarios[key].push({ data, tipo, hora });
  });

  const resultados = [];

  for (const key in usuarios) {
    const [nome, id] = key.split('|');
    const registros = usuarios[key].sort(
      (a, b) =>
        new Date(a.data.split('/').reverse().join('-')) - new Date(b.data.split('/').reverse().join('-')) ||
        timeToMinutes(a.hora) - timeToMinutes(b.hora)
    );

    let totalMinutos = 0;
    for (let i = 0; i < registros.length - 1; i++) {
      const atual = registros[i];
      const proximo = registros[i + 1];

      if (atual.tipo === 'ENTRADA' && proximo.tipo === 'SAIDA') {
        let entrada = timeToMinutes(atual.hora);
        let saida = timeToMinutes(proximo.hora);
        if (saida < entrada) saida += 24 * 60; // virada de dia
        totalMinutos += saida - entrada;
        i++; // pulamos o próximo porque já emparelhamos
      }
    }

    const horas = (totalMinutos / 60).toFixed(2);
    const metaCumprida = horas >= META_SEMANAL ? '✅ Meta cumprida' : '❌ Meta não atingida';
    resultados.push(`${nome} | ${id} trabalhou ${horas}h nos últimos 7 dias. ${metaCumprida}`);
  }

  const inicioFormatado = dataInicio.toLocaleDateString('pt-BR');
  const fimFormatado = dataFim.toLocaleDateString('pt-BR');
  return [`Relatório de metas semana do dia ${inicioFormatado} a ${fimFormatado}`, ...resultados].join('\n');
}

async function gerarRelatorio(channel) {
  const logsPath = path.join(process.cwd(), 'logs.txt');
  if (!fs.existsSync(logsPath)) return channel.send('❌ Nenhum log encontrado.');

  const conteudo = fs.readFileSync(logsPath, 'utf-8').split('\n').filter(Boolean);
  const agora = new Date();
  const dataFim = agora;
  const dataInicio = new Date();
  dataInicio.setDate(dataFim.getDate() - 7);

  const relatorio = calcularHorasSemanais(conteudo, dataInicio, dataFim);

  // envia tudo em uma única mensagem
  await channel.send('```' + relatorio + '```');
}

// --- Slash Command /relatorio ---
const commands = [
  {
    name: 'relatorio',
    description: 'Gera manualmente o relatório semanal de metas.',
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registrarComandos() {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Comando /relatorio registrado.');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
}

// --- Cron Job semanal (// Cron sexta 09:00 '0 9 * * 5' -> sabado 23:00 '0 23 * * 6' -> teste minuto> '0 * * * * *') ---
cron.schedule('0 23 * * 6', async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID_REPORT);
    await gerarRelatorio(channel);
  } catch (err) {
    console.error('[CRON ERROR]', err);
  }
});

// --- Listener para o comando /relatorio ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === 'relatorio') {
    await interaction.reply('🕒 Gerando relatório, aguarde...');
    const channel = await client.channels.fetch(CHANNEL_ID_REPORT);
    await gerarRelatorio(channel);
  }
});

// --- Listener para receber logs no canal especificado ---
client.on('messageCreate', async (msg) => {
  try {
    // ignora bots (inclusive o próprio)
    if (msg.author?.bot) return;

    // filtra só o canal de logs
    if (!CHANNEL_ID_RECEIVE || msg.channel.id !== CHANNEL_ID_RECEIVE) return;

    const texto = msg.content.trim();

    // valida o formato antes de gravar (evita lixo no arquivo)
    const regex = /🕘 (.+) \((\d+)\) => Data: (\d{1,2}\/\d{1,2}\/\d{4}) \| (ENTRADA|SAIDA): (\d{2}:\d{2}:\d{2})/;
    if (!regex.test(texto)) {
      // opcional: reaja para avisar formato inválido
      // await msg.react('⚠️');
      return;
    }

    // grava no logs.txt — append com nova linha
    const logsPath = path.join(process.cwd(), 'logs.txt');
    fs.appendFileSync(logsPath, texto + '\n', { encoding: 'utf8' });

    // opcional: confirma no próprio canal (descomente se quiser confirmação)
    // await msg.react('✅');

    console.log('Log gravado:', texto);
  } catch (err) {
    console.error('Erro ao processar mensagem de log:', err);
  }
});

client.once('ready', async () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
  await registrarComandos();
});


const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot online!'));
app.listen(3000, () => console.log('🌐 Servidor Express ativo'));

const pingTimer = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// A cada 5 minutos, faz um ping em si mesmo para evitar hibernação
pingTimer.schedule('*/5 * * * *', () => {
  fetch('https://controle-ponto-bot.onrender.com').catch(() => {});

});


client.login(TOKEN);
