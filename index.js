const { Client, GatewayIntentBits } = require('discord.js');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const cron = require('node-cron');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Substitua pelo seu token
const TOKEN = 'MTQyODIxMDYzMjM2NDM5MjYxOA.GDtPCN.TTqcbvSwAwwiBbtRVczsrY73U9c59DZlLkqJnw';

//Filtrar canal
const ID_CANAL_LOGS = '1428187842432995539'; // substitua pelo ID do canal onde os logs são enviados

client.on('messageCreate', msg => {
  // filtra apenas o canal desejado
  if (msg.channel.id !== ID_CANAL_LOGS) return;

  processarMensagem(msg);
});





//Canal de report
const ID_CANAL_REPORT = '1428222155690344529';

// Estrutura de armazenamento temporário (pode depois usar JSON ou DB)
let registros = {};

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});



// Função para processar logs
function processarMensagem(mensagem) {
  // Exemplo: 🕘 Julio Cesar (425) => Data: 26/4/2025 | ENTRADA: 19:46:11
  const regex = /🕘 (.+) \((\d+)\) => Data: (\d{1,2}\/\d{1,2}\/\d{4}) \| (ENTRADA|SAIDA): (\d{2}:\d{2}:\d{2})/;
  const match = mensagem.content.match(regex);
  if (!match) return;

  const [_, nome, id, data, tipo, hora] = match;

  if (!registros[id]) registros[id] = [];
  let registroDia = registros[id].find(r => r.data === data);
  if (!registroDia) registroDia = { data, entrada: null, saida: null, nome };
  
  if (tipo === 'ENTRADA') registroDia.entrada = hora;
  else registroDia.saida = hora;

  // Atualiza
  const index = registros[id].findIndex(r => r.data === data);
  if (index !== -1) registros[id][index] = registroDia;
  else registros[id].push(registroDia);
}

// Função para calcular horas
function calcularHoras(data, entrada, saida) {
  if (!entrada || !saida) return 0;

  const inicio = dayjs(`${data} ${entrada}`, 'D/M/YYYY HH:mm:ss');
  const fim = dayjs(`${data} ${saida}`, 'D/M/YYYY HH:mm:ss');

  return fim.diff(inicio, 'minute') / 60; // horas
}

// Cron para sexta-feira às 09:00 '0 9 * * 5'    -> teste minuto> '0 * * * * *'
cron.schedule('0 9 * * 5', async () => {
  const canal = await client.channels.fetch(ID_CANAL_REPORT);
  const hoje = dayjs();
  const seteDias = hoje.subtract(7, 'day');

  for (const id in registros) {
    let horasTotais = 0;
    registros[id].forEach(r => {
      const dataRegistro = dayjs(r.data, 'D/M/YYYY');
      if (dataRegistro.isAfter(seteDias)) {
        horasTotais += calcularHoras(r.data, r.entrada, r.saida);
      }
    });
    await canal.send(`${registros[id][0].nome} trabalhou ${horasTotais.toFixed(2)}h nos últimos 7 dias. ${horasTotais >= 7 ? '✅ Meta cumprida' : '❌ Meta não atingida'}`);
  }
});

// Captura mensagens do canal
client.on('messageCreate', msg => {
  processarMensagem(msg);
});

client.login(TOKEN);
