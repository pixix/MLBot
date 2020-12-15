import React from "react";
import "./TopBar.scss";

import Logo from "../assets/images/logo.svg";
import AlertIcon from "../assets/images/alert-icon.svg";

const TopBar: React.FC = () => {
  return (
    <div className="drh-top-bar">
      <div className="logo">
        <img alt="AWS Solutions" src={Logo} />
      </div>
      <div className="options">
        {/* <div className="item">Language</div> */}
        <div className="user-item">
          <img alt="alert" src={AlertIcon} />
          {/* {curUserEmail} */}
          Admin
        </div>
      </div>
    </div>
  );
};

export default TopBar;
