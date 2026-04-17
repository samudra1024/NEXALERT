import { runInference } from '../core/onnxBridge';
import { MLConfig } from '../config/modelConfig';

export interface CategoryResult {
  category: string;
}

export class CategoryModel {
  /**
   * Runs the message through the ONNX category model.
   */
  static async predict(message: string): Promise<CategoryResult | { type: 'UNKNOWN' }> {
    const result = await runInference(MLConfig.models.stage2, message);
    
    if (result.error || !result.output) {
      return { type: 'UNKNOWN' };
    }

    try {
      const parsed = JSON.parse(result.output);
      // We expect the native bridge to return something like { "category": "banking" }
      return {
        category: parsed.category || "unknown"
      };
    } catch (e) {
      return { type: 'UNKNOWN' };
    }
  }
}
