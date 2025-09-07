import express from 'express';
import { translate } from '../src/translate.js';

const app = express();
app.use(express.json());

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

    const result = await translate(text, source_lang, target_lang);
    
    res.status(200).json({
      code: 200,
      id: result.id,
      data: result.data,
      method: "Free",
      source_lang: result.source_lang,
      target_lang: result.target_lang,
      alternatives: result.alternatives
    });

  } catch (error) {
    console.error('[ERROR] API:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Internal server error'
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

// Обязательный экспорт для Vercel
export default app;
