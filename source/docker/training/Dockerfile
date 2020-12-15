ARG REGISTRY_URI
FROM 727897471807.dkr.ecr.cn-north-1.amazonaws.com.cn/mxnet-inference:1.6.0-gpu-py3

RUN pip install -i https://opentuna.cn/pypi/web/simple autogluon==0.0.12

ENV PYTHONUNBUFFERED=TRUE
ENV PYTHONDONTWRITEBYTECODE=TRUE
ENV PATH="/opt/ml/code:${PATH}"

RUN apt install -y unzip

RUN mkdir -p /root/.mxnet/models/
RUN wget -P /root/.mxnet/models/ https://apache-mxnet.s3-accelerate.dualstack.amazonaws.com/gluon/models/resnet50_v2-ecdde353.zip
RUN cd /root/.mxnet/models/ && unzip resnet50_v2-ecdde353.zip
RUN rm -f /root/.mxnet/models/resnet50_v2-ecdde353.zip

COPY train.py /opt/ml/code/
WORKDIR /opt/ml/code

ENTRYPOINT ["python", "-u", "train.py"]

