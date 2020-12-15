import { LambdaIntegration, MethodLoggingLevel, RestApi } from "@aws-cdk/aws-apigateway"
import { PolicyStatement } from "@aws-cdk/aws-iam"
import { Function, Runtime, AssetCode } from "@aws-cdk/aws-lambda"
import { Vpc } from "@aws-cdk/aws-ec2"
import { Construct, Duration } from "@aws-cdk/core"
import s3 = require("@aws-cdk/aws-s3")
import apigateway = require("@aws-cdk/aws-apigateway")
import * as dynamodb from '@aws-cdk/aws-dynamodb';

export interface LambdaApiStackProps {
  functionName: string
}

export class LambdaApiStack extends Construct {
  readonly restApi: RestApi
  readonly lambdaFunction: Function
  readonly dataBucket: s3.Bucket
  readonly modelBucket: s3.Bucket
  readonly vpc: Vpc
  readonly taskTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: LambdaApiStackProps) {
    super(scope, id)

    this.taskTable = new dynamodb.Table(this, 'TaskTable', {
      partitionKey: { name: 'TrainingTaskId', type: dynamodb.AttributeType.STRING }
    });
    
    this.vpc = new Vpc(this, 'Vpc', { maxAzs: 2 });
    this.dataBucket = new s3.Bucket(this, "DataBucket")
    this.modelBucket = new s3.Bucket(this, "ModelBucket")

    this.restApi = new RestApi(this, "RestApi", {
      deployOptions: {
        stageName: "Prod",
        metricsEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ]
      }
    })
    
    const s3Policy = new PolicyStatement()
    s3Policy.addActions("s3:*")
    s3Policy.addResources(this.dataBucket.bucketArn + "/*")
    s3Policy.addResources(this.modelBucket.bucketArn + "/*")
    const ecsPolicy = new PolicyStatement()
    ecsPolicy.addActions("ec2:*")
    ecsPolicy.addActions("ecs:*")
    ecsPolicy.addActions("iam:*")
    ecsPolicy.addResources("*")
    const dynamodbPolicy = new PolicyStatement()
    dynamodbPolicy.addActions("dynamodb:*")
    dynamodbPolicy.addActions("iam:*")
    dynamodbPolicy.addResources(this.taskTable.tableArn)

    this.lambdaFunction = new Function(this, props.functionName, {
      // functionName: props.functionName,
      handler: "app.lambda_handler",
      runtime: Runtime.PYTHON_3_7,
      code: new AssetCode(`./src`),
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        DATA_BUCKET: this.dataBucket.bucketName,
        MODEL_BUCKET: this.modelBucket.bucketName,
        TASK_TABLE: this.taskTable.tableName,
      },
      initialPolicy: [s3Policy, ecsPolicy, dynamodbPolicy],
      vpc: this.vpc,
    })
    this.dataBucket.grantReadWrite(this.lambdaFunction);
    this.modelBucket.grantReadWrite(this.lambdaFunction);

    const lambdaFn = new LambdaIntegration(this.lambdaFunction, {});
    this.restApi.root.addMethod('GET', lambdaFn);
    const welcomeApi = this.restApi.root.addResource('hello');
    welcomeApi.addMethod('GET', lambdaFn);
    const uploadApi = this.restApi.root.addResource('upload');
    uploadApi.addMethod('POST', lambdaFn);
    const trainApi = this.restApi.root.addResource('training_job');
    trainApi.addMethod('POST', lambdaFn);
    const predictApi = this.restApi.root.addResource('predict');
    predictApi.addMethod('POST', lambdaFn);
    const statusApi = this.restApi.root.addResource('status');
    statusApi.addMethod('POST', lambdaFn);

    addCorsOptions(welcomeApi);
    addCorsOptions(uploadApi);
    addCorsOptions(trainApi);
    addCorsOptions(predictApi);
    addCorsOptions(statusApi);
  }
}

export function addCorsOptions(apiResource: apigateway.IResource) {
  apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },  
    }]
  })
}
