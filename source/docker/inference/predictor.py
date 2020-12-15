import sys
import os
import argparse
import logging
import warnings
import io
import json
import subprocess

import cv2
import mxnet as mx
from mxnet import nd, autograd, gluon
from mxnet.gluon.data.vision import transforms
import math
import warnings
import numpy as np

warnings.filterwarnings("ignore",category=FutureWarning)

# sys.path.append(os.path.join(os.path.dirname(__file__), '/opt/ml/code/package'))

import pickle
# from io import StringIO
from timeit import default_timer as timer
from collections import Counter

with warnings.catch_warnings():
    warnings.filterwarnings("ignore",category=DeprecationWarning)
    # from autogluon import ImageClassification as task

import flask

# import sagemaker
# from sagemaker import get_execution_role, local, Model, utils, fw_utils, s3
# import boto3
import tarfile

# import pandas as pd

prefix = '/opt/ml/'
# model_path = os.path.join(prefix, 'model')
model_path = os.environ.get('SM_MODEL_DIR', '/opt/ml/model')
ctx = mx.gpu() if mx.context.num_gpus() else mx.cpu()

# A singleton for holding the model. This simply loads the model and holds it.
# It has a predict function that does a prediction based on the model and the input data.

class ScoringService(object):
    model = None                # Where we keep the model when it's loaded

    @classmethod
    def get_model(cls):
        """Get the model object for this instance, loading it if it's not already loaded."""
        if cls.model == None:
            print(os.listdir("/opt/ml/model/"))
            cls.model = gluon.nn.SymbolBlock.imports(
                "/opt/ml/model/custom_model-symbol.json", ['data'],
                "/opt/ml/model/custom_model-0000.params", ctx=ctx)
        return cls.model

    @classmethod
    def predict(cls, input_np):
        """For the input, do the predictions and return them.
        Args:
            input (a pandas dataframe): The data on which to do the predictions. There will be
                one prediction per row in the dataframe"""
        net = cls.get_model()
        res = net(mx.nd.array(input_np, ctx))
        prob = mx.nd.softmax(res)
        prob = prob.asnumpy()

        prob_sqr = (prob * prob) / np.sum(prob * prob)
        prob = prob_sqr
        prob_sqr = (prob * prob) / np.sum(prob * prob)
        prob = prob_sqr
        
        print("prob={}".format(str(prob)))
        clsidx = np.argmax(prob)
        classes = []
        with open("/opt/ml/model/classes.txt", "r") as fp:
            classes = fp.readlines()
            classes = [l.strip() for l in classes]
        return int(clsidx), classes, prob.flatten().tolist()

# The flask app for serving predictions
app = flask.Flask(__name__)

@app.route('/ping', methods=['GET'])
def ping():
    """Determine if the container is working and healthy. In this sample container, we declare
    it healthy if we can load the model successfully."""
    # health = ScoringService.get_model() is not None  # You can insert a health check here
    health = 1

    status = 200 if health else 404
    print("===================== PING ===================")
    return flask.Response(response="{'status': 'Healthy'}\n", status=status, mimetype='application/json')

@app.route('/invocations', methods=['POST'])
def invocations():
    """Do an inference on a single batch of data. In this sample server, we take data as CSV, convert
    it to a pandas data frame for internal use and then convert the predictions back to CSV (which really
    just means one prediction per line, since there's a single column.
    """
    data = None
    print("================ INVOCATIONS =================")

    # Convert from CSV to pandas
    if flask.request.content_type == 'application/json':
        data = flask.request.data.decode('utf-8')
        data = json.loads(data)
        data_np = np.asarray(data['data'])
    elif flask.request.content_type == 'image/jpeg':
        data = flask.request.data
        print("len(data)={}".format(len(data)))
        data_np = np.fromstring(data, dtype=np.uint8)
        print("data_np.shape={}".format(str(data_np.shape)))
        print(' '.join(['{:x}'.format(d) for d in data_np[:20].tolist()]), flush=True)
        data_np = cv2.imdecode(data_np, cv2.IMREAD_UNCHANGED)
        data_np = data_np.astype(np.float32) - [123.675, 116.28, 103.53]
        data_np /= [58.395, 57.12, 57.375]
        data_np = data_np.transpose(2, 0, 1)
        data_np = np.expand_dims(data_np, axis=0)
    else:
        return flask.Response(response='This predictor only supports JSON data and JPEG image data',
                              status=415, mimetype='text/plain')
    print(data_np.shape)

    # Do the prediction
    clsidx, classes, prob = ScoringService.predict(data_np)
    print("classes={}".format(str(classes)))
    print("prob={}".format(str(prob)))
    results = [{"Class": cls, "Probability": p} for cls, p in zip(classes, prob)]
    print("results={}".format(str(results)))
    output_dict = {"ClassIndex": clsidx, "Results": results}
    output_dict_str = json.dumps(output_dict)
    print(output_dict_str)

    # Convert from numpy back to CSV
    out = io.StringIO()
    # pd.DataFrame({'results':predictions}).to_csv(out, header=False, index=False)
    out.write(output_dict_str)
    result = out.getvalue()

    return flask.Response(response=result, status=200, mimetype='application/json')
