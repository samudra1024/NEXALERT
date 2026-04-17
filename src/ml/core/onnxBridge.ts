import { NativeModules } from 'react-native';

const { OnnxBridge } = NativeModules;

export interface OnnxInferenceResult {
  output?: string;
  error?: string;
}

export const loadModel = async (modelName: string): Promise<boolean> => {
  if (!OnnxBridge) return false;
  try {
    return await OnnxBridge.loadModel(modelName);
  } catch (error) {
    console.warn(`Failed to load ONNX model: ${modelName}`, error);
    return false;
  }
};

export const runInference = async (modelName: string, input: string): Promise<OnnxInferenceResult> => {
  if (!OnnxBridge) return { error: 'Native module OnnxBridge not found' };
  try {
    // Expected to return a JSON string from native bridge representing probabilities or categories
    const resultString = await OnnxBridge.runInference(modelName, input);
    return { output: resultString };
  } catch (error: any) {
    return { error: error.message || 'Unknown error' };
  }
};
