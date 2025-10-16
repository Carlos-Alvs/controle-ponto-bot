<h1 align="center">🕘 Controle de Ponto Bot - Discord</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js" />
  <img src="https://img.shields.io/badge/discord.js-v14-blue?logo=discord" />
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow" />
</p>

<p align="center">
  Um bot de Discord que interpreta logs de entrada e saída e gera relatórios semanais de horas trabalhadas.  
</p>

---

## 🚀 **Funcionalidades**

✅ Lê mensagens em um canal no formato:
```
🕘 Nome (ID) => Data: DD/MM/YYYY | ENTRADA: HH:MM:SS
🕘 Nome (ID) => Data: DD/MM/YYYY | SAIDA: HH:MM:SS
```

✅ Calcula o total de horas trabalhadas nos últimos **7 dias**  
✅ Envia um **relatório semanal toda sexta-feira** em um canal definido  
✅ Indica quem **bateu ou não a meta de 7h trabalhadas**  
✅ Salva logs localmente para acompanhamento  

---

## ⚙️ **Tecnologias Utilizadas**

| Tecnologia | Descrição |
|-------------|------------|
| [Node.js](https://nodejs.org) | Ambiente de execução JavaScript |
| [discord.js](https://discord.js.org/) | Biblioteca para integração com Discord |
| [dayjs](https://day.js.org/) | Manipulação de datas e horários |
| [node-cron](https://www.npmjs.com/package/node-cron) | Agendamento de tarefas semanais |

---

## 🧩 **Configuração do Projeto**

### 1️⃣ Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/controle-ponto-bot.git
cd controle-ponto-bot
```

### 2️⃣ Instalar dependências

```bash
npm install
```

### 3️⃣ Configurar o bot

Edite o arquivo `index.js` e insira o seu token e IDs de canais:

```js
const TOKEN = "SEU_TOKEN_DO_BOT";
const ID_CANAL_LOGS = "ID_DO_CANAL_DE_LOGS";
const ID_CANAL_REPORT = "ID_DO_CANAL_DE_REPORT";
```

> 💡 **Dica:** Você pode criar um arquivo `.env` e usar a lib `dotenv` para manter o token seguro.

---

## 🧠 **Como Funciona**

1. O bot monitora o canal definido (`ID_CANAL_LOGS`)  
2. Quando uma mensagem de **entrada** ou **saída** é registrada, ele armazena os dados localmente  
3. Toda sexta-feira, ele verifica as horas acumuladas de cada colaborador  
4. Gera e envia um **relatório semanal** no canal de reports  

---

## 📅 **Formato Esperado das Mensagens**

```
🕘 Julio Cesar (425) => Data: 26/4/2025 | ENTRADA: 19:46:11
🕘 Julio Cesar (425) => Data: 26/4/2025 | SAIDA: 22:30:00
```

---

## 🧾 **Exemplo de Relatório**

```
📊 Relatório Semanal (últimos 7 dias):

✅ Maria Silva trabalhou 7.25h nos últimos 7 dias. Meta atingida!
✅ Carlos Alves trabalhou 8.10h nos últimos 7 dias. Meta atingida!
❌ Julio Cesar trabalhou 3.50h nos últimos 7 dias. Meta não atingida.
```

---

## 🔒 **Permissões Necessárias no Discord**

Ative as seguintes intents no [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications):

- ✅ **Message Content Intent**
- ✅ **Guild Messages**
- ✅ **Guilds**

---

## 🧑‍💻 **Autor**

**Carlos Alves**  
💼 *Analista de TI*  


---

<p align="center">
  Feito com 🚬 e ☕ por <b>Carlinhos</b>
</p>
