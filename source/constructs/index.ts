#!/usr/bin/env node
import cdk = require('@aws-cdk/core');
import { StaticSite } from './static-site';
import { LambdaApiStack } from "./lambda-api-stack"
import { EcsStack } from "./ecs-stack"
import { Rule } from '@aws-cdk/aws-events';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';

/**
 * This stack relies on getting the domain name from CDK context.
 * Use 'cdk synth -c domain=mystaticsite.com -c subdomain=www'
 * Or add the following to cdk.json:
 * {
 *   "context": {
 *     "domain": "mystaticsite.com",
 *     "subdomain": "www"
 *   }
 * }
**/
class MLBotStack extends cdk.Stack {
  constructor(parent: cdk.App, name: string, props: cdk.StackProps) {
    super(parent, name, props);
    
    const lambdaFunctionName = "LambdaFunction"
    const lambdaApi = new LambdaApiStack(this, 'LambdaApi', {
      functionName: lambdaFunctionName,
    });

    const ecsStack = new EcsStack(this, 'EcsStack', {
      dataBucket: lambdaApi.dataBucket,
      modelBucket: lambdaApi.modelBucket,
      vpc: lambdaApi.vpc
    });

    lambdaApi.lambdaFunction.addEnvironment("CLUSTER_ARN", ecsStack.cluster.clusterArn)
    lambdaApi.lambdaFunction.addEnvironment("TRAINING_TASK_ARN", ecsStack.trainingTaskDef.taskDefinitionArn)
    lambdaApi.lambdaFunction.addEnvironment("INFERENCE_TASK_ARN", ecsStack.inferenceTaskDef.taskDefinitionArn)

    /**
     * Create a EventBridge rule to automate model deployment process using Lambda
     */
    const ecsTaskTarget = new LambdaFunction(lambdaApi.lambdaFunction);
    const eventPattern = {
      source: [ "aws.ecs" ],
      detailType: [ "ECS Task State Change" ],
      detail: {
        "clusterArn": [ ecsStack.cluster.clusterArn ]
      }
    }
    new Rule(this, 'EventPattern', {
      eventPattern: eventPattern,
      targets: [ecsTaskTarget],
    });
    
    new StaticSite(this, 'StaticSite', {
      // domainName: domain.valueAsString,
      // siteSubDomain: subdomain.valueAsString,
      domainName: this.node.tryGetContext('domain'),
      siteSubDomain: this.node.tryGetContext('subdomain'),
      apiUrl: lambdaApi.restApi.url,
    });
  }
}

const app = new cdk.App();

new MLBotStack(app, 'ml-bot-dev', { env: {
  account: '250779322837',
  // Stack must be in us-east-1, because the ACM certificate for a
  // global CloudFront distribution must be requested in us-east-1.
  region: 'cn-north-1'
}});

app.synth();
