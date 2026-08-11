#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(OnnxBridge, NSObject)

RCT_EXTERN_METHOD(loadModel:(NSString *)modelName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(runInference:(NSString *)modelName
                  input:(NSString *)input
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
