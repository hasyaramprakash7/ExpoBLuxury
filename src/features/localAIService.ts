// src/features/localAIService.ts
import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, loadLlamaModelInfo } from 'llama.rn';

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

export const AVAILABLE_MODELS = [
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B (Q4)',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '1.8 GB',
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini 3.8B (Q4)',
    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    size: '2.2 GB',
  },
  {
    id: 'gemma-2-2b',
    name: 'Gemma 2 2B (Q4)',
    url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    size: '1.6 GB',
  },
  {
    id: 'qwen2.5-1.5b',
    name: 'Qwen 2.5 1.5B (Q4)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    size: '1.1 GB',
  },
  {
    id: 'deepseek-r1-1.5b',
    name: 'DeepSeek R1 1.5B (Q4)',
    url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    size: '1.1 GB',
  },
];

const ensureModelsDir = async (): Promise<void> => {
  console.log('📁 [localAIService] Ensuring models directory:', MODELS_DIR);
  try {
    const info = await FileSystem.getInfoAsync(MODELS_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
      console.log('✅ [localAIService] Created models directory');
    } else {
      console.log('ℹ️  [localAIService] Models directory already exists');
    }
  } catch (err) {
    console.error('❌ [localAIService] ensureModelsDir error:', err);
  }
};

export const downloadModel = async (
  modelUrl: string,
  fileName: string,
  onProgress?: (pct: number) => void
): Promise<string> => {
  console.log('⬇️  [downloadModel] Starting download:', fileName);
  console.log('   URL:', modelUrl);

  await ensureModelsDir();

  const fileUri = `${MODELS_DIR}${fileName}`;
  console.log('   Target path:', fileUri);

  const info = await FileSystem.getInfoAsync(fileUri);
  if (info.exists) {
    console.log('✅ [downloadModel] Already downloaded — skipping');
    return fileUri;
  }

  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      modelUrl,
      fileUri,
      {},
      (progress) => {
        const pct =
          progress.totalBytesWritten /
          Math.max(progress.totalBytesExpectedToWrite, 1);
        onProgress?.(pct);
        const pctInt = Math.floor(pct * 100);
        if (pctInt % 10 === 0) {
          console.log(`   📊 Progress: ${pctInt}%`);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      throw new Error('Download failed — no file written');
    }

    console.log('✅ [downloadModel] Download complete:', result.uri);
    return result.uri;
  } catch (err) {
    console.error('❌ [downloadModel] Failed:', err);
    throw err;
  }
};

export const getDownloadedModels = async (): Promise<
  { id: string; name: string; path: string }[]
> => {
  console.log('📂 [getDownloadedModels] Reading models directory...');
  try {
    await ensureModelsDir();
    const files = await FileSystem.readDirectoryAsync(MODELS_DIR);
    const ggufs = files
      .filter((f) => f.endsWith('.gguf'))
      .map((f) => ({
        id: f.replace('.gguf', ''),
        name: f.replace('.gguf', '').replace(/-/g, ' '),
        path: `${MODELS_DIR}${f}`,
      }));
    console.log(`✅ [getDownloadedModels] Found ${ggufs.length} model(s)`);
    return ggufs;
  } catch (err) {
    console.error('❌ [getDownloadedModels] Error:', err);
    return [];
  }
};

export const deleteModel = async (filePath: string): Promise<void> => {
  console.log('🗑️  [deleteModel] Deleting:', filePath);
  try {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
    console.log('✅ [deleteModel] Deleted');
  } catch (err) {
    console.error('❌ [deleteModel] Error:', err);
  }
};

let llamaContext: any = null;

export const loadModel = async (modelPath: string): Promise<boolean> => {
  console.log('🧠 [loadModel] Loading model:', modelPath);
  try {
    if (llamaContext) {
      console.log('   Releasing previous context...');
      await llamaContext.release();
      llamaContext = null;
    }

    console.log('   Reading model info...');
    const info = await loadLlamaModelInfo(modelPath);
    console.log('   Model info:', info);

    console.log('   Initializing llama context...');
    llamaContext = await initLlama({
      model: modelPath,
      use_mlock: true,
      n_ctx: 2048,
      n_gpu_layers: 99,
    });

    console.log('✅ [loadModel] Model loaded successfully');
    return true;
  } catch (err) {
    console.error('❌ [loadModel] Failed:', err);
    return false;
  }
};

export const chatWithModel = async (
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  onToken?: (token: string) => void
): Promise<string> => {
  if (!llamaContext) {
    console.error('❌ [chatWithModel] No model loaded');
    throw new Error('No model loaded. Call loadModel() first.');
  }

  console.log(`💬 [chatWithModel] Sending ${messages.length} messages`);
  const start = Date.now();

  const stopWords = [
    '</s>',
    '<|end|>',
    '<|eot_id|>',
    '<|end_of_text|>',
    '<|im_end|>',
    '<|EOT|>',
    '<|END_OF_TURN_TOKEN|>',
    '<|end_of_turn|>',
    '<|endoftext|>',
  ];

  try {
    const result = await llamaContext.completion(
      {
        messages,
        n_predict: 512,
        stop: stopWords,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9,
      },
      (data: any) => {
        if (data.token) onToken?.(data.token);
      }
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ [chatWithModel] Generated in ${elapsed}s`);
    return result.text;
  } catch (err) {
    console.error('❌ [chatWithModel] Error:', err);
    throw err;
  }
};

export const unloadModel = async (): Promise<void> => {
  console.log('🔌 [unloadModel] Releasing context...');
  if (llamaContext) {
    await llamaContext.release();
    llamaContext = null;
    console.log('✅ [unloadModel] Context released');
  }
};