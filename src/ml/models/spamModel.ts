import { runInference } from '../core/onnxBridge';
import { MLConfig } from '../config/modelConfig';

export interface SpamResult {
  is_spam: boolean;
  confidence: number;
}

export class SpamModel {
  /**
   * Runs the message through the ONNX spam model.
   * If the underlying model throws due to older structure expecting `float[]`
   * instead of string, it safely catches it and returns UNKNOWN.
   */
  static async predict(message: string): Promise<SpamResult | { type: 'UNKNOWN' }> {
    const result = await runInference(MLConfig.models.stage1, message);
    
    if (result.error || !result.output) {
      return { type: 'UNKNOWN' };
    }

    try {
      const parsed = JSON.parse(result.output);
      // We expect the native bridge to return something like { "probability": 0.85 }
      const confidence = parsed.probability || 0; 
      
      return {
        is_spam: confidence >= MLConfig.threshold,
        confidence: confidence,
      };
    } catch (e) {
      return { type: 'UNKNOWN' };
    }
  }
}
