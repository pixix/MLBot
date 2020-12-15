import { createStore } from "redux";
import reducer from "./Reducer";

export interface IState {
  apiUrl: string;
  createTaskFlag: boolean;
  tmpTaskInfo: any;
  infoIsOpen?: boolean;
  isOpen: boolean;
  lastUpdated: number;
  todos: string[];
}

export type Action =
  | {
      type: "open side bar";
    }
  | {
      type: "close side bar";
    }
  | {
      type: "open info bar";
    }
  | {
      type: "close info bar";
    }
  | {
      type: "set api url";
      apiUrl: string;
    }
  | {
      type: "update task info";
      taskInfo: any;
    }
  | {
      type: "set create task flag";
    }
  | {
      type: "hide create task flag";
    }
  | {
      type: "add todo";
      todo: string;
    }
  | {
      type: "delete todo";
      index: number;
    };

export function makeStore(): any {
  return createStore(reducer, {
    apiUrl: "",
    createTaskFlag: false,
    tmpTaskInfo: {},
    infoIsOpen: false,
    isOpen: false,
    // isOpen: localStorage.getItem("drhIsOpen") ? true : false,
    lastUpdated: 0,
    todos: [],
  });
}
