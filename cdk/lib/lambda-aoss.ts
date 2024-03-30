import { Duration, Stack, StackProps, aws_iam, aws_lambda } from "aws-cdk-lib";
import { Effect } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

interface LambdaAossProps extends StackProps {
  opensearchDomain: string;
  aossCollectionArn: string;
  bucketName: string;
}

export class LambdaAossStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdaAossProps) {
    super(scope, id, props);

    // role for lambda to read opensearch
    const role = new aws_iam.Role(this, "RoleForLambdaIndexAossBedrock", {
      roleName: "RoleForLambdaIndexAossBedrock",
      assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: [`arn:aws:s3:::${props.bucketName}/*`],
        actions: ["s3:GetObject"],
      })
    );

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/*`],
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
      })
    );

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: [props.aossCollectionArn],
        actions: ["aoss:APIAccessAll"],
      })
    );

    // lambda function to query opensearch
    new aws_lambda.Function(this, "LamdaQueryOpenSearch", {
      functionName: "LambdaIndexAossBedrock",
      memorySize: 2048,
      timeout: Duration.seconds(300),
      code: aws_lambda.EcrImageCode.fromAssetImage(
        path.join(__dirname, "./../lambda/lambda-index-aoss/")
      ),
      handler: aws_lambda.Handler.FROM_IMAGE,
      runtime: aws_lambda.Runtime.FROM_IMAGE,
      environment: {
        OPENSEARCH_DOMAIN: props.opensearchDomain,
        PYTHONPATH: "/var/task/package",
        REGION: this.region,
        BUCKET: props.bucketName,
      },
      role: role,
    });
  }
}
