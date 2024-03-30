cdk bootstrap aws://$ACCOUNT_ID/us-west-2
cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' synth 
cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy AmazonOpenSearchStack
cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy LambdaAossBedrockStack
cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy EcsClusterStack
cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy GoBedrockService

