import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useDispatch } from "redux-react-hook";
import classNames from "classnames";
import { useTranslation } from "react-i18next";

import Breadcrumbs from "@material-ui/core/Breadcrumbs";
import NavigateNextIcon from "@material-ui/icons/NavigateNext";
import Typography from "@material-ui/core/Typography";
import MLink from "@material-ui/core/Link";

import LeftMenu from "../../common/LeftMenu";
import InfoBar from "../../common/InfoBar";
import InfoSpan from "../../common/InfoSpan";

import Bottom from "../../common/Bottom";
import Step from "./comps/Step";
import NextButton from "../../common/comp/PrimaryButton";
import TextButton from "../../common/comp/TextButton";
import ImageTips from "./image/ImageTips";

import "./Creation.scss";

import { TYPE_LIST, EnumTaskType } from "../../assets/types/index";
import { CUR_SUPPORT_LANGS } from "../../assets/config/const";

const StepOne: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [nameStr, setNameStr] = useState("en_name");

  useEffect(() => {
    if (CUR_SUPPORT_LANGS.indexOf(i18n.language) >= 0) {
      setNameStr(i18n.language + "_name");
    }
  }, [i18n.language]);

  const [taskType, setTaskType] = useState(EnumTaskType.IMAGE);

  const dispatch = useDispatch();
  const updateTmpTaskInfo = React.useCallback(() => {
    dispatch({ type: "update task info", taskInfo: { type: taskType } });
  }, [dispatch, taskType]);

  // TaskType 变化时变化tmptaskinfo
  useEffect(() => {
    updateTmpTaskInfo();
  }, [taskType, updateTmpTaskInfo]);

  const history = useHistory();
  const goToHomePage = () => {
    const toPath = "/";
    history.push({
      pathname: toPath,
    });
  };
  const goToStepTwo = () => {
    const toPath = "/create/step2/image";
    history.push({
      pathname: toPath,
    });
  };

  const changeDataType = (event: any) => {
    setTaskType(event.target.value);
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
              <Step curStep="one" />
            </div>
            <div className="creation-info">
              <div className="creation-title">
                {t("creation.step1.engineType")}
                <InfoSpan />
              </div>
              <div className="box-shadow">
                <div className="option">
                  <div className="option-title">
                    {t("creation.step1.engineOptions")}
                  </div>
                  <div className="option-list">
                    {TYPE_LIST.map((item: any, index) => {
                      const optionClass = classNames({
                        "option-list-item": true,
                        "hand-point": !item.disabled,
                        active: taskType === item.value,
                      });
                      return (
                        <div key={index} className={optionClass}>
                          <label>
                            <div>
                              <input
                                disabled={item.disabled}
                                onChange={changeDataType}
                                value={item.value}
                                checked={taskType === item.value}
                                name="option-type"
                                type="radio"
                              />
                              &nbsp;{item[nameStr]}
                            </div>
                            <div className="imgs">
                              <img alt={item[nameStr]} src={item.imageSrc} />
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <ImageTips />
                  </div>
                </div>
              </div>
              <div className="buttons">
                <TextButton onClick={goToHomePage}>
                  {t("btn.cancel")}
                </TextButton>
                <NextButton onClick={goToStepTwo}>{t("btn.next")}</NextButton>
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
