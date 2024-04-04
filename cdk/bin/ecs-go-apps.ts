import * as cdk from "aws-cdk-lib";
import { EcsClusterStack } from "../lib/ecs-cluster";
import {
  VPC_ID,
  VPC_NAME,
  REGION,
  ECR_REPO_NAME,
  BUCKET_NAME,
  BUCKET_ARN,
  PARTICIPANT_ROLE_ARN,
  AOSS_DOMAIN,
  AOSS_INDEX_NAME,
} from "../config";
import { GoBedrockService } from "../lib/service-go-bedrock";
import { AmazonOpenSearchStack } from "../lib/aoss";
import { S3DataSourceStack } from "../lib/s3-data-source";

const ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT;

// create cdk app
const app = new cdk.App();

// amazon opensearch serverless collection
new AmazonOpenSearchStack(app, "AmazonOpenSearchStack", {
  name: "demo",
  arnPrincipal: PARTICIPANT_ROLE_ARN,
});

// s3 data source and lambda
new S3DataSourceStack(app, "S3DataSourceStack", {
  bucketName: BUCKET_NAME,
  aossIndexName: AOSS_INDEX_NAME,
  opensearchDomain: AOSS_DOMAIN,
});

// create ecs cluster
const cluster = new EcsClusterStack(app, "EcsClusterStack", {
  vpcId: VPC_ID,
  vpcName: VPC_NAME,
  env: {
    region: REGION,
    account: ACCOUNT,
  },
});

// create a go bedrock app
new GoBedrockService(app, "GoBedrockService", {
  cluster: cluster.cluster,
  vpcId: VPC_ID,
  vpcName: VPC_NAME,
  // for https
  certificate: "",
  ecrRepoName: ECR_REPO_NAME,
  bucketArn: BUCKET_ARN,
  env: {
    region: REGION,
    account: ACCOUNT,
  },
});
