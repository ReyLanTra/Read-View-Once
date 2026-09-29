import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pino from "pino";
import qrcode from "qrcode-terminal";
import {
  DisconnectReason,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const SESSION_DIR = "session";
const LOG_FILE = path.join(process.cwd(), "logs.txt");
const CMDS = new Set(["/rvo", "/viewonce", "/readviewonce"]);

// ── Warna ANSI (tanpa dependensi tambahan) ──
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
};

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Tulis ke terminal (berwarna) + logs.txt (polos).
function log(level, msg) {
  const tag = {
    INFO: `${C.cyan}INFO ${C.reset}`,
    OK: `${C.green} OK  ${C.reset}`,
    WARN: `${C.yellow}WARN ${C.reset}`,
    ERROR: `${C.red}FAIL ${C.reset}`,
    CMD: `${C.magenta} CMD ${C.reset}`,
    QR: `${C.blue} QR  ${C.reset}`,
  }[level] ?? `${C.gray} LOG ${C.reset}`;
  console.log(`${C.gray}[${ts()}]${C.reset} ${tag} ${msg}`);
  try {
    fs.appendFileSync(LOG_FILE, `[${ts()}] [${level.trim()}] ${stripAnsi(msg)}\n`);
  } catch {}
}

function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, "");
}

function line(char = "─", len = 52) {
  return `${C.gray}${char.repeat(len)}${C.reset}`;
}

function banner() {
  console.log(`
${C.cyan}${C.bold}  ╔══════════════════════════════════════════════════╗
  ║   ${C.white}R E A D – V I E W – O N C E${C.cyan}${C.bold}                    ║
  ║   ${C.dim}Bot WhatsApp · Pembuka Media Sekali-Lihat${C.reset}${C.cyan}${C.bold}      ║
  ╠══════════════════════════════════════════════════╣
  ║   ${C.reset}${C.gray}cmd : /rvo  /viewonce  /readviewonce${C.cyan}${C.bold}         ║
  ║   ${C.reset}${C.gray}reply ke pesan view-once untuk membuka medianya${C.cyan}${C.bold} ║
  ╚══════════════════════════════════════════════════╝${C.reset}
`);
}

function menuBox() {
  console.log(`  ${C.bold}${C.white}METODE KONEKSI${C.reset}`);
  console.log(`  ${line("─", 50)}`);
  console.log(`   ${C.green}${C.bold}[1]${C.reset}  Scan QR            ${C.dim}— cepat, tanpa nomor${C.reset}`);
  console.log(`   ${C.green}${C.bold}[2]${C.reset}  Pairing Code       ${C.dim}— tautkan via kode 8 digit${C.reset}`);
  console.log(`  ${line("─", 50)}`);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => (rl.close(), res(a.trim()))));
}

async function askMode() {
  menuBox();
  for (;;) {
    const a = await ask(`  ${C.cyan}➜${C.reset} Pilih metode ${C.dim}[1/2, default 1]${C.reset}: `);
    if (a === "" || a === "1") return "qr";
    if (a === "2") return "pairing";
    console.log(`  ${C.red}Pilihan tidak valid. Ketik 1 atau 2.${C.reset}`);
  }
}

async function askPhone() {
  for (;;) {
    const raw = await ask(`  ${C.cyan}➜${C.reset} Nomor WA bot ${C.dim}(cth 62812xxxxxxx)${C.reset}: `);
    const phone = raw.replace(/\D/g, "");
    if (phone.length >= 8 && phone.length <= 16) return phone;
    console.log(`  ${C.red}Nomor tidak valid. Gunakan format 628xx tanpa +/spasi.${C.reset}`);
  }
}

// ── Util pesan ──
function unwrap(msg) {
  let m = msg;
  while (m) {
    if (m.ephemeralMessage) m = m.ephemeralMessage.message;
    else if (m.viewOnceMessage) m = m.viewOnceMessage.message;
    else if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
    else if (m.viewOnceMessageV2Extension) m = m.viewOnceMessageV2Extension.message;
    else break;
  }
  return m;
}

function getQuotedViewOnce(msg) {
  const ctx =
    msg?.extendedTextMessage?.contextInfo ??
    msg?.imageMessage?.contextInfo ??
    msg?.videoMessage?.contextInfo ??
    msg?.audioMessage?.contextInfo ??
    null;
  const quoted = ctx?.quotedMessage;
  if (!quoted || !ctx?.stanzaId) return null;
  const inner = unwrap(quoted);
  if (inner?.imageMessage || inner?.videoMessage || inner?.audioMessage) return { inner };
  return null;
}

function getText(msg) {
  return (
    msg?.conversation ??
    msg?.extendedTextMessage?.text ??
    msg?.imageMessage?.caption ??
    msg?.videoMessage?.caption ??
    ""
  ).trim();
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function downloadQuotedMedia(inner) {
  const kind = inner.imageMessage ? "image" : inner.videoMessage ? "video" : "audio";
  const stream = await downloadContentFromMessage(inner[kind + "Message"], kind, {});
  return streamToBuffer(stream);
}

function chatLabel(jid = "") {
  if (jid.endsWith("@g.us")) return "Grup";
  if (jid.includes("newsletter")) return "Saluran";
  return "Pribadi";
}

function shortJid(jid = "") {
  return jid.split("@")[0].split(":")[0];
}

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;

// ── Koneksi ──
let MODE = "qr";
let PHONE = "";

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ["Read-View-Once", "Chrome", "1.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  if (MODE === "pairing" && !state.creds.registered) {
    try {
      log("INFO", `Meminta pairing code untuk ${C.bold}${PHONE}${C.reset} ...`);
      const code = await sock.requestPairingCode(PHONE);
      console.log(`\n  ${C.bold}${C.green}╔══ Pairing Code: ${code} ══╗${C.reset}\n`);
      log("INFO", `WA > Perangkat Tertaut > Tautkan dengan nomor telepon > masukkan kode di atas.`);
    } catch (e) {
      log("ERROR", `Gagal minta pairing code: ${stripAnsi(e?.message ?? e)}`);
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr && MODE === "qr") {
      log("QR", "QR baru diterima, scan dengan WA bot:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      log("OK", `Terhubung sebagai ${C.bold}${sock.user?.id ? shortJid(sock.user.id) : "?"}${C.reset}. Menunggu pesan berisi cmd...`);
      console.log(`  ${line("─", 50)}`);
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message ?? "unknown";
      if (code === DisconnectReason.loggedOut) {
        log("ERROR", "Sesi logout. Hapus isi folder session/ lalu hubungkan ulang.");
        return;
      }
      log("WARN", `Koneksi putus (${stripAnsi(reason)}). Reconnect 3 detik...`);
      setTimeout(connect, 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      try {
        if (m.key.remoteJid === "status@broadcast") continue;
        const msg = m.message;
        if (!msg) continue;
        const body = unwrap(msg) ?? msg;
        const text = getText(body).toLowerCase();
        if (!CMDS.has(text)) continue; // tanpa cmd / cmd salah: diam.

        const sender = shortJid(m.key.participant || m.key.remoteJid || "?");
        const chat = `${chatLabel(m.key.remoteJid)} ${shortJid(m.key.remoteJid)}`;
        log("CMD", `${C.bold}${text}${C.reset} dari ${C.yellow}${m.pushName || sender}${C.reset} (${sender}) di ${C.cyan}${chat}${C.reset}`);

        const found = getQuotedViewOnce(body);
        if (!found) {
          log("WARN", "Bukan reply view-once (image/video/audio). Diabaikan.");
          continue;
        }

        const kind = found.inner.imageMessage ? "gambar" : found.inner.videoMessage ? "video" : "audio";
        log("INFO", `Download media sekali-lihat (${kind})...`);
        const buffer = await downloadQuotedMedia(found.inner);
        if (!buffer?.length) {
          log("ERROR", "Download gagal / buffer kosong.");
          continue;
        }
        log("INFO", `Download OK (${kb(buffer.length)}). Mengirim ulang sebagai pesan biasa...`);

        const jid = m.key.remoteJid;
        const quote = { quoted: m };
        const { inner } = found;

        if (inner.imageMessage) {
          await sock.sendMessage(jid, { image: buffer, caption: inner.imageMessage.caption || "" }, quote);
        } else if (inner.videoMessage) {
          await sock.sendMessage(jid, { video: buffer, caption: inner.videoMessage.caption || "" }, quote);
        } else if (inner.audioMessage) {
          await sock.sendMessage(
            jid,
            { audio: buffer, mimetype: inner.audioMessage.mimetype || "audio/ogg; codecs=opus", ptt: inner.audioMessage.ptt || false },
            quote
          );
        }
        log("OK", `Terkirim ke ${C.cyan}${chat}${C.reset}.`);
      } catch (e) {
        log("ERROR", `Gagal proses: ${stripAnsi(e?.message ?? e)}`);
      }
    }
  });
}

async function main() {
  banner();
  try {
    fs.appendFileSync(LOG_FILE, `\n===== SESSION ${ts()} =====\n`);
  } catch {}

  // Shortcut non-interaktif tetap didukung: --pairing / PAIRING_NUMBER.
  const args = process.argv.slice(2);
  const cliPhone = (process.env.PAIRING_NUMBER || args[args.indexOf("--pairing") + 1] || "").replace(/\D/g, "");
  const wantPairing = args.includes("--pairing") || Boolean(process.env.PAIRING_NUMBER);

  // Sesi lama: langsung connect tanpa menu.
  const credsPath = path.join(SESSION_DIR, "creds.json");
  const hasSession = fs.existsSync(credsPath);

  if (wantPairing && cliPhone) {
    MODE = "pairing";
    PHONE = cliPhone;
    log("INFO", `Mode: pairing (via arg/env) → ${C.bold}${PHONE}${C.reset}`);
  } else if (hasSession) {
    MODE = "qr"; // mode tidak relevan bila sesi ada; QR tidak diminta ulang.
    log("INFO", "Sesi ditemukan di folder session/. Langsung menghubungkan...");
  } else {
    MODE = await askMode();
    log("INFO", `Mode dipilih: ${C.bold}${MODE === "qr" ? "Scan QR" : "Pairing Code"}${C.reset}`);
    if (MODE === "pairing") {
      PHONE = await askPhone();
      log("INFO", `Nomor bot: ${C.bold}${PHONE}${C.reset}`);
    } else {
      console.log(`\n  ${C.dim}Scan QR di bawah dengan WA bot.${C.reset}\n`);
    }
  }

  log("INFO", "Menghubungkan ke WhatsApp...");
  await connect();
}

main();
