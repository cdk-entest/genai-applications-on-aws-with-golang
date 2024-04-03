import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_opensearchserverless from "aws-cdk-lib/aws-opensearchserverless";
import * as fs from "fs";
import * as path from "path";

const strAccessPolicy = JSON.stringify(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "./../policy/access-policy.json"),
      "utf-8"
    )
  )
);

const strNetworkPolicy = JSON.stringify(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "./../policy/network-policy.json"),
      "utf-8"
    )
  )
);

const strEncryptPolicy = JSON.stringify(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "./../policy/encryption-policy.json"),
      "utf-8"
    )
  )
);

interface AOSSProps extends StackProps {
  arnPrincipal: string;
  name: string;
}

export class AOSSStack extends Stack {
  public readonly collection: aws_opensearchserverless.CfnCollection;

  constructor(scope: Construct, id: string, props: AOSSProps) {
    super(scope, id, props);

    const strAccessPolicyInline = `
[{"Description":"Rule 1","Rules":[{"ResourceType":"collection","Resource":["collection/demo"],"Permission":["aoss:CreateCollectionItems","aoss:DeleteCollectionItems","aoss:UpdateCollectionItems","aoss:DescribeCollectionItems"]},{"ResourceType":"index","Resource":["index/demo/*"],"Permission":["aoss:CreateIndex","aoss:DeleteIndex","aoss:UpdateIndex","aoss:DescribeIndex","aoss:ReadDocument","aoss:WriteDocument"]}],"Principal":["${props.arnPrincipal}"]}]
`;

    const collection = new aws_opensearchserverless.CfnCollection(
      this,
      props.name,
      {
        name: props.name,
        description: "vector search demo",
        type: "VECTORSEARCH",
        standbyReplicas: "DISABLED",
      }
    );

    const accessPolicy = new aws_opensearchserverless.CfnAccessPolicy(
      this,
      "accessPolicyDemo",
      {
        name: "demo-access-policy",
        type: "data",
        description: "access policy demo",
        policy: strAccessPolicyInline,
      }
    );

    const networkPolicy = new aws_opensearchserverless.CfnSecurityPolicy(
      this,
      "networkPolicyDemo",
      {
        name: "network-policy-demo",
        type: "network",
        description: "network policy demo",
        policy: strNetworkPolicy,
      }
    );

    const encryptionPolicy = new aws_opensearchserverless.CfnSecurityPolicy(
      this,
      "encryptionPolicyDemo",
      {
        name: "encryption-policy-demo",
        type: "encryption",
        description: "encryption policy demo",
        policy: strEncryptPolicy,
      }
    );

    collection.addDependency(networkPolicy);
    collection.addDependency(encryptionPolicy);
    collection.addDependency(accessPolicy);

    this.collection = collection;
  }
}
