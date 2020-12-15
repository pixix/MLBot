import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import Webcam from "react-webcam";
import axios from "axios";
import { createQueue } from "best-queue";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";

import Breadcrumbs from "@material-ui/core/Breadcrumbs";
import NavigateNextIcon from "@material-ui/icons/NavigateNext";
import Typography from "@material-ui/core/Typography";
import MLink from "@material-ui/core/Link";

import InfoSpan from "../../../common/InfoSpan";
import InfoBar from "../../../common/InfoBar";
import LeftMenu from "../../../common/LeftMenu";
import Bottom from "../../../common/Bottom";
import Step from "../comps/Step";
// import NextButton from "../../../common/comp/PrimaryButton";
import NormalButton from "../../../common/comp/NormalButton";
import TextButton from "../../../common/comp/TextButton";
import { useLongPress } from "use-long-press";

import {
  SOURCE_TYPE,
  PREDICT_TYPE,
  EnumSourceType,
  API_METHOD_LIST,
  TRAINING_STATUS_LIST,
  EnumClassficationStatus,
} from "../../../assets/types/index";
import {
  CUR_SUPPORT_LANGS,
  URL_ML_IMAGE_UPLOAD,
  URL_ML_IMAGE_TRANING,
  URL_ML_IMAGE_PREDICT,
  URL_ML_IMAGE_STATUS,
  API_URL_NAME,
} from "../../../assets/config/const";

import "../Creation.scss";
import PrimaryButton from "../../../common/comp/PrimaryButton";
import ProgressBar from "../../../common/comp/ProgressBar";
import InfoIcon from "../../../assets/images/info.svg";

const API_URL = window.localStorage.getItem(API_URL_NAME);

type ImageObjectType = {
  job: string;
  task: string;
  class: string;
  filename: string;
  data: string;
};

interface ModelInfo {
  videoId: string;
  openCamera: boolean;
  disabled: boolean;
  imageCount: number;
  modelName: string;
  inputType: string;
  imgList: Array<ImageObjectType>;
}

const StepOne: React.FC = () => {
  const webcamRef: any = React.useRef(null);
  const JOB_PREFIX = "ml-bot-image-classification-";
  const TASK_NAME = "image-classification";
  const [jobId, setJobId] = useState("");

  const defaultTxtValue = JSON.stringify(
    {
      inputFilePath: "s3:src/abcdsf-erwer-fbh",
      outputFilePath: "s3:des/gbclss-frwer-bdf",
    },
    null,
    2
  );

  useEffect(() => {
    const date = new Date();
    const formattedDate = format(date, "yyyy-MM-dd-HH-mm-ss");
    console.info("formattedDate:", formattedDate);
    setJobId(JOB_PREFIX + formattedDate + "-000");
  }, []);

  const predictVideo = {
    openCamera: true,
    videoId: "predict",
    inputType: "",
  };

  const [curImgData, setCurImgData] = useState({ data: "" });
  const [endPointStr, setEndpointStr] = useState("");
  const [predictImgData, setPredictImgData] = useState("");
  const [predictType, setPredictType] = useState("");
  const [showPredictVideo, setShowPredictVideo] = useState(false);
  const [resultList, setResultList] = useState([]);

  const [curStep, setCurStep] = useState(EnumClassficationStatus.INIT);
  const [resStatusList, setResStatusList] = useState([]);
  const [longPress, setLongPress] = useState(false);
  const [curClassIndex, setCurClassIndex] = useState(0);
  const [showMask, setShowMask] = useState(true);
  const [modelURL, setModelURL] = useState("");

  const [modelList, setModelList] = useState<ModelInfo[]>([
    {
      modelName: "class_1",
      disabled: false,
      inputType: "",
      openCamera: false,
      imageCount: 0,
      videoId: "video1",
      imgList: [],
    },
  ]);

  const { t, i18n } = useTranslation();

  const [titleStr, setTitleStr] = useState("en_title");
  const [descStr, setDescStr] = useState("en_desc");
  const [statusNameStr, setStatusNameStr] = useState("en_Status");
  const [statusDescStr, setStatusDescStr] = useState("en_StatusMessage");

  useEffect(() => {
    if (CUR_SUPPORT_LANGS.indexOf(i18n.language) >= 0) {
      setTitleStr(i18n.language + "_title");
      setDescStr(i18n.language + "_desc");
      setStatusNameStr(i18n.language + "_Status");
      setStatusDescStr(i18n.language + "_StatusMessage");
    }
  }, [i18n.language]);

  const addAnotherClass = () => {
    console.info("add another class");
    const tmpList = [...modelList];
    tmpList.push({
      modelName: "class_" + (modelList.length + 1),
      disabled: false,
      inputType: "",
      openCamera: false,
      imageCount: 0,
      videoId: "video" + (modelList.length + 1),
      imgList: [],
    });
    setModelList(tmpList);
  };

  const handleNameChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const { name, value } = event.target;
    const tmpList = [...modelList] as any;
    tmpList[index][name] = value;
    setModelList(tmpList);
  };

  const changeSourceType = (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    setShowPredictVideo(false);
    const { name, value } = event.target;
    const tmpList = [...modelList] as any;
    tmpList.forEach((element: ModelInfo, index: number) => {
      // set other camera turned off
      element.openCamera = false;
    });
    if (value === EnumSourceType.WEBCAMERA) {
      tmpList[index]["openCamera"] = true;
    } else {
      tmpList[index]["openCamera"] = false;
    }
    tmpList[index]["inputType"] = value;
    tmpList[index][name] = value;
    setModelList(tmpList);
  };

  const showModelVideo = (index: number) => {
    setCurImgData({ data: "" });
    // console.info("AA");
    setShowPredictVideo(false);
    const tmpList = [...modelList] as any;
    tmpList.forEach((element: ModelInfo, index: number) => {
      // set other camera turned off
      element.openCamera = false;
    });
    tmpList[index]["openCamera"] = true;
    setModelList(tmpList);
  };

  const videoConstraints = {
    width: 224,
    height: 224,
    screenshotFormat: "image/jepg",
    screenshotQuality: 0.8,
    audio: false,
    facingMode: "user",
  };

  const asyncTask = useCallback(() => {
    const jsonStr = JSON.stringify(curImgData);
    return new Promise((r) => {
      if (curImgData.data && longPress) {
        console.info("UPLOAD IMAGE");
        axios.post(API_URL + URL_ML_IMAGE_UPLOAD, jsonStr).then((res) => {
          // console.info("res:", res);
        });
      }
    });
  }, [curImgData, longPress]);

  const queue = createQueue({
    max: 20,
  });

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      console.info("curClassIndex:", curClassIndex);
      const tmpModelList = [...modelList];
      const objectData = {
        job: jobId,
        task: TASK_NAME,
        class: modelList[curClassIndex].modelName,
        filename: `${modelList[curClassIndex].modelName}_${uuidv4()}.jpg`,
        data: imageSrc,
      };
      // console.info("objectData:", objectData);
      setCurImgData(objectData);
      // Disabled Input
      tmpModelList[curClassIndex].disabled = true;
      // Add Image Count
      tmpModelList[curClassIndex].imageCount++;
      tmpModelList[curClassIndex].imgList.unshift(objectData);
      setModelList(JSON.parse(JSON.stringify(tmpModelList)));
      queue.add(asyncTask, 1);
      queue.run();
    }
  }, [asyncTask, curClassIndex, jobId, modelList, queue]);

  useEffect(() => {
    if (longPress) {
      const id = setInterval(() => {
        capture();
      }, 50);
      return () => clearInterval(id);
    }
  }, [capture, curClassIndex, longPress]);

  const callback: any = useCallback((event: any) => {
    const curIndex = event.target.getAttribute("data-id")
      ? event.target.getAttribute("data-id")
      : event.target.parentNode.getAttribute("data-id");
    setCurClassIndex(curIndex);
    console.info("Long pressed!");
  }, []);
  const bind = useLongPress(callback, {
    onStart: (event: any) => {
      const curIndex = event.target.getAttribute("data-id")
        ? event.target.getAttribute("data-id")
        : event.target.parentNode.getAttribute("data-id");
      setCurClassIndex(curIndex);
      console.log("Press started");
      setLongPress(true);
    },
    onFinish: (event: any) => {
      setLongPress(false);
      queue.pause();
      queue.clear();
      console.log("Long press finished");
    },
    onCancel: (event: any) => {
      setLongPress(false);
      queue.pause();
      queue.clear();
      console.log("Press cancelled");
    },
    threshold: 300,
    captureEvent: true,
  });

  let inteval: any = "";
  const getTraningStatus = (endpoint: any) => {
    const traningStatusObj = {
      endpoint: endpoint,
    };
    const traningStatusParamStr = JSON.stringify(traningStatusObj);
    axios
      .post(API_URL + URL_ML_IMAGE_STATUS, traningStatusParamStr)
      .then((res: any) => {
        const restTrainJobStatus = res.data.TrainingJobStatus;
        const resEndpointStatus = res.data.EndpointStatus;
        const modelArtifacts = res.data.ModelArtifacts;
        // Endpoint Status:  NotStarted/Creating/InService
        if (resEndpointStatus === "InService") {
          restTrainJobStatus.push(resEndpointStatus);
        }
        // const tmpResStatusList = restTrainJobStatus.push(resEndpointStatus);
        console.info("restTrainJobStatus:", restTrainJobStatus);
        setResStatusList(restTrainJobStatus);
        if (restTrainJobStatus.indexOf("Failed") >= 0) {
          clearInterval(inteval);
        }
        if (restTrainJobStatus.length >= 6) {
          setModelURL(modelArtifacts);
          clearInterval(inteval);
          setShowMask(false);
        }
      });
  };

  const startStatusInterval = (endpoint: any) => {
    inteval = setInterval(() => {
      getTraningStatus(endpoint);
    }, 5000) as any;
  };

  const startToTranning = () => {
    console.info("startToTranning");
    if (modelList.length < 2) {
      alert("At least 2 class.");
      return;
    }
    setCurImgData({ data: "" });
    const trainingParamObj = {
      job: jobId,
      task: TASK_NAME,
    };
    const traningParamStr = JSON.stringify(trainingParamObj);
    axios
      .post(API_URL + URL_ML_IMAGE_TRANING, traningParamStr)
      .then((res: any) => {
        console.info("startToTranning=>res:", res);
        setEndpointStr(res.data.TrainingJob);
        setCurStep(EnumClassficationStatus.TRAINING);
        startStatusInterval(res.data.TrainingJob);
      });
  };

  const predictResult = () => {
    console.info("predictResult");
    const imageSrc = webcamRef.current.getScreenshot();
    setPredictImgData(imageSrc);
    const imageDataParam = {
      endpoint: endPointStr,
      imagedata: imageSrc,
    };
    const imageDataParamStr = JSON.stringify(imageDataParam);
    axios
      .post(API_URL + URL_ML_IMAGE_PREDICT, imageDataParamStr)
      .then((res: any) => {
        console.info("res:", res);
        setResultList(res.data.Results);
      });
  };

  const turnOffModelVides = () => {
    const tmpModelList = [...modelList];
    tmpModelList.forEach((element) => {
      element.openCamera = false;
    });
    setModelList(tmpModelList);
  };

  const changePredictType = (event: React.ChangeEvent<HTMLInputElement>) => {
    turnOffModelVides();
    if (event.target.value === EnumSourceType.WEBCAMERA) {
      setShowPredictVideo(true);
    }
    setPredictType(event.target.value);
  };

  const turnOnPredictVideo = () => {
    turnOffModelVides();
    setShowPredictVideo(true);
  };

  const changeMethodType = () => {
    console.info("changeMethodType");
  };

  return (
    <div className="drh-page">
      <LeftMenu />
      <div className="right">
        <InfoBar />
        <div className="padding-left-40">
          <div className="page-breadcrumb">
            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" />}
              aria-label="breadcrumb"
            >
              <MLink color="inherit" href="/#/">
                {t("breadCrumb.home")}
              </MLink>
              <Typography color="textPrimary">
                {t("breadCrumb.create")}
              </Typography>
            </Breadcrumbs>
          </div>
          <div className="creation-content">
            <div className="creation-step">
              <Step curStep="two" />
            </div>
            <div className="creation-info">
              <div className="creation-title">
                {t("creation.step2.image.title")}
                <InfoSpan />
              </div>
              <div className="desc">{t("creation.step2.image.desc")}</div>
              {/* <div>{<pre>{JSON.stringify(modelList, null, 2)}</pre>}</div> */}
              <div className="box-shadow card-list">
                <div className="option">
                  <div className="option-title">
                    {t("creation.step2.image.step1.name")}
                  </div>
                  <div className="option-content">
                    {modelList.map((element: any, index: number) => {
                      return (
                        <div key={index} className="model-list">
                          <div className="category-name">
                            {t("creation.step2.image.step1.className")}
                            <InfoSpan />
                          </div>
                          <div className="category-desc">
                            {t("creation.step2.image.step1.enterName")}
                          </div>
                          <div className="input">
                            <input
                              disabled={element.disabled}
                              className="option-input"
                              name="modelName"
                              type="text"
                              onChange={(e) => {
                                handleNameChange(e, index);
                              }}
                              value={element.modelName}
                              placeholder="Model Name"
                            />
                          </div>
                          <div>
                            <div className="upload-title">
                              {t("creation.step2.image.step1.uploadImage")}
                              <InfoSpan />
                            </div>
                            {SOURCE_TYPE.map((item: any, typIndex: any) => {
                              const stClass = classNames({
                                "st-item": true,
                                active: element.inputType === item.value,
                              });
                              return (
                                <div key={typIndex} className={stClass}>
                                  <label>
                                    <div>
                                      <input
                                        // defaultValue={formDefaultValue.sourceType}
                                        onChange={(e) => {
                                          changeSourceType(e, index);
                                        }}
                                        value={item.value}
                                        checked={
                                          element.inputType === item.value
                                        }
                                        name={`inputType_${index}`}
                                        type="radio"
                                      />
                                      {item[titleStr]}
                                    </div>
                                    <div className="desc">{item[descStr]}</div>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                          <div>
                            {element.inputType === EnumSourceType.S3URL && (
                              <div className="s3-content">
                                <div className="s3-title">
                                  {t("creation.step2.image.step1.s3Bucket")}
                                </div>
                                <div className="s3-desc">
                                  {t("creation.step2.image.step1.s3BucketDesc")}
                                </div>
                                <div className="select-wrap">
                                  <select
                                    placeholder="Choose an S3 Bucket"
                                    className="option-input"
                                  >
                                    <option style={{ color: "#ccc" }}>
                                      {t(
                                        "creation.step2.image.step1.chooseS3Bucket"
                                      )}
                                    </option>
                                    <option>bucket-us-west-1</option>
                                    <option>bucket-us-east-1</option>
                                  </select>
                                </div>
                              </div>
                            )}
                            {element.inputType === EnumSourceType.WEBCAMERA && (
                              <div className="webcam-content">
                                <div className="video">
                                  {element.openCamera ? (
                                    <div className="video-info">
                                      <Webcam
                                        id={element.videoId}
                                        audio={false}
                                        width={224}
                                        height={224}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        videoConstraints={videoConstraints}
                                      />
                                      <div className="text-center">
                                        <PrimaryButton
                                          data-id={index}
                                          className="full-width"
                                          {...bind}
                                        >
                                          {t(
                                            "creation.step2.image.step1.holdToRecord"
                                          )}
                                        </PrimaryButton>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="video-thumb">
                                      <TextButton
                                        className="full-width"
                                        onClick={() => showModelVideo(index)}
                                      >
                                        {t(
                                          "creation.step2.image.step1.enableVideo"
                                        )}
                                      </TextButton>
                                    </div>
                                  )}
                                </div>
                                <div className="image-list">
                                  <div className="image-count">
                                    {element.imageCount}{" "}
                                    {t(
                                      "creation.step2.image.step1.imageSamples"
                                    )}
                                  </div>
                                  <div className="image-items">
                                    {element.imgList.map(
                                      (
                                        image: ImageObjectType,
                                        index: number
                                      ) => {
                                        return (
                                          <div key={index} className="item">
                                            <img alt="" src={image.data} />
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="add-another-class">
                    <span
                      onClick={() => {
                        addAnotherClass();
                      }}
                    >
                      <i>▸</i> {t("creation.step2.image.step1.addAnotherClass")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="box-shadow card-list">
                <div className="option">
                  <div className="option-title">
                    {t("creation.step2.image.step2.name")}
                  </div>
                  <div className="option-content padding-20">
                    <div className="option-tranning">
                      <div className="button">
                        <NormalButton onClick={startToTranning}>
                          {t("btn.startTraining")}
                        </NormalButton>
                        <div className="tips">
                          * {t("creation.step2.image.step2.time")}
                        </div>
                      </div>
                      <div className="times">
                        {curStep === EnumClassficationStatus.TRAINING && (
                          <div className="inner">
                            {TRAINING_STATUS_LIST.map(
                              (status: any, index: number) => {
                                let curClassName = "normal";
                                if (index === resStatusList.length - 1) {
                                  curClassName = "normal";
                                }
                                if (index < resStatusList.length) {
                                  curClassName = "success";
                                }
                                if (index > resStatusList.length) {
                                  curClassName = "gray";
                                }
                                if (resStatusList[index] === "Failed") {
                                  curClassName = "error";
                                }
                                return (
                                  <div className={curClassName} key={index}>
                                    {curClassName === "error"
                                      ? "Failed"
                                      : status[statusNameStr]}{" "}
                                    <span className="desc">
                                      ({status[statusDescStr]})
                                    </span>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="add-another-class border-top-1px-eee">
                    <span>
                      <i>▸</i> {t("creation.step2.image.advancedSetting")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="box-shadow card-list p-relative">
                {showMask && (
                  <div className="p-cover">
                    {t("creation.step2.image.step3.ready")}
                  </div>
                )}
                <div className="option">
                  <div className="option-title">
                    {t("creation.step2.image.step3.name")} <InfoSpan />
                    <div className="title-desc">
                      {t("creation.step2.image.step3.desc")}
                    </div>
                  </div>
                  <div className="option-content padding-20">
                    <div>
                      <div className="upload-title">
                        {t("creation.step2.image.step3.upload")} <InfoSpan />
                      </div>
                      {PREDICT_TYPE.map((item: any, typIndex: any) => {
                        const stClass = classNames({
                          "st-item": true,
                          active: predictType === item.value,
                        });
                        return (
                          <div key={typIndex} className={stClass}>
                            <label>
                              <div>
                                <input
                                  onChange={(e) => {
                                    changePredictType(e);
                                  }}
                                  // defaultValue={formDefaultValue.sourceType}
                                  value={item.value}
                                  checked={predictType === item.value}
                                  name="predictImageType"
                                  type="radio"
                                />
                                {item[titleStr]}
                              </div>
                              <div className="desc">{item[descStr]}</div>
                            </label>
                          </div>
                        );
                      })}
                      {predictType === EnumSourceType.WEBCAMERA && (
                        <div className="webcam-content">
                          <div className="video">
                            {showPredictVideo ? (
                              <div className="video-info">
                                <div className="web-cam">
                                  <Webcam
                                    id={predictVideo.videoId}
                                    audio={false}
                                    width={224}
                                    height={224}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={videoConstraints}
                                  />
                                </div>
                                <div className="text-center">
                                  <PrimaryButton
                                    className="full-width"
                                    onClick={() => predictResult()}
                                  >
                                    {t("btn.clickPredict")}
                                  </PrimaryButton>
                                </div>
                              </div>
                            ) : (
                              <div className="video-thumb">
                                <TextButton
                                  onClick={turnOnPredictVideo}
                                  className="full-width"
                                >
                                  {t("btn.enableVideo")}
                                </TextButton>
                              </div>
                            )}
                          </div>
                          <div className="preview-image">
                            {predictImgData && (
                              <div>
                                <img width="220" alt="" src={predictImgData} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {predictType === EnumSourceType.UPLOAD && (
                        <div className="text-center padding-20">
                          <NormalButton>{t("btn.upload")}</NormalButton>
                        </div>
                      )}
                    </div>

                    <div className="predict-result-list">
                      {resultList.map((element: any, index: number) => {
                        return (
                          <div key={index} className="result-item">
                            <div className="predict-icon">
                              <div>
                                <img width="20" alt="" src={InfoIcon} />
                              </div>
                            </div>
                            <div className="predict-res">
                              <div className="result-name">{element.Class}</div>
                              <div className="progress-wrap">
                                <div className="bar">
                                  <ProgressBar
                                    value={
                                      parseFloat(element.Probability) * 100
                                    }
                                  />
                                </div>
                                <div className="value">
                                  {(
                                    parseFloat(element.Probability) * 100
                                  ).toFixed(2)}
                                  %
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-right">
                      <div className="download-button">
                        <a
                          rel="noopener noreferrer"
                          target="_blank"
                          className="no-underline"
                          href={modelURL}
                        >
                          <PrimaryButton>
                            {t("btn.downloadModel")}
                          </PrimaryButton>
                        </a>
                      </div>
                      <div className="download-tips">
                        {t("creation.step2.image.step3.chooseS3")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="box-shadow card-list no-show">
                <div className="option">
                  <div className="option-title">
                    {t("creation.step2.image.step4.name")}
                    <div className="title-desc">
                      {t("creation.step2.image.step4.desc")}
                    </div>
                  </div>
                  <div className="option-content padding-20">
                    <div className="option-tranning">
                      <div className="button">
                        <NormalButton>{t("btn.launchStack")}</NormalButton>
                      </div>
                      <div className="times">
                        {t("creation.step2.image.step4.expectMin")}
                      </div>
                    </div>
                  </div>
                  <div className="add-another-class border-top-1px-eee">
                    <span>
                      <i>▸</i> {t("creation.step2.image.advancedSetting")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="box-shadow card-list no-show">
                <div className="option">
                  <div className="option-title">
                    {t("creation.step2.image.step5.name")}
                    <div className="title-desc">
                      {t("creation.step2.image.step5.desc")}
                    </div>
                  </div>
                  <div className="option-content padding-20">
                    <div className="option-tranning">
                      <div className="api-types">
                        <div className="api-title">
                          {t("creation.step2.image.step5.restApi")}
                        </div>
                        <div className="api-list">
                          {API_METHOD_LIST.map(
                            (element: any, index: number) => {
                              return (
                                <div key={index} className="api-item">
                                  <label>
                                    <input
                                      onChange={() => {
                                        changeMethodType();
                                      }}
                                      name="apiType"
                                      value={element.value}
                                      type="radio"
                                    />
                                    {element.name}
                                  </label>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                      <div className="api-output">
                        <div className="endpoint">
                          {t("creation.step2.image.step5.endPoint")}:
                          https://aws-solutions-public-endpoint/ml-bot/image-classification
                          <div className="info-span">
                            <InfoSpan />
                          </div>
                        </div>
                        <div className="point-desc">
                          {t("creation.step2.image.step5.publicEndpoint")}
                        </div>
                        <textarea
                          defaultValue={defaultTxtValue}
                          rows={10}
                          style={{ width: "100%" }}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                  <div className="add-another-class border-top-1px-eee">
                    <span>
                      <i>▸</i> {t("creation.step2.image.step5.exploreMore")})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bottom">
          <Bottom />
        </div>
      </div>
    </div>
  );
};

export default StepOne;
