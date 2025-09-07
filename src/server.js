import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { brotliCompress, brotliDecompress } from 'zlib';
import { translate } from './translate.js';
import 'dotenv/config';

// 解析参数
const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    describe: 'Service port number',
    coerce: check_port,
    default: Number(process.env.PORT) || 6119
  })
  .option('alt', {
    alias: 'a',
    describe: 'Return alternatives translation',
    type: 'boolean',
    default: Boolean(process.env.ALTERNATIVE) || true
  })
  .option('cors', {
    alias: 'c',
    describe: 'Origin that allow cross-domain access',
    coerce: check_cors,
    default: process.env.CORS_ORIGIN || false
  })
  .help().alias('help', 'h')
  .argv;

// 定义配置
const PORT = argv.port,
  returnAlternative = argv.alt,
  CORS = {
    origin: argv.cors,
    methods: 'GET,POST',
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false
  };

// Создаем Express app
const app = express();
app.use(cors(CORS));
app.use(bodyParser.json());

// POST /translate - основной эндпоинт перевода
app.post('/translate', async (req, res) => {
  const startTime = Date.now();

  let { text, source_lang, target_lang, alt_count } = req.body;
  
  // Проверка параметров
  if (!text) {
    const duration = Date.now() - startTime;
    console.log(`[WARN] ${new Date().toISOString()} | POST "translate" | 400 | Bad Request | ${duration}ms`);
    return res.status(400).json({
      code: 400,
      message: "Text is required"
    });
  }

  // Установка значений по умолчанию
  source_lang = source_lang ? source_lang.toUpperCase() : 'AUTO';
  target_lang = target_lang ? target_lang.toUpperCase() : 'EN';

  try {
    const result = await translate(text, source_lang, target_lang, alt_count);
    
    let duration = Date.now() - startTime;
    
    // Обработка ошибок
    if (result.code === 429) {
      console.error(`[WARN] ${new Date().toISOString()} | POST "translate" | 429 | ${result.message} | ${duration}ms`);
      return res.status(429).json({
        code: 429,
        message: result.message
      });
    }
    
    if (!result || !result.data) {
      console.error(`[ERROR] ${new Date().toISOString()} | POST "translate" | 500 | Translation failed | ${duration}ms`);
      return res.status(500).json({
        code: 500,
        message: "Translation failed"
      });
    }
    
    console.log(`[LOG] ${new Date().toISOString()} | POST "translate" | 200 | ${duration}ms`);

    const responseData = {
      code: result.code || 200,
      id: result.id,
      data: result.data,
      method: "Free",
      source_lang: result.source_lang || source_lang,
      target_lang: target_lang,
      alternatives: (returnAlternative ? result.alternatives : [])
    };

    res.json(responseData);

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] ${new Date().toISOString()} | POST "translate" | 500 | ${err.message} | ${duration}ms`);
    console.error(err.stack);
    res.status(500).json({
      code: 500,
      message: err.message || "Internal server error"
    });
  }
});

// GET / - приветственное сообщение
app.get('/', (req, res) => {
  res.status(200).json({
    code: 200,
    message: "Welcome to the DeepL Free API. Please POST to '/translate'. Visit 'https://github.com/guobao2333/DeepLX-Serverless' for more information."
  });
});

// Функции проверки параметров
function check_cors(arg) {
  if (arg === undefined) return false;
  if (typeof arg === 'string' || typeof arg === 'boolean') return arg;

  console.error("ParamTypeError: '" + arg + "', origin should be Boolean or String.\neg: '*' or true or RegExp");
  return false;
}

function check_port(arg) {
  if (typeof arg === 'number' && !isNaN(arg) && Number.isInteger(arg) && arg >= 0 && arg <= 65535) return arg;

  console.warn('WARNING: port should be >= 0 and < 65536.\nUsed default value instead: 6119\n');
  return 6119;
}

// Экспорт Express приложения для Vercel
export default app;

// Запуск сервера локально (только если не на Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
