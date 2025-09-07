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

    // 1. Проверка обязательных параметров
    if (!text) {
      return res.status(400).json({
        code: 400,
        message: 'Text is required'
      });
    }

    // 2. Установка значений по умолчанию
    const srcLang = source_lang || 'AUTO';
    const tgtLang = target_lang || 'EN';

    // 3. Вызов функции перевода
    console.log(`[API] Starting translation: "${text}" from ${srcLang} to ${tgtLang}`);
    const result = await translate(text, srcLang, tgtLang);
    console.log(`[API] Translation function returned:`, JSON.stringify(result, null, 2));

    // 4. Проверка, что результат не пустой
    if (!result) {
        console.error("[API ERROR] translate() returned null/undefined");
        return res.status(500).json({
            code: 500,
            message: "Translation failed - no result returned"
        });
    }

    // 5. Если функция возвращает объект с полем data
    if (typeof result === 'object' && result.data) {
        return res.status(200).json({
            code: result.code || 200,
            id: result.id || Date.now(),
            data: result.data,
            method: "Free",
            source_lang: result.source_lang || srcLang,
            target_lang: result.target_lang || tgtLang,
            alternatives: result.alternatives || []
        });
    }
    // 6. Если функция возвращает объект с полем translated_text
    else if (typeof result === 'object' && result.translated_text) {
        return res.status(200).json({
            code: 200,
            id: Date.now(),
             result.translated_text,
            method: "Free",
            source_lang: result.source_lang || srcLang,
            target_lang: result.target_lang || tgtLang,
            alternatives: result.alternatives || []
        });
    }
    // 7. Если функция возвращает просто строку (прямой перевод)
    else if (typeof result === 'string') {
        return res.status(200).json({
            code: 200,
            id: Date.now(),
            data: result,
            method: "Free",
            source_lang: srcLang,
            target_lang: tgtLang,
            alternatives: []
        });
    }
    // 8. Если формат неизвестен
    else {
        console.error("[API ERROR] Unknown result format from translate():", result);
        return res.status(500).json({
            code: 500,
            message: "Translation failed - unknown result format"
        });
    }

  } catch (error) {
    console.error('[API ERROR] /translate:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Internal server error during translation'
    });
  }
});

// GET /test - тестовый эндпоинт
app.get('/test', (req, res) => {
  res.status(200).json({
    code: 200,
    message: "API is working correctly!",
     "DeepLX Serverless API Test"
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
