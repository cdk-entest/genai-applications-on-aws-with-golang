import { Duration, Stack, StackProps } from "aws-cdk-lib";
// import { ListenerCertificate } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as aws_ec2 from "aws-cdk-lib/aws-ec2";
import * as aws_ecr from "aws-cdk-lib/aws-ecr";
import * as aws_ecs from "aws-cdk-lib/aws-ecs";
import * as aws_iam from "aws-cdk-lib/aws-iam";
import * as aws_elasticloadbalancingv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Effect } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface GotBedrockProps extends StackProps {
  cluster: aws_ecs.Cluster;
  ecrRepoName: string;
  certificate: string;
  vpcId: string;
  vpcName: string;
  aossCollectionArn?: string;
  bucketName: string;
}

export class GoBedrockService extends Stack {
  public readonly service: aws_ecs.FargateService;

  constructor(scope: Construct, id: string, props: GotBedrockProps) {
    super(scope, id, props);

    // lookup an existed vpc
    const vpc = aws_ec2.Vpc.fromLookup(this, "LookUpVpcBlogService", {
      vpcId: props.vpcId,
      vpcName: props.vpcName,
    });

    // task role
    const taskRole = new aws_iam.Role(this, "RoleForGoBedrockSimpleService", {
      assumedBy: new aws_iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      roleName: "RoleForGoBedrockSimpleService",
    });

    const task = new aws_ecs.FargateTaskDefinition(
      this,
      "TaskDefinitionForGoBedrockSimpleService",
      {
        family: "latest",
        cpu: 4096,
        memoryLimitMiB: 8192,
        runtimePlatform: {
          operatingSystemFamily: aws_ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: aws_ecs.CpuArchitecture.X86_64,
        },
        // default cdk create
        taskRole: taskRole,
        // retrieve container images from ECR
        // executionRole: executionRole,
      }
    );

    // call bedrock models
    task.addToTaskRolePolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-v2`,
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/stability.stable-diffusion-xl-v1`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`,
        ],
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
      })
    );

    // access s3 bucket
    task.addToTaskRolePolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: [`arn:aws:s3:::${props.bucketName}-${this.region}`],
        actions: ["s3:*GetObject", "s3:PutObject"],
      })
    );

    // invoke opensearch
    task.addToTaskRolePolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: [`arn:aws:aoss:${this.region}:${this.account}:collection/*`],
        actions: ["aoss:APIAccessAll"],
      })
    );

    // task add container
    task.addContainer("GoBedrockSimpleServiceTask", {
      containerName: props.ecrRepoName,
      memoryLimitMiB: 4096,
      memoryReservationMiB: 4096,
      stopTimeout: Duration.seconds(120),
      startTimeout: Duration.seconds(120),
      // image: aws_ecs.ContainerImage.fromRegistry(
      //   "public.ecr.aws/b5v7e4v7/blog-ecr:latest"
      // ),
      image: aws_ecs.ContainerImage.fromEcrRepository(
        aws_ecr.Repository.fromRepositoryName(
          this,
          props.ecrRepoName,
          props.ecrRepoName
        )
      ),
      portMappings: [{ containerPort: 3000 }],

      logging: new aws_ecs.AwsLogDriver({
        streamPrefix: props.ecrRepoName,
      }),
    });

    const service = new aws_ecs.FargateService(
      this,
      "EcsGoBedrockSimpleService",
      {
        vpcSubnets: {
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        assignPublicIp: true,
        cluster: props.cluster,
        taskDefinition: task,
        desiredCount: 1,
        // deploymentController: {
        // default rolling update
        // type: aws_ecs.DeploymentControllerType.ECS,
        // type: aws_ecs.DeploymentControllerType.CODE_DEPLOY,
        // },
        capacityProviderStrategies: [
          {
            capacityProvider: "FARGATE",
            weight: 1,
          },
          {
            capacityProvider: "FARGATE_SPOT",
            weight: 0,
          },
        ],
      }
    );

    // scaling on cpu utilization
    const scaling = service.autoScaleTaskCount({
      maxCapacity: 4,
      minCapacity: 1,
    });

    scaling.scaleOnMemoryUtilization("CpuUtilization", {
      targetUtilizationPercent: 50,
    });

    // application load balancer
    const alb = new aws_elasticloadbalancingv2.ApplicationLoadBalancer(
      this,
      "AlbForGoBedrockSimpleService",
      {
        loadBalancerName: "AlbForGoBedrockSimpleService",
        vpc: vpc,
        internetFacing: true,
      }
    );

    // add listener
    const listener = alb.addListener("ListenerEcsGoBedrockSimpleService", {
      port: 80,
      open: true,
      protocol: aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
    });

    listener.addTargets("EcsGoBedrockSimpleService", {
      port: 80,
      targets: [
        service.loadBalancerTarget({
          containerName: props.ecrRepoName,
          containerPort: 3000,
          protocol: aws_ecs.Protocol.TCP,
        }),
      ],
      healthCheck: {
        timeout: Duration.seconds(10),
      },
    });

    // // add listener https
    // const listenerHttps = alb.addListener(
    //   "ListenerHttpsGoBedrockSimpleService",
    //   {
    //     port: 443,
    //     open: true,
    //     protocol: aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
    //     certificates: [ListenerCertificate.fromArn(props.certificate)],
    //   }
    // );

    // // listner add target
    // listenerHttps.addTargets("EcsServiceHttpsGoBedrockSimpleService", {
    //   port: 80,
    //   targets: [
    //     service.loadBalancerTarget({
    //       containerName: props.ecrRepoName,
    //       containerPort: 3000,
    //       protocol: aws_ecs.Protocol.TCP,
    //     }),
    //   ],
    //   healthCheck: {
    //     timeout: Duration.seconds(10),
    //   },
    // });

    this.service = service;
  }
}
