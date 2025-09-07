// /api/translate.js
import express from 'express';
import { translate } from '../src/translate.js';

const app = express();
app.use(express.json());

// --- CORS Middleware ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// --- Маршруты ---
// ВНИМАНИЕ: Префикс /api НЕ нужен, так как vercel.json уже направляет все запросы сюда

// POST /translate - основной эндпоинт перевода
app.post('/translate', async (req, res) => {
  try {
    const { text, source_lang, target_lang } = req.body;

    if (!text) {
      return res.status(400).json({
        code: 400,
        message: 'Text is required'
      });
    }

    // Установка значений по умолчанию, если они не переданы
    const srcLang = source_lang || 'AUTO';
    const tgtLang = target_lang || 'EN';

    const result = await translate(text, srcLang, tgtLang);

    res.status(200).json({
      code: 200,
      id: result.id,
      data: result.data,
      method: "Free",
      source_lang: result.source_lang,
      target_lang: result.target_lang,
      alternatives: result.alternatives || []
    });

  } catch (error) {
    console.error('[ERROR] API /translate:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Internal server error'
    });
  }
});

// GET /test - тестовый эндпоинт
app.get('/test', (req, res) => {
  res.status(200).json({
    code: 200,
    message: "API is working correctly!",
    data: "DeepLX Serverless API Test"
  });
});

// GET / - приветственное сообщение
app.get('/', (req, res) => {
  res.status(200).json({
    code: 200,
    message: "Welcome to the DeepL Free API. Please POST to '/translate'. Visit 'https://github.com/guobao2333/DeepLX-Serverless' for more information."
  });
});

// Обязательный экспорт для Vercel
export default app;
