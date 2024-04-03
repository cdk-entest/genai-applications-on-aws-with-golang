import { Stack, StackProps, IAspect, Aspects } from "aws-cdk-lib";
import { Construct, IConstruct } from "constructs";

import * as aws_ecs from "aws-cdk-lib/aws-ecs";
import * as aws_ec2 from "aws-cdk-lib/aws-ec2";

interface EcsProps extends StackProps {
  vpcId: string;
  vpcName: string;
}

export class EcsClusterStack extends Stack {
  public readonly cluster: aws_ecs.Cluster;

  constructor(scope: Construct, id: string, props: EcsProps) {
    super(scope, id, props);

    Aspects.of(this).add(new CapacityProviderDependencyAspect());

    // lookup an existed vpc
    const vpc = aws_ec2.Vpc.fromLookup(this, "LookUpVpcForEcsCluster", {
      vpcId: props.vpcId,
      vpcName: props.vpcName,
    });

    // ecs cluster
    this.cluster = new aws_ecs.Cluster(this, "EcsClusterForNextApps", {
      vpc: vpc,
      clusterName: "EcsClusterForNextApps",
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });
  }
}

/**
 * Add a dependency from capacity provider association to the cluster
 * and from each service to the capacity provider association.
 */
class CapacityProviderDependencyAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof aws_ecs.CfnClusterCapacityProviderAssociations) {
      // IMPORTANT: The id supplied here must be the same as the id of your cluster. Don't worry, you won't remove the cluster.
      node.node.scope?.node.tryRemoveChild("EcsClusterForNextApps");
    }

    if (node instanceof aws_ecs.Ec2Service) {
      const children = node.cluster.node.findAll();
      for (const child of children) {
        if (child instanceof aws_ecs.CfnClusterCapacityProviderAssociations) {
          child.node.addDependency(node.cluster);
          node.node.addDependency(child);
        }
      }
    }
  }
}
