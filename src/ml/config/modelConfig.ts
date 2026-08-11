import thresholdData from '../../../../assets/models/v1/threshold.json';

export const MLConfig = {
  version: 'v1',
  models: {
    stage1: 'stage1.onnx',
    stage2: 'stage2.onnx'
  },
  threshold: thresholdData.threshold || 0.3
};
