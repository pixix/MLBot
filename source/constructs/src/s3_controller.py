import boto3
from iam_helper import IamHelper

def put_object(bucket, key, img_bytes):
    helper = IamHelper
    client = boto3.client("s3")
    # s3 = boto3.resource('s3')
    # obj = s3.Object('bucket_name','key')
    response = client.put_object(
        ACL = 'public-read',
        Body = img_bytes,
        Bucket = bucket,
        Key = key
    )
    region = IamHelper.get_region()
    suffix = ".cn" ######## WARNING: fix this for global region
    obj_url = "https://{}.s3.{}.amazonaws.com{}/{}".format(bucket, region, suffix, key)
    return obj_url


