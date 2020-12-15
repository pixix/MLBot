// Task Type Icons
import ICON_IMAGE from "../images/option-image.png";
import ICON_SKELETON from "../images/option-skeleton.png";
import ICON_FACE from "../images/option-face.png";
import ICON_CAR from "../images/option-car.png";
// import ICON_MYSQL from "../images/icon-mysql.png";

export enum EnumClassficationStatus {
  INIT = "INIT",
  UPLOADING = "UPLOADING",
  TRAINING = "TRAINING",
  TRAINING_COMPLETE = "TRAINING_COMPLETE",
}

export const TRAINING_STATUS_LIST = [
  {
    name: "Starting",
    en_Status: "Starting",
    "zh-CN_Status": "启动中",
    en_StatusMessage: "Preparing the instances for training",
    "zh-CN_StatusMessage": "准备实例以进行训练",
  },
  {
    name: "Downloading",
    en_Status: "Downloading",
    "zh-CN_Status": "下载文件中",
    en_StatusMessage: "Downloading input data",
    "zh-CN_StatusMessage": "下载输入数据",
  },
  {
    name: "Training",
    en_Status: "Training",
    "zh-CN_Status": "训练中",
    en_StatusMessage:
      "Training image download completed. Training in progress.",
    "zh-CN_StatusMessage": "训练图像下载完成。训练正在进行中。",
  },
  {
    name: "Uploading",
    en_Status: "Uploading",
    "zh-CN_Status": "上传模型",
    en_StatusMessage: "Uploading generated training model",
    "zh-CN_StatusMessage": "上传生成的模型",
  },
  {
    name: "Completed",
    en_Status: "Completed",
    "zh-CN_Status": "模型完成",
    en_StatusMessage: "Training job completed",
    "zh-CN_StatusMessage": "模型训练任务完成",
  },
  {
    name: "In-Service",
    en_Status: "In-Service",
    "zh-CN_Status": "服务已就绪",
    en_StatusMessage: "Predict service is ready",
    "zh-CN_StatusMessage": "预测服务已就绪",
  },
];

// Task Tyep Enum
export enum EnumTaskType {
  IMAGE = "IMAGE",
  SKELETON = "SKELETON",
  FACE = "FACE",
  CAR = "CAR",
}

export const API_METHOD_LIST = [
  {
    name: "POST",
    value: "POST",
  },
  {
    name: "GET",
    value: "GET",
  },
  {
    name: "PUT",
    value: "PUT",
  },
];

// Task List
export const TYPE_LIST = [
  {
    id: 1,
    en_name: "Image Classfication",
    "zh-CN_name": "图像分类",
    value: EnumTaskType.IMAGE,
    imageSrc: ICON_IMAGE,
    disabled: false,
  },
  {
    id: 2,
    en_name: "Skeleton Detection",
    "zh-CN_name": "骨架识别",
    value: EnumTaskType.SKELETON,
    imageSrc: ICON_SKELETON,
    disabled: false,
  },
  {
    id: 3,
    en_name: "Face Detection",
    "zh-CN_name": "面部识别",
    value: EnumTaskType.FACE,
    imageSrc: ICON_FACE,
    disabled: false,
  },
  {
    id: 4,
    en_name: "Car License Detection",
    "zh-CN_name": "车牌识别",
    value: EnumTaskType.CAR,
    imageSrc: ICON_CAR,
    disabled: false,
  },
];

// Task Tyep Enum
export enum EnumSourceType {
  WEBCAMERA = "WEBCAMERA",
  S3URL = "S3URL",
  UPLOAD = "UPLOAD",
}

// Task List
export const SOURCE_TYPE = [
  {
    id: 1,
    en_title: "Web camera ",
    "zh-CN_title": "网络摄像头",
    value: EnumSourceType.WEBCAMERA,
    en_desc:
      "Deliver all types of content (including streaming). This is the most common choice.",
    "zh-CN_desc": "交付所有类型的内容（包括流式传输）。这是最常见的选择",
  },
  {
    id: 2,
    en_title: "Import from S3",
    "zh-CN_title": "从S3导入",
    value: EnumSourceType.S3URL,
    en_desc: "Select S3 folder and ingest images from the S3 bucket.",
    "zh-CN_desc": "选择 S3 文件夹并从 S3 存储桶中获取图像。",
  },
];

export const PREDICT_TYPE = [
  {
    id: 1,
    en_title: "Web camera ",
    "zh-CN_title": "网络摄像头",
    value: EnumSourceType.WEBCAMERA,
    en_desc:
      "Deliver all types of content (including streaming). This is the most common choice.",
    "zh-CN_desc": "交付所有类型的内容（包括流式传输）。这是最常见的选择",
  },
  {
    id: 2,
    en_title: "Upload Image",
    "zh-CN_title": "上传文件",
    value: EnumSourceType.UPLOAD,
    en_desc:
      "Upload images from local filepath, the images will be upload via brower",
    "zh-CN_desc": "从本地文件路径上传图片，图片将通过浏览器上传。",
  },
];
