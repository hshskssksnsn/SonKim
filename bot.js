const bedrock = require('bedrock-protocol');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');

// 1. Đọc file cấu hình config.json
let config;
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (e) {
  console.log(chalk.bold.red('[!] Lỗi: Không thể đọc file config.json!'));
  process.exit(1);
}

let client = null;
let isReconnecting = false;

// 2. Khởi tạo Terminal Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan('💬 [Gửi Game] > ')
});

// Tiêu đề giao diện
function printHeader() {
  console.clear();
  console.log(chalk.bold.green('===================================================='));
  console.log(chalk.bold.cyan ('   🤖 BOT MINECRAFT BEDROCK'));
  console.log(chalk.bold.green('===================================================='));
  console.log(chalk.gray(`📌 Server IP  : ${config.server_ip}:${config.server_port}`));
  console.log(chalk.gray(`🔄 Auto-Retry: ${config.reconnect_delay_ms / 1000}s`));
  console.log(chalk.bold.green('----------------------------------------------------'));
  console.log('');
}

// In log an toàn, không ghi đè lên dòng đang gõ
function log(msg) {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  console.log(msg);
  rl.prompt(true);
}

// Lắng nghe lệnh gõ từ Codespaces/Terminal
rl.on('line', (line) => {
  const text = line.trim();
  if (text.length > 0) {
    sendMessage(text);
    log(chalk.bold.green(`[Đã gửi] > `) + chalk.white(text));
  } else {
    rl.prompt(true);
  }
});

// 3. Khởi tạo kết nối Bot
function connectBot() {
  // [FIX BUG]: Xóa bỏ client cũ trước khi tạo kết nối mới để tránh lặp sự kiện và tràn RAM
  if (client) {
    try {
      client.removeAllListeners();
      client.close();
    } catch (e) {}
  }

  log(chalk.yellow(`[*] Đang kết nối tới ${config.server_ip}:${config.server_port}...`));

  try {
    client = bedrock.createClient({
      host: config.server_ip,
      port: config.server_port,
      offline: true,             // Đăng nhập acc Microsoft/Xbox
      profilesFolder: './auth'    // Lưu token đăng nhập tự động
    });
  } catch (err) {
    log(chalk.bold.red(`[!] Khởi tạo thất bại: ${err.message}`));
    reconnect();
    return;
  }

  // Khi vào server thành công
  client.on('join', () => {
    isReconnecting = false;
    log(chalk.bold.bgGreen.black(' ONLINE ') + chalk.green(` Bot đã tham gia server thành công!`));
    log(chalk.gray(`💡 Gõ lệnh/tin nhắn bên dưới rồi ấn Enter để gửi:`));
    rl.prompt(true);
  });

  // Lắng nghe tin nhắn từ game
  client.on('text', (packet) => {
    const message = packet.message;
    const sender = packet.source_name;

    if (!message || !sender) return;

    const formattedSender = chalk.bold.magenta(`<${sender}>`);
    const formattedMsg = chalk.white(message);
    log(chalk.blue('📩 [CHAT] ') + `${formattedSender} ${formattedMsg}`);
  });

  // Khi bị ngắt kết nối
  client.on('disconnect', (packet) => {
    log(chalk.bold.bgRed.white(' DISCONNECT ') + chalk.red(` Lý do: ${packet.reason || 'Không xác định'}`));
    reconnect();
  });

  // Khi gặp lỗi kết nối
  client.on('error', (err) => {
    log(chalk.bold.bgRed.white(' ERROR ') + chalk.red(` Lỗi: ${err.message || err}`));
    reconnect();
  });
}

// 4. Tự động kết nối lại (Auto Reconnect)
function reconnect() {
  if (isReconnecting) return;
  isReconnecting = true;

  const delay = config.reconnect_delay_ms || 5000;
  log(chalk.yellow(`⏳ Sẽ tự động kết nối lại sau ${delay / 1000} giây...`));

  setTimeout(() => {
    connectBot();
  }, delay);
}

// 5. Gửi tin nhắn / lệnh vào game
function sendMessage(text) {
  if (!client) {
    log(chalk.red('[!] Bot chưa sẵn sàng!'));
    return;
  }
  try {
    client.write('text', {
      type: 'chat',
      needs_translation: false,
      source_name: '',
      xuid: '',
      platform_chat_id: '',
      message: text
    });
  } catch (err) {
    log(chalk.red('[!] Bị mất kết nối, không thể gửi lệnh.'));
  }
}

// Khởi chạy ứng dụng
printHeader();
connectBot();
