import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import * as aws_iam from "aws-cdk-lib/aws-iam";
import * as aws_lambda from "aws-cdk-lib/aws-lambda";
import * as aws_s3 from "aws-cdk-lib/aws-s3";
import * as aws_s3_notifications from "aws-cdk-lib/aws-s3-notifications";
import { Effect } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

interface S3DataSourceProps extends StackProps {
  opensearchDomain: string;
  aossCollectionArn?: string;
  bucketName: string;
  aossIndexName: string;
}

export class S3DataSourceStack extends Stack {
  public readonly role: aws_iam.Role;

  constructor(scope: Construct, id: string, props: S3DataSourceProps) {
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
        resources: [`arn:aws:aoss:${this.region}:${this.account}:collection/*`],
        actions: ["aoss:APIAccessAll"],
      })
    );

    // lambda function to query opensearch
    const lambda = new aws_lambda.Function(this, "LamdaQueryOpenSearch", {
      functionName: "LambdaIndexAossBedrock",
      memorySize: 2048,
      timeout: Duration.seconds(300),
      code: aws_lambda.EcrImageCode.fromAssetImage(
        path.join(__dirname, "./../lambda/")
      ),
      handler: aws_lambda.Handler.FROM_IMAGE,
      runtime: aws_lambda.Runtime.FROM_IMAGE,
      environment: {
        OPENSEARCH_DOMAIN: props.opensearchDomain,
        PYTHONPATH: "/var/task/package",
        REGION: this.region,
        BUCKET: props.bucketName,
        AOSS_INDEX_NAME: props.aossIndexName,
      },
      role: role,
    });

    // s3 bucket
    const bucket = new aws_s3.Bucket(this, "S3BucketForDocuments", {
      bucketName: props.bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // s3 trigger lambda
    bucket.addEventNotification(
      aws_s3.EventType.OBJECT_CREATED,
      new aws_s3_notifications.LambdaDestination(lambda),
      {
        prefix: "documents/",
        suffix: ".pdf",
      }
    );

    // removal policy
    bucket.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // output
    new CfnOutput(this, "RoleForLambdaIndexAossBedrockArn", {
      value: role.roleArn,
      description: "role of lambda indexing opensearch",
    });

    this.role = role;
  }
}
