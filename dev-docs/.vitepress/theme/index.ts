import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import ApiPlayground from "./components/ApiPlayground.vue";
import DemoIframe from "./components/DemoIframe.vue";
import ModuleCard from "./components/ModuleCard.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ApiPlayground", ApiPlayground);
    app.component("DemoIframe", DemoIframe);
    app.component("ModuleCard", ModuleCard);
  },
} satisfies Theme;
