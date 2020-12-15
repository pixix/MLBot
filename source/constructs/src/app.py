import json
import os

# from sagemaker_controller import create_training_job, create_endpoint, \
#     describe_training_job, describe_training_job_artifact, describe_endpoint, \
#     list_endpoints, invoke_endpoint
from ecs_controller import create_training_job, create_endpoint, \
    describe_training_job, describe_training_job_artifact, describe_endpoint, \
    list_endpoints, invoke_endpoint

from s3_controller import put_object
from resources import html
from boto3.session import Session
import boto3
import base64


def lambda_handler(event, context):
    """Sample pure Lambda function

    Parameters
    ----------
    event: dict, required
        API Gateway Lambda Proxy Input Format

        Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format

    context: object, required
        Lambda Context runtime methods and attributes

        Context doc: https://docs.aws.amazon.com/lambda/latest/dg/python-context-object.html

    Returns
    ------
    API Gateway Lambda Proxy Output Format: dict

        Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
    """

    print(event)

    resource = event.get("source", None)
    if resource == "aws.sagemaker":
        detail = event["detail"]
        job_name = detail["TrainingJobName"]
        transitions = detail["SecondaryStatusTransitions"]
        transition0 = transitions[-1]
        status = transition0["Status"]
        status_msg = transition0["StatusMessage"]
    elif resource == "aws.ecs":
        detail = event["detail"]
        container0 = detail["containers"][0]
        status = container0["lastStatus"]
        taskArn = container0["taskArn"]
        job_name = taskArn.split("/")[-1]
    else:
        httpMethod = event["httpMethod"]
        resource = event["resource"]
        body_str = event["body"]

    response = {}
    if resource == "/hello":
        response = {
            "statusCode": 200,
            "body": html,
            "headers": {
                "Content-Type": "text/html",
            },
        }
    elif resource == "/upload":
        print(body_str)

        body_dict = json.loads(body_str)
        print(body_dict)
        job = body_dict["job"]
        classname = body_dict["class"]
        filename = body_dict["filename"]
        img_base64 = body_dict["data"]
        print(img_base64)
        img_base64 = img_base64.split(",")[1]
        print(img_base64)
        img_bytes = base64.decodebytes(img_base64.encode("utf-8"))

        bucket = os.environ["DATA_BUCKET"]
        key = "{}/{}/{}".format(job, classname, filename)
        obj_url = put_object(bucket, key, img_bytes)

        response = {
            "statusCode": 200,
            "body": json.dumps({"Status": "Success", "Bucket": bucket, "Key": key,
                                "ObjectUrl": obj_url}),
            "headers": {
                "Content-Type": "application/json",
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        }
    elif resource == "/training_job":
        print(body_str)

        body_dict = json.loads(body_str)
        jobname = body_dict["job"]
        task = body_dict["task"]

        bucket = os.environ["DATA_BUCKET"]
        msg = {}
        try:
            # job_arn = create_training_job(bucket, jobname, task)["TrainingJobArn"]
            # msg = {"Status": "Success", "TrainingJob": job_arn.split("/")[1]}
            job_name = create_training_job(bucket, jobname, task)
            msg = {"Status": "Success", "TrainingJob": job_name}
        except Exception as e:
            msg = {"Status": "Failure", "Message": str(e)}
        print(msg)

        response = {
            "statusCode": 200,
            "body": json.dumps(msg),
            "headers": {
                "Content-Type": "application/json",
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        }
    elif resource == "/status":
        # print(body_str)

        body_dict = json.loads(body_str)
        job = body_dict.get("endpoint", "")
        # print("endpoint={}".format(job))

        msg = {}
        try:
            transitions = describe_training_job(job)
            artifacts = ""
            if "Completed" in transitions:
                artifacts = describe_training_job_artifact(job)
            status, name = describe_endpoint(job)
            # endpoints = list_endpoints(job)
            msg = {"Status": "Success", "TrainingJobStatus": transitions, \
                   "EndpointStatus": status, "EndpointName": name, \
                   "ModelArtifacts": artifacts}
        except Exception as e:
            msg = {"Status": "Failure", "Message": str(e)}
        print(msg)

        response = {
            "statusCode": 200,
            "body": json.dumps(msg),
            "headers": {
                "Content-Type": "application/json",
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        }
    elif resource == "/predict":
        print(body_str)

        body_dict = json.loads(body_str)
        print(body_dict)
        img_base64 = body_dict["imagedata"]
        endpoint = body_dict["endpoint"]
        print(img_base64)
        img_base64 = img_base64.split(",")[1]
        print(img_base64)

        img = base64.decodebytes(img_base64.encode("utf-8"))

        outputs_str = invoke_endpoint(endpoint, img)

        response = {
            "statusCode": 200,
            # "body": body_str,
            "body": outputs_str, # json.dumps({}),
            "headers": {
                "Content-Type": "application/json",
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        }
    elif resource == "aws.sagemaker":
        print("===== {}: {} =====".format(status, status_msg))

        if status == "Completed":
            artifacts = detail["ModelArtifacts"]["S3ModelArtifacts"]
            create_endpoint(job_name, artifacts)

        response = {
            "statusCode": 200,
            "body": json.dumps({"TraningJobName":job_name}),
            "headers": {
                "Content-Type": "application/json",
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        }
    elif resource == "aws.ecs":
        print("===== STATUS : {} =====".format(status))
        print(detail)
        job_name = ""

        if status == "STOPPED":
            overrides = detail["overrides"]["containerOverrides"]
            environment = overrides[0]["environment"]
            env_dict = dict([(env["name"], env["value"]) for env in environment])
            task_type = env_dict["TASK_TYPE"]
            if task_type == "Training":
                model_bucket = env_dict["MODEL_BUCKET"]
                model_prefix = env_dict["MODEL_PREFIX"]
                artifact = "s3://{}/{}/model.tar".format(model_bucket, model_prefix)
                job_name = model_prefix
                inferenceTaskArn = create_endpoint(job_name, artifact)

                taskTable = os.environ["TASK_TABLE"]
                dynamodb = boto3.client("dynamodb")
                dynamodb.put_item(
                    TableName = taskTable,
                    Item = {
                        "TrainingTaskId": { "S": taskArn.split("/")[-1] },
                        "InferenceTaskId": { "S": inferenceTaskArn.split("/")[-1] },
                        "InferenceTaskArn": { "S": inferenceTaskArn },
                        "JobId": { "S": job_name },
                        "Artifact": { "S": artifact },
                    }
                )

        response = {
            "statusCode": 200,
            "body": json.dumps({"TraningJobName": job_name}),
            "headers": {
                "Content-Type": "application/json",
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        }
    else:
        response = {
            "statusCode": 200,
            "body": json.dumps({}),
            "headers": {
                "Content-Type": "application/json",
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        }
    print(response)

    return response
