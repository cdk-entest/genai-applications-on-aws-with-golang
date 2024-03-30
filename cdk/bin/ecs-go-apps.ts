import * as cdk from "aws-cdk-lib";
import { EcsClusterStack } from "../lib/ecs-cluster";
import {
  VPC_ID,
  VPC_NAME,
  REGION,
  AOSS_ARN,
  ECR_REPO_NAME,
  GO_BLOG_ACM_CERT_ARN,
  BUCKET_NAME,
  BUCKET_ARN,
  ARN_PRINCIPAL_ACCESS_AOSS,
} from "../config";
import { GoBedrockService } from "../lib/service-go-bedrock";
import { AOSSStack } from "../lib/aoss";
import { LambdaAossStack } from "../lib/lambda-aoss";

const ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT;

// create cdk app
const app = new cdk.App();

// create amazon opensearch collection
const aoss = new AOSSStack(app, "AmazonOpenSearchStack", {
  name: "demo",
  arnPrincipal: ARN_PRINCIPAL_ACCESS_AOSS,
});

// create lambda indexing aoss collection
new LambdaAossStack(app, "LambdaAossBedrockStack", {
  opensearchDomain: ``,
  aossCollectionArn: aoss.collection.ref,
  bucketName: BUCKET_NAME,
  aossIndexName: "",
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
  aossCollectionArn: AOSS_ARN,
  bucketArn: BUCKET_ARN,
  env: {
    region: REGION,
    account: ACCOUNT,
  },
});
