import ecs = require('@aws-cdk/aws-ecs');
import ec2 = require('@aws-cdk/aws-ec2');
import { Construct } from "@aws-cdk/core"
import path = require('path');
import { Bucket } from '@aws-cdk/aws-s3';
import { PolicyStatement } from "@aws-cdk/aws-iam"
import { Vpc } from "@aws-cdk/aws-ec2"

export interface EcsStackProps {
  dataBucket: Bucket,
  modelBucket: Bucket,
  vpc: Vpc
}

export class EcsStack extends Construct {
  readonly cluster: ecs.Cluster
  readonly trainingTaskDef: ecs.Ec2TaskDefinition
  readonly inferenceTaskDef: ecs.Ec2TaskDefinition

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id);

    // Create a cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });
    const gpuAmi = new ecs.EcsOptimizedAmi({hardwareType: ecs.AmiHardwareType.GPU});
    const cpuAmi = new ecs.EcsOptimizedAmi({hardwareType: ecs.AmiHardwareType.STANDARD});
    const trainingAsg = this.cluster.addCapacity('TrainingASG', {
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      instanceType: new ec2.InstanceType('g4dn.xlarge'),
      machineImage: gpuAmi,
      associatePublicIpAddress: false,
    });
    const inferenceAsg = this.cluster.addCapacity('InferenceASG', {
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      instanceType: new ec2.InstanceType('c5.xlarge'),
      machineImage: cpuAmi,
      associatePublicIpAddress: false,
    });

    const asgPolicy = new PolicyStatement()
    asgPolicy.addActions("s3:*")
    asgPolicy.addResources(props.dataBucket.bucketArn)
    asgPolicy.addResources(props.dataBucket.bucketArn + "/*")
    asgPolicy.addResources(props.modelBucket.bucketArn)
    asgPolicy.addResources(props.modelBucket.bucketArn + "/*")
    trainingAsg.addToRolePolicy(asgPolicy)
    inferenceAsg.addToRolePolicy(asgPolicy)

    // configure security group for inference host machine
    const inferenceSG = new ec2.SecurityGroup(this, "InferenceEndpointSG", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });
    inferenceSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080));
    inferenceAsg.addSecurityGroup(inferenceSG);
    
    // create a task definition with CloudWatch Logs
    const logging = new ecs.AwsLogDriver({ streamPrefix: "ml-bot" })
    const linuxParameters = new ecs.LinuxParameters(this, "LinuxParameters", {
      sharedMemorySize: 1024,
    });
    
    this.trainingTaskDef = new ecs.Ec2TaskDefinition(this, "TrainingTask");
    this.trainingTaskDef.addContainer("trainingContainer", {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../docker/training')),
      gpuCount: 1,
      memoryLimitMiB: 8192,
      logging: logging,
      environment: {
        DATA_BUCKET: props.dataBucket.bucketName,
        DATA_PREFIX: "ml-bot-image-classification-2020-12-02-19-34-31-000",
        MODEL_BUCKET: props.modelBucket.bucketName,
        MODEL_PREFIX: "ml-bot-image-classification-2020-12-02-19-34-31-000",
        AWS_DEFAULT_REGION: "cn-north-1",
      },
      linuxParameters: linuxParameters,
    })
    this.trainingTaskDef.addToExecutionRolePolicy(asgPolicy)
    this.trainingTaskDef.addToTaskRolePolicy(asgPolicy)
    
    this.inferenceTaskDef = new ecs.Ec2TaskDefinition(this, "InferenceTask");
    this.inferenceTaskDef.addContainer("inferenceContainer", {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../docker/inference')),
      memoryLimitMiB: 3500, // 4096,
      logging,
      environment: {
        MODEL_BUCKET: props.modelBucket.bucketName,
        MODEL_PREFIX: "ml-bot-image-classification-2020-12-02-19-34-31-000",
        AWS_DEFAULT_REGION: "cn-north-1",
      },
      linuxParameters: linuxParameters,
    }).addPortMappings(
      { containerPort: 8080, hostPort: 8080, protocol: ecs.Protocol.TCP }
    )
    this.inferenceTaskDef.addToExecutionRolePolicy(asgPolicy)
    this.inferenceTaskDef.addToTaskRolePolicy(asgPolicy)
    
  }
}

