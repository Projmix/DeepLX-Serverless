// src/translate.js
import axios from 'axios';
import { brotliDecompress } from 'zlib';
import { promisify } from 'util'; // Для промисификации brotliDecompress

const decompressAsync = promisify(brotliDecompress);

// Исправлены URL (убраны лишние пробелы)
const baseURL = 'https://www2.deepl.com';
// const proURL = 'https://api.deepl.com'; // Не используются в текущем коде
// const freeURL = 'https://api-free.deepl.com'; // Не используются в текущем коде

/**
 * Форматирует строку POST запроса, имитируя поведение браузерного расширения DeepL.
 * @param {Object} postData - Объект данных для отправки.
 * @returns {string} - Отформатированная строка JSON.
 */
function formatPostString(postData) {
  // Сначала работаем с объектом
  let id = postData.id;
  // Затем сериализуем
  let bodyString = JSON.stringify(postData);
  // Определяем формат для "method" на основе ID
  let methodStr = ((id + 5) % 29 === 0 || (id + 3) % 13 === 0) ? '"method" : "' : '"method": "';
  // Заменяем в сериализованной строке
  bodyString = bodyString.replace('"method":"', methodStr);
  // console.log("Formatted body string:", bodyString); // Для отладки
  return bodyString;
}

/**
 * Отправляет запрос к API DeepL.
 * @param {Object} postData - Данные для отправки.
 * @param {string} urlMethod - Метод API (не используется напрямую в текущей логике).
 * @param {string} [dlSession] - Сессионный cookie.
 * @param {boolean} [printResult] - Флаг для печати результата.
 * @returns {Promise<Object>} - Ответ от API.
 */
async function sendRequest(postData, urlMethod, dlSession, printResult) {
  // Исправлен URL (убраны лишние пробелы)
  const urlFull = `${baseURL}/jsonrpc`; // Убран лишний '?' в конце

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'DeepLBrowserExtension/1.28.0 Mozilla/5.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.deepl.com',
    'Referer': 'https://www.deepl.com/',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    ...(dlSession && { 'Cookie': `dl_session=${dlSession}` })
  };

  // Форматируем тело запроса
  const postDataString = formatPostString(postData);
  // console.warn("Sending POST data:", postDataString); // Для отладки

  try {
    const response = await axios.post(urlFull, postDataString, {
      headers: headers,
      responseType: 'arraybuffer' // Важно для обработки brotli
    });

    // Проверяем кодировку ответа
    if (response.headers['content-encoding'] === 'br') {
      try {
        // Декомпрессируем данные
        const decompressedBuffer = await decompressAsync(response.data);
        // Парсим JSON из буфера
        const jsonData = JSON.parse(decompressedBuffer.toString());
        if(printResult) console.log("Decompressed response:", jsonData);
        return jsonData;
      } catch (decompressErr) {
        console.error(`[ERROR] Brotli decompression failed: ${decompressErr.message}`);
        throw decompressErr;
      }
    } else {
      // Если сжатия нет, просто парсим
      const jsonData = response.data;
      if(printResult) console.log("Raw response:", jsonData);
      return jsonData;
    }
  } catch (err) {
    if (err.response) {
      // Сервер ответил кодом состояния вне диапазона 2xx
      console.error(`[ERROR] sendRequest: Server responded with status ${err.response.status}`);
      console.error(`[ERROR] sendRequest: Response data:`, err.response.data?.toString()); // Попытка логировать тело
      if (err.response.status === 429) {
        return {
          code: err.response.status,
          message: 'Too Many Requests'
        };
      }
    } else if (err.request) {
      // Запрос был сделан, но ответ не получен
      console.error(`[ERROR] sendRequest: No response received: ${err.message}`);
    } else {
      // Что-то произошло при настройке запроса
      console.error(`[ERROR] sendRequest: Request setup error: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Разделяет текст на части для перевода.
 * @param {string} text - Текст для разделения.
 * @param {boolean} tagHandling - Флаг обработки тегов.
 * @param {string} [dlSession] - Сессионный cookie.
 * @param {boolean} [printResult] - Флаг для печати результата.
 * @returns {Promise<Object>} - Результат разделения.
 */
async function splitText(text, tagHandling, dlSession, printResult) {
  const postData = {
    jsonrpc: '2.0',
    method: 'LMT_split_text',
    id: Math.floor(Math.random() * 1000000),
    params: {
      commonJobParams: { mode: 'translate' },
      lang: { lang_user_selected: 'auto' },
      texts: [text],
      textType: tagHandling ? 'richtext' : 'plaintext'
    }
  };

  try {
    const result = await sendRequest(postData, 'LMT_split_text', dlSession, printResult);
    if(printResult) console.log("[DEBUG] splitText result:", result);
    return result;
  } catch (err) {
    console.error("[ERROR] splitText:", err.message || err);
    throw new Error(`splitText failed: ${err.message || err}`);
  }
}

/**
 * Выполняет перевод текста.
 * @param {string} text - Текст для перевода.
 * @param {string} sourceLang - Исходный язык.
 * @param {string} targetLang - Целевой язык.
 * @param {string} [dlSession] - Сессионный cookie.
 * @param {boolean} [tagHandling] - Флаг обработки тегов (html/xml).
 * @param {boolean} [printResult] - Флаг для печати результата.
 * @returns {Promise<Object>} - Результат перевода.
 */
async function translate(text, sourceLang = 'auto', targetLang, dlSession, tagHandling = false, printResult = false) {
  try {
    if (!text) {
      throw new Error('No text to translate');
    }

    // Нормализуем параметры
    const normalizedSourceLang = sourceLang?.toLowerCase() || 'auto';
    const normalizedTargetLang = targetLang?.toUpperCase() || 'EN';

    if(printResult) console.log(`[DEBUG] translate() called with: text="${text.substring(0, 50)}...", source="${normalizedSourceLang}", target="${normalizedTargetLang}"`);

    // 1. Разделение текста
    const splitResult = await splitText(
        text,
        tagHandling === 'html' || tagHandling === 'xml',
        dlSession,
        printResult
    );

    if(printResult) console.log("[DEBUG] splitText returned:", splitResult);

    if (splitResult?.code === 429) {
      console.warn("[WARN] splitText returned 429 Too Many Requests");
      return {
        code: 429,
        message: 'Too Many Requests'
      };
    }

    if (!splitResult?.result) {
        console.error("[ERROR] Invalid splitText response:", splitResult);
        throw new Error('Failed to split text for translation');
    }

    // 2. Определение языка источника
    let finalSourceLang = normalizedSourceLang;
    if (normalizedSourceLang === 'auto' || normalizedSourceLang === '') {
      if (splitResult.result.lang?.detected) {
        finalSourceLang = splitResult.result.lang.detected.toLowerCase();
        if(printResult) console.log(`[DEBUG] Detected source language: ${finalSourceLang}`);
      } else {
        console.warn("[WARN] Could not detect source language, defaulting to 'en'");
        finalSourceLang = 'en'; // Резервный вариант
      }
    }

    // 3. Подготовка заданий на перевод
    const chunks = splitResult.result.texts?.[0]?.chunks;
    if (!chunks || !Array.isArray(chunks)) {
        console.error("[ERROR] Invalid chunks structure in splitText response:", splitResult);
        throw new Error('Invalid text chunks received from splitText');
    }

    const jobs = chunks.map((chunk, index) => {
      const sentence = chunk.sentences?.[0];
      if (!sentence) {
        throw new Error(`Invalid sentence structure in chunk ${index}`);
      }

      const contextBefore = index > 0 ? [chunks[index - 1].sentences[0].text] : [];
      const contextAfter = index < chunks.length - 1 ? [chunks[index + 1].sentences[0].text] : [];

      return {
        kind: 'default',
        preferred_num_beams: 4, // Или 1, как в оригинале?
        raw_en_context_before: contextBefore,
        raw_en_context_after: contextAfter,
        sentences: [{
          prefix: sentence.prefix || "", // Убедиться, что prefix есть
          text: sentence.text,
          id: index + 1
        }]
      };
    });

    const hasRegionalVariant = normalizedTargetLang.includes('-');
    const targetLangCode = hasRegionalVariant ? normalizedTargetLang.split('-')[0] : normalizedTargetLang;

    // 4. Подготовка данных для основного запроса перевода
    const translatePostData = {
      jsonrpc: '2.0',
      method: 'LMT_handle_jobs',
      id: Math.floor(Math.random() * 1000000),
      params: {
        commonJobParams: {
          mode: 'translate',
          ...(hasRegionalVariant && { regional_variant: normalizedTargetLang })
        },
        lang: {
          source_lang_computed: finalSourceLang.toUpperCase(),
          target_lang: targetLangCode.toUpperCase()
        },
        jobs: jobs,
        priority: 1,
        timestamp: Date.now()
      }
    };

    if(printResult) console.log("[DEBUG] Sending translate request with jobs:", jobs.length);

    // 5. Отправка запроса на перевод
    const translateResponse = await sendRequest(translatePostData, 'LMT_handle_jobs', dlSession, printResult);

    if(printResult) console.log("[DEBUG] Translate response received:", translateResponse);

    if (translateResponse?.code === 429) {
      console.warn("[WARN] Translate request returned 429 Too Many Requests");
      return {
        code: 429,
        message: 'Too Many Requests'
      };
    }

    if (!translateResponse?.result) {
        console.error("[ERROR] Invalid translate response:", translateResponse);
        throw new Error('Failed to get translation result');
    }

    // 6. Обработка результата перевода
    let alternatives = [];
    let translatedText = '';

    const translations = translateResponse.result.translations;
    if (translations && Array.isArray(translations) && translations.length > 0 && translations[0].beams) {
      translations[0].beams.forEach(beam => {
        if (beam.sentences?.[0]?.text) {
           alternatives.push(beam.sentences[0].text);
        }
      });
    }

    // Основной перевод - первый бим
    if (alternatives.length > 0) {
        translatedText = alternatives[0];
        alternatives.shift(); // Удаляем первый элемент (основной перевод) из альтернатив
    }

    if (!translatedText) {
      console.error("[ERROR] Translation result is empty. Full response:", translateResponse);
      throw new Error('Translation failed or returned empty result');
    }

    const ret = {
      code: 200, // Или translateResponse.code если он есть и успешен
      id: translatePostData.id,
      data: translatedText,
      source_lang: finalSourceLang.toUpperCase(),
      target_lang: normalizedTargetLang.toUpperCase(),
      alternatives: alternatives
    };

    if(printResult) console.log("[DEBUG] Final translation result:", ret);
    return ret;

  } catch (err) {
    console.error("[ERROR] translate function failed:", err.message);
    // Перепаковываем ошибку для лучшей обработки выше
    throw new Error(`Translation process failed: ${err.message}`);
  }
}

export { translate };
