export type ToolCategory =
  | "navigate"
  | "click"
  | "type"
  | "scroll"
  | "read"
  | "search"
  | "tabs"
  | "vision"
  | "memory"
  | "content"
  | "keyboard"
  | "highlight"
  | "computer"
  | "thinking";

interface Illustration {
  icon: string;
  label: string;
  color: string;
  bg: string;
}

export const TOOL_ILLUSTRATIONS: Record<ToolCategory, Illustration> = {
  navigate: {
    icon: "🧭",
    label: "Navigating",
    color: "#4285F4",
    bg: "#e8f0fe",
  },
  click: {
    icon: "👆",
    label: "Clicking",
    color: "#EA4335",
    bg: "#fce8e6",
  },
  type: {
    icon: "⌨️",
    label: "Typing",
    color: "#34A853",
    bg: "#e6f4ea",
  },
  scroll: {
    icon: "📜",
    label: "Scrolling",
    color: "#FBBC05",
    bg: "#fef7e0",
  },
  read: {
    icon: "📖",
    label: "Reading page",
    color: "#4285F4",
    bg: "#e8f0fe",
  },
  search: {
    icon: "🔍",
    label: "Searching",
    color: "#9334E9",
    bg: "#f3e8ff",
  },
  tabs: {
    icon: "📑",
    label: "Managing tabs",
    color: "#4285F4",
    bg: "#e8f0fe",
  },
  vision: {
    icon: "👁️",
    label: "Looking at page",
    color: "#4285F4",
    bg: "#e8f0fe",
  },
  memory: {
    icon: "🧠",
    label: "Remembering",
    color: "#9334E9",
    bg: "#f3e8ff",
  },
  content: {
    icon: "✍️",
    label: "Processing content",
    color: "#34A853",
    bg: "#e6f4ea",
  },
  keyboard: {
    icon: "⌨️",
    label: "Pressing keys",
    color: "#34A853",
    bg: "#e6f4ea",
  },
  highlight: {
    icon: "✨",
    label: "Highlighting",
    color: "#FBBC05",
    bg: "#fef7e0",
  },
  computer: {
    icon: "🖥️",
    label: "Performing action",
    color: "#EA4335",
    bg: "#fce8e6",
  },
  thinking: {
    icon: "💭",
    label: "Thinking",
    color: "#747775",
    bg: "#f1f3f4",
  },
};

const TOOL_MAP: Record<string, ToolCategory> = {
  openTab: "navigate",
  getPageTitle: "read",
  getTabs: "tabs",
  switchTab: "tabs",
  getAccessibilitySnapshot: "vision",
  readPageContent: "read",
  findOnPage: "search",
  clickOn: "click",
  typeInto: "type",
  pressKey: "keyboard",
  scrollDown: "scroll",
  scrollUp: "scroll",
  scrollTo: "scroll",
  highlight: "highlight",
  computerAction: "computer",
  contentAction: "content",
  rememberThis: "memory",
  recallMemory: "memory",
  updateUserProfile: "memory",
};

export function getToolCategory(toolName: string): ToolCategory {
  return TOOL_MAP[toolName] || "thinking";
}
