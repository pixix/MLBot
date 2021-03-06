#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""4. Transfer Learning with Your Own Image Dataset
=======================================================

Dataset size is a big factor in the performance of deep learning models.
``ImageNet`` has over one million labeled images, but
we often don't have so much labeled data in other domains.
Training a deep learning models on small datasets may lead to severe overfitting.

Transfer learning is a technique that addresses this problem.
The idea is simple: we can start training with a pre-trained model,
instead of starting from scratch.
As Isaac Newton said, "If I have seen further it is by standing on the
shoulders of Giants".
"""

import argparse
import os
import boto3
import mxnet as mx
import random
import shutil

test_size = 0.3

data_bucket = os.environ.get("DATA_BUCKET")
data_prefix = os.environ.get("DATA_PREFIX")
model_bucket = os.environ.get("MODEL_BUCKET")
model_prefix = os.environ.get("MODEL_PREFIX")

print("DATA_BUCKET={}".format(data_bucket))
print("DATA_PREFIX={}".format(data_prefix))
print("MODEL_BUCKET={}".format(model_bucket))
print("MODEL_PREFIX={}".format(model_prefix))

basename = ''

train_dir = '/opt/ml/input/data/training'
val_dir = '/opt/ml/input/data/validation'
output_dir = '/opt/ml/output'
model_dir = '/opt/ml/model'

for dirname in [train_dir, output_dir, model_dir]:
    if not os.path.exists(dirname):
        os.makedirs(dirname)

# Download all objects
print("Downloading from s://{}/{}/ to {}".format(data_bucket, data_prefix, train_dir))
s3 = boto3.client('s3', region_name="cn-north-1")
all_keys = []
response = s3.list_objects_v2(Bucket=data_bucket, Prefix=data_prefix)
while True:
    keys = response["Contents"]
    for ctx in keys:
        key = ctx["Key"]
        relpath = key[len(data_prefix):].strip('/')
        dirname = os.path.dirname(relpath)
        basename = os.path.basename(relpath)
        fulldirname = os.path.join(train_dir, dirname)
        fullpath = os.path.join(fulldirname, basename)
        if not os.path.exists(fulldirname):
            os.makedirs(fulldirname)
        s3.download_file(data_bucket, key, fullpath)
        all_keys.append(fullpath)
    truncated = response["IsTruncated"]
    if not truncated:
        break
    token = response["NextContinuationToken"]
    response = s3.list_objects_v2(Bucket=data_bucket, Prefix=data_prefix, ContinuationToken=token)

# Generate validation set
print("Moving from {} to {}".format(train_dir, val_dir))
random.shuffle(all_keys)
val_keys = all_keys[:int(len(all_keys) * test_size)]
for orig_key in val_keys:
    key = orig_key.replace(train_dir, val_dir)
    dirname = os.path.dirname(key)
    if not os.path.exists(dirname):
        os.makedirs(dirname)
    shutil.move(orig_key, key)

classes = os.listdir(train_dir)
print("classes={}, len(val_data)={}, len(all_data)={}".format(classes, len(val_keys), len(all_keys)))
with open(os.path.join(model_dir, "classes.txt"), "w") as fp:
    fp.write('\n'.join(classes))
    fp.write('\n')

################################################################################
# Hyperparameters
# ----------
#
# First, let's import all other necessary libraries.

import mxnet as mx
import numpy as np
import os, time, shutil

from mxnet import gluon, image, init, nd
from mxnet import autograd as ag
from mxnet.gluon import nn
from mxnet.gluon.data.vision import transforms
from gluoncv.utils import makedirs
from gluoncv.model_zoo import get_model

################################################################################
# We set the hyperparameters as following:

num_classes = len(classes)

epochs = 5
lr = 0.001
per_device_batch_size = 64
momentum = 0.9
wd = 0.0001

lr_factor = 0.75
lr_steps = [10, 20, 30, np.inf]

num_gpus = 1
num_workers = 8
ctx = [mx.gpu(i) for i in range(num_gpus)] if num_gpus > 0 else [mx.cpu()]
batch_size = per_device_batch_size * max(num_gpus, 1)

################################################################################
# Things to keep in mind:
#
# 1. ``epochs = 5`` is just for this tutorial with the tiny dataset. please change it to a larger number in your experiments, for instance 40.
# 2. ``per_device_batch_size`` is also set to a small number. In your experiments you can try larger number like 64.
# 3. remember to tune ``num_gpus`` and ``num_workers`` according to your machine.
# 4. A pre-trained model is already in a pretty good status. So we can start with a small ``lr``.
#
# Data Augmentation
# -----------------
#
# In transfer learning, data augmentation can also help.
# We use the following augmentation in training:
#
# 2. Randomly crop the image and resize it to 224x224
# 3. Randomly flip the image horizontally
# 4. Randomly jitter color and add noise
# 5. Transpose the data from height*width*num_channels to num_channels*height*width, and map values from [0, 255] to [0, 1]
# 6. Normalize with the mean and standard deviation from the ImageNet dataset.
#
jitter_param = 0.4
lighting_param = 0.1

transform_train = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomFlipLeftRight(),
    transforms.RandomColorJitter(brightness=jitter_param, contrast=jitter_param,
                                 saturation=jitter_param),
    transforms.RandomLighting(lighting_param),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

transform_test = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

################################################################################
# With the data augmentation functions, we can define our data loaders:

train_path = train_dir
val_path = val_dir

train_data = gluon.data.DataLoader(
    gluon.data.vision.ImageFolderDataset(train_path).transform_first(transform_train),
    batch_size=batch_size, shuffle=True, num_workers=num_workers)

val_data = gluon.data.DataLoader(
    gluon.data.vision.ImageFolderDataset(val_path).transform_first(transform_test),
    batch_size=batch_size, shuffle=False, num_workers = num_workers)

################################################################################
#
# Note that only ``train_data`` uses ``transform_train``, while
# ``val_data`` and ``test_data`` use ``transform_test`` to produce deterministic
# results for evaluation.
#
# Model and Trainer
# -----------------
#
# We use a pre-trained ``ResNet50_v2`` model, which has balanced accuracy and
# computation cost.

model_name = 'ResNet50_v2'
finetune_net = get_model(model_name, pretrained=True)
with finetune_net.name_scope():
    finetune_net.output = nn.Dense(num_classes)
finetune_net.output.initialize(init.Xavier(), ctx = ctx)
finetune_net.collect_params().reset_ctx(ctx)
finetune_net.hybridize()

trainer = gluon.Trainer(finetune_net.collect_params(), 'sgd', {
                        'learning_rate': lr, 'momentum': momentum, 'wd': wd})
metric = mx.metric.Accuracy()
L = gluon.loss.SoftmaxCrossEntropyLoss()

################################################################################
# Here's an illustration of the pre-trained model
# and our newly defined model:
#
# |image-model|
#
# Specifically, we define the new model by::
#
# 1. load the pre-trained model
# 2. re-define the output layer for the new task
# 3. train the network
#
# This is called "fine-tuning", i.e. we have a model trained on another task,
# and we would like to tune it for the dataset we have in hand.
#
# We define a evaluation function for validation and testing.

def test(net, val_data, ctx):
    metric = mx.metric.Accuracy()
    for i, batch in enumerate(val_data):
        data = gluon.utils.split_and_load(batch[0], ctx_list=ctx, batch_axis=0, even_split=False)
        label = gluon.utils.split_and_load(batch[1], ctx_list=ctx, batch_axis=0, even_split=False)
        outputs = [net(X) for X in data]
        metric.update(label, outputs)

    return metric.get()

################################################################################
# Training Loop
# -------------
#
# Following is the main training loop. It is the same as the loop in
# `CIFAR10 <dive_deep_cifar10.html>`__
# and ImageNet.
#
# .. note::
#
#     Once again, in order to go through the tutorial faster, we are training on a small
#     subset of the original ``MINC-2500`` dataset, and for only 5 epochs. By training on the
#     full dataset with 40 epochs, it is expected to get accuracy around 80% on test data.

lr_counter = 0
num_batch = len(train_data)
best_epoch = 0
best_val_acc = 0
model_prefix = os.path.join(model_dir, "custom_model")

for epoch in range(epochs):
    if epoch == lr_steps[lr_counter]:
        trainer.set_learning_rate(trainer.learning_rate*lr_factor)
        lr_counter += 1

    tic = time.time()
    train_loss = 0
    metric.reset()

    for i, batch in enumerate(train_data):
        data = gluon.utils.split_and_load(batch[0], ctx_list=ctx, batch_axis=0, even_split=False)
        label = gluon.utils.split_and_load(batch[1], ctx_list=ctx, batch_axis=0, even_split=False)
        with ag.record():
            outputs = [finetune_net(X) for X in data]
            loss = [L(yhat, y) for yhat, y in zip(outputs, label)]
        for l in loss:
            l.backward()

        trainer.step(batch_size)
        train_loss += sum([l.mean().asscalar() for l in loss]) / len(loss)

        metric.update(label, outputs)

    _, train_acc = metric.get()
    train_loss /= num_batch

    _, val_acc = test(finetune_net, val_data, ctx)
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        best_epoch = epoch
        finetune_net.export(model_prefix, 0)
    
    print('[Epoch %d] Train-acc: %.3f, loss: %.3f | Val-acc: %.3f | time: %.1f' %
             (epoch, train_acc, train_loss, val_acc, time.time() - tic))

# Create archive file for uploading to s3 bucket
model_path = os.path.join(model_dir, "model.tar")
print("Creating uncompressed tar archive {}".format(model_path))
import tarfile
tar = tarfile.open(model_path, "w")
for name in ["{}-0000.params".format(model_prefix),
             "{}-symbol.json".format(model_prefix),
             os.path.join(model_dir, "classes.txt")]:
    basename = os.path.basename(name)
    tar.add(name, arcname=basename)
tar.close()

# Upload to S3 bucket
print("Uploading tar archive {} to s3://{}/{}/".format(model_path, model_bucket, data_prefix))
s3.upload_file(model_path, model_bucket, "{}/model.tar".format(data_prefix))

################################################################################
#
# Next
# ----
#
# Now that you have learned to muster the power of transfer
# learning, to learn more about training a model on
# ImageNet, please read `this tutorial <dive_deep_imagenet.html>`__.
#
# The idea of transfer learning is the basis of
# `object detection <../examples_detection/index.html>`_ and
# `semantic segmentation <../examples_segmentation/index.html>`_,
# the next two chapters of our tutorial.
#
# .. |image-minc| image:: https://raw.githubusercontent.com/dmlc/web-data/master/gluoncv/datasets/MINC-2500.png
# .. |image-model| image:: https://zh.gluon.ai/_images/fine-tuning.svg
