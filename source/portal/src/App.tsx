import React, { useEffect, Suspense, useState } from "react";
import axios from "axios";
import { withTranslation } from "react-i18next";
import { HashRouter, Route } from "react-router-dom";
import { useDispatch } from "redux-react-hook";

import DataLoading from "./common/Loading";
import TopBar from "./common/TopBar";

import Home from "./pages/home/Home";
import StepOne from "./pages/creation/StepOne";
import StepTwoImage from "./pages/creation/image/StepTwoImage";
import { API_URL_NAME } from "./assets/config/const";

import "./App.scss";

const HomePage = withTranslation()(Home);
const StepOnePage = withTranslation()(StepOne);
const StepTwoImagePage = withTranslation()(StepTwoImage);

// loading component for suspense fallback
const Loader = () => (
  <div className="App">
    <div className="app-loading">
      <DataLoading />
      AWS ML-Bot is loading...
    </div>
  </div>
);

const App: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const timeStamp = new Date().getTime();
    axios.get("/aws-exports.json?timeStamp=" + timeStamp).then((res) => {
      const ConfigObj = res.data;
      console.info("ConfigObj.apiUrl:", ConfigObj.apiUrl);
      dispatch({ type: "set api url", apiUrl: ConfigObj.apiUrl });
      window.localStorage.setItem(API_URL_NAME, ConfigObj.apiUrl);
      setLoading(false);
    });
  }, [dispatch]);

  const [loading, setLoading] = useState(true);
  if (loading) {
    return <Loader />;
  }
  return (
    <div className="bp3-dark">
      <TopBar />
      <HashRouter>
        <Route path="/" exact component={HomePage}></Route>
        <Route path="/home" exact component={HomePage}></Route>
        <Route path="/create/step1" exact component={StepOnePage}></Route>
        <Route
          path="/create/step2/image"
          exact
          component={StepTwoImagePage}
        ></Route>
      </HashRouter>
    </div>
  );
};

const WithProvider = () => <App />;

// here app catches the suspense from page in case translations are not yet loaded
export default function RouterApp(): JSX.Element {
  return (
    <Suspense fallback={<Loader />}>
      <WithProvider />
    </Suspense>
  );
}
