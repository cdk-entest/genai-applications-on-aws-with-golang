# get account_id
ACCOUNT_ID=$(aws sts get-caller-identity | jq -r '.Account')
# get participant role
#PARTICIPANT_ROLE_ARN=$(aws sts get-caller-identity | jq -r '.Arn')
# bootstrap cdk
#cdk bootstrap aws://$ACCOUNT_ID/us-west-2
cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' synth
#cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy AmazonOpenSearchStack
#cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy S3DataSourceStack
#cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy EcsClusterStack
#cdk --app 'npx ts-node --prefer-ts-exts bin/ecs-go-apps.ts' deploy GoBedrockService
