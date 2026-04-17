import { SpamModel } from '../models/spamModel';
import { CategoryModel } from '../models/categoryModel';
import ModelManager from '../core/modelManager';

export const processMessage = async (message: string) => {
  // Lazy load models if they haven't been loaded already.
  // In a robust implementation, this would ideally happen during splash screen.
  await ModelManager.getInstance().loadModels();

  // STAGE 1: Check if spam
  const stage1Result = await SpamModel.predict(message);
  
  if ('type' in stage1Result && stage1Result.type === 'UNKNOWN') {
    return { type: 'UNKNOWN' };
  }
  
  if (stage1Result.is_spam) {
    return {
      type: 'SPAM',
      confidence: stage1Result.confidence
    };
  }
  
  // STAGE 2: If not spam, categorize
  const stage2Result = await CategoryModel.predict(message);
  
  if ('type' in stage2Result && stage2Result.type === 'UNKNOWN') {
    return { type: 'UNKNOWN' };
  }

  return {
    type: 'HAM',
    category: stage2Result.category
  };
};
