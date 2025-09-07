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
    const result = await translate(text, srcLang, tgtLang);

    // 4. Отладка: посмотрим, что возвращает translate()
    console.log("DEBUG [api/translate.js]: translate() returned:", JSON.stringify(result, null, 2));

    // 5. Проверка, что результат не пустой
    if (!result || (!result.data && !result.translated_text)) {
        console.error("ERROR [api/translate.js]: translate() returned empty or invalid result");
        return res.status(500).json({
            code: 500,
            message: "Translation failed or returned empty result"
        });
    }

    // 6. Формирование ответа (адаптируйте под формат, который возвращает ваша функция translate)
    // Пример 1: Если translate() возвращает { data, source_lang, target_lang, id, alternatives }
    if (result.data !== undefined) {
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
    // Пример 2: Если translate() возвращает { translated_text, src_lang, tgt_lang }
    else if (result.translated_text !== undefined) {
        return res.status(200).json({
            code: 200,
            id: Date.now(),
            data: result.translated_text,
            method: "Free",
            source_lang: result.src_lang || srcLang,
            target_lang: result.tgt_lang || tgtLang,
            alternatives: result.alternatives || []
        });
    }
    // Пример 3: Если translate() возвращает просто строку
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
    // Если формат неизвестен
    else {
        console.error("ERROR [api/translate.js]: Unknown result format from translate():", result);
        return res.status(500).json({
            code: 500,
            message: "Unknown result format from translation function"
        });
    }

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
