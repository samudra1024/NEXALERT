import { MLConfig } from '../config/modelConfig';
import { loadModel } from './onnxBridge';

class ModelManager {
  private static instance: ModelManager;
  private isLoaded = false;
  private loadingPromise: Promise<boolean> | null = null;

  private constructor() {}

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  public async loadModels(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const stage1Loaded = await loadModel(MLConfig.models.stage1);
        const stage2Loaded = await loadModel(MLConfig.models.stage2);
        this.isLoaded = stage1Loaded && stage2Loaded;
        return this.isLoaded;
      } catch (error) {
        console.warn('Error loading ML models:', error);
        return false;
      }
    })();

    return this.loadingPromise;
  }
}

export default ModelManager;
