import boto3
from iam_helper import IamHelper

def get_datetime_str():
    from datetime import datetime
    now = datetime.now()
    tt = now.timetuple()
    prefix = tt[0]
    name = '-'.join(['{:02}'.format(t) for t in tt[1:-3]])
    suffix = '{:03d}'.format(now.microsecond)[:3]
    job_name_suffix = "{}-{}-{}".format(prefix, name, suffix)
    return job_name_suffix

def create_training_job(bucket, jobname, task):
    s3_path = "s3://{}/{}/".format(bucket, jobname)
    helper = IamHelper
    client = boto3.client("sagemaker")
    job_name = "ml-bot-{}-{}".format(task.replace("_", "-"), get_datetime_str())
    account = IamHelper.get_account_id()
    region = IamHelper.get_region()
    partition = IamHelper.get_partition()
    role_name = "AmazonSageMaker-ExecutionRole-20200512T121482"
    role_arn = "arn:{}:iam::{}:role/service-role/{}".format(partition, account, role_name)
    s3_output_path = 's3://sagemaker-{}-{}/'.format(region, account)
    response = client.create_training_job(
        TrainingJobName = job_name,
        HyperParameters = {},
        AlgorithmSpecification={
            'TrainingImage': '250779322837.dkr.ecr.cn-north-1.amazonaws.com.cn/autogluon-sagemaker-training-dev',
            'TrainingInputMode': 'File',
        },
        RoleArn = role_arn,
        InputDataConfig=[
            {
                'ChannelName': "training", # environment variable SM_CHANNEL_TRAINING and /opt/ml/input/data/training
                'DataSource': {
                    'S3DataSource': {
                        'S3DataType': 'S3Prefix',
                        'S3Uri': s3_path,
                    },
                },
            },
        ],
        OutputDataConfig={
            'S3OutputPath': s3_output_path
        },
        ResourceConfig = {
            'InstanceType': 'ml.g4dn.xlarge',
            'InstanceCount': 1,
            'VolumeSizeInGB': 64,
        },
        StoppingCondition = {
            'MaxRuntimeInSeconds': 600,
        },
    )
    return response

def create_endpoint(job_name, model_uri):
    print("Creating SageMaker Endpoint {} from {}".format(job_name, model_uri))
    helper = IamHelper
    client = boto3.client("sagemaker")
    account = IamHelper.get_account_id()
    region = IamHelper.get_region()
    partition = IamHelper.get_partition()
    role_name = "AmazonSageMaker-ExecutionRole-20200512T121482"
    role_arn = "arn:{}:iam::{}:role/service-role/{}".format(partition, account, role_name)
    s3_output_path = 's3://sagemaker-{}-{}/'.format(region, account)
    response = client.create_model(
        ModelName = job_name,
        PrimaryContainer = {
            "Image": "250779322837.dkr.ecr.cn-north-1.amazonaws.com.cn/autogluon-sagemaker-inference-dev",
            "ModelDataUrl": model_uri
        },
        ExecutionRoleArn = role_arn
    )
    response = client.create_endpoint_config(
        EndpointConfigName = job_name,
        ProductionVariants=[
            {
                'VariantName': 'AllTraffic',
                'ModelName': job_name,
                'InitialInstanceCount': 1,
                'InstanceType': 'ml.c5.large',
            },
        ]
    )
    response = client.create_endpoint(
        EndpointName = job_name,
        EndpointConfigName = job_name
    )

def describe_training_job(job):
    helper = IamHelper
    client = boto3.client("sagemaker")

    training_jobs = client.list_training_jobs(MaxResults=100).get("TrainingJobSummaries", [])
    names = [j['TrainingJobName'] for j in training_jobs]
    stats = []
    # print("names={}".format(str(names)))
    
    if job in names:
        response = client.describe_training_job(TrainingJobName=job)
        transitions = response["SecondaryStatusTransitions"]
        # status = transitions[-1].get("Status", "Unknown")
        stats = [t.get("Status", "") for t in transitions]

    return stats

def describe_training_job_artifact(job):
    helper = IamHelper
    client = boto3.client("sagemaker")

    training_jobs = client.list_training_jobs(MaxResults=100).get("TrainingJobSummaries", [])
    names = [j['TrainingJobName'] for j in training_jobs]
    artifacts = ""
    # print("names={}".format(str(names)))
    
    if job in names:
        response = client.describe_training_job(TrainingJobName=job)
        artifacts = response["ModelArtifacts"]["S3ModelArtifacts"]

    return artifacts

def describe_endpoint(job):
    client = boto3.client("sagemaker")
    endpoints = client.list_endpoints()
    names = [endpoint["EndpointName"] for endpoint in endpoints["Endpoints"]]
    stats = [endpoint["EndpointStatus"] for endpoint in endpoints["Endpoints"]]
    status = "NotStarted"
    if job in names:
        for idx, name in enumerate(names):
            if job == name:
                status = stats[idx]
    return status

def list_endpoints(job):
    client = boto3.client("sagemaker")
    endpoints = client.list_endpoints()
    names = [endpoint["EndpointName"] for endpoint in endpoints["Endpoints"]]
    stats = [endpoint["EndpointStatus"] for endpoint in endpoints["Endpoints"]]
    return [{"Name": n, "Status": s} for n, s in zip(names, stats)]

def invoke_endpoint(body_str):

    session = Session(region_name = "cn-north-1")
    runtime = session.client("runtime.sagemaker")
    response = runtime.invoke_endpoint(
        EndpointName=endpoint_name,
        ContentType="image/jpeg",
        Body=img,  # json.dumps(data),
    )
    print(response)
    outputs = response["Body"].read()
    outputs_str = outputs.decode("utf-8")
    outputs_dict = json.loads(outputs_str)
    outputs_dict.update(Status="Success")
    outputs_str = json.dumps(outputs_dict)

    print(outputs_str)
    
