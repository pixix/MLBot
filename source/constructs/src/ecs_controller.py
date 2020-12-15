import boto3
import os
import sys
from iam_helper import IamHelper
import json

thisdir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(thisdir, ".lambda_dependencies"))
import requests

def create_training_job(bucket, job_name, task):
    print("Creating training job {}".format(job_name))
    helper = IamHelper
    client = boto3.client("ecs")
    response = client.run_task(
        launchType = 'EC2',
        taskDefinition = os.environ["TRAINING_TASK_ARN"],
        cluster = os.environ["CLUSTER_ARN"],
        overrides={ 'containerOverrides': [{
            'name': 'trainingContainer',
            'environment': [
                { 'name': 'DATA_BUCKET', 'value': os.environ["DATA_BUCKET"] },
                { 'name': 'DATA_PREFIX', 'value': job_name },
                { 'name': 'MODEL_BUCKET', 'value': os.environ["MODEL_BUCKET"] },
                { 'name': 'MODEL_PREFIX', 'value': job_name },
                { 'name': 'TASK_TYPE', 'value': "Training" },
            ],
        }], },
        placementConstraints=[
            { 'type': 'memberOf', 'expression': 'attribute:ecs.instance-type =~ g4dn.*' },
        ],
    )
    print(response)
    task0 = response["tasks"][0]
    container0 = task0["containers"][0]
    taskArn = container0["taskArn"]
    taskId = taskArn.split("/")[-1]
    return taskId
    

def describe_training_job(job):
    # return ["Starting", "Downloading", "Training"]
    return ["Starting", "Downloading", "Training", "Uploading", "Completed"]


def describe_training_job_artifact(job):
    return ""


def create_endpoint(job_name, model_uri):
    print("Creating inference endpoint {} from {}".format(job_name, model_uri))
    helper = IamHelper
    client = boto3.client("ecs")
    response = client.run_task(
        launchType = 'EC2',
        taskDefinition = os.environ["INFERENCE_TASK_ARN"],
        cluster = os.environ["CLUSTER_ARN"],
        overrides={ 'containerOverrides': [{
            'name': 'inferenceContainer',
            'environment': [
                { 'name': 'MODEL_BUCKET', 'value': os.environ["MODEL_BUCKET"] },
                { 'name': 'MODEL_PREFIX', 'value': job_name },
                { 'name': 'MODEL_URI', 'value': model_uri },
                { 'name': 'TASK_TYPE', 'value': "Inference" },
            ],
        }], },
        placementConstraints=[
            { 'type': 'memberOf', 'expression': 'attribute:ecs.instance-type =~ c5.*' },
        ],
    )
    print(response)
    tasks = response["tasks"]
    taskArn = ""
    if len(tasks) > 0:
        task0 = tasks[0]
        containers = task0["containers"]
        container0 = containers[0]
        taskArn = container0["taskArn"]
    return taskArn


def describe_endpoint(job):
    taskTable = os.environ["TASK_TABLE"]
    dynamodb = boto3.client("dynamodb")
    response = dynamodb.get_item(
        TableName = taskTable,
        Key = {
            "TrainingTaskId": { "S": job },
        }
    )
    item = response.get("Item", None)
    if item is not None:
        status = "InService"
        task_id = item["InferenceTaskId"]["S"]
        if task_id == None or task_id == "":
            status = "Creating"
    else:
        status = "Creating"
        task_id = ""
    return status, task_id
    # return "InService", "ml-bot-image-classification-2020-10-26-02-57-06-143"


def list_endpoints(job):
    # client = boto3.client("sagemaker")
    # endpoints = client.list_endpoints()
    # names = [endpoint["EndpointName"] for endpoint in endpoints["Endpoints"]]
    # stats = [endpoint["EndpointStatus"] for endpoint in endpoints["Endpoints"]]
    # return [{"Name": n, "Status": s} for n, s in zip(names, stats)]
    return []


def invoke_endpoint(endpoint, img):

    ecs = boto3.client("ecs")
    response = ecs.describe_tasks(
        cluster = os.environ["CLUSTER_ARN"],
        tasks = [endpoint,]
    )
    print(response)
    tasks = response["tasks"]
    task0 = tasks[0]
    containerInstanceArn = task0["containerInstanceArn"]
    response = ecs.describe_container_instances(
        cluster = os.environ["CLUSTER_ARN"],
        containerInstances = [containerInstanceArn,]
    )
    print(response)
    containerInstances = response["containerInstances"]
    containerInstance0 = containerInstances[0]
    ec2InstanceId = containerInstance0["ec2InstanceId"]

    ec2 = boto3.client("ec2")
    response = ec2.describe_instances(
        InstanceIds=[
            ec2InstanceId,
        ],
    )
    print(response)
    Reservation0 = response["Reservations"][0]
    Instance0 = Reservation0["Instances"][0]
    NetworkInterface0 = Instance0["NetworkInterfaces"][0]
    PrivateIpAddress = NetworkInterface0["PrivateIpAddress"]
    
    url = "http://{}:8080/invocations".format(PrivateIpAddress)
    print(url)
    
    data_json = img
    headers = {'Content-type': 'image/jpeg'}
    response = requests.post(url, data=data_json, headers=headers)

    print(response.text)
    outputs = response.text
    outputs_str = outputs # .decode("utf-8")
    outputs_dict = json.loads(outputs_str)
    outputs_dict.update(Status="Success")
    outputs_str = json.dumps(outputs_dict)
    return outputs_str
