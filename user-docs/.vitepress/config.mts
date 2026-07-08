import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
//
// This is the END-USER MANUAL site (product-facing, task-oriented how-to pages) —
// a sibling to dev-docs/ (engineer-facing: architecture, API, whitepaper). It ships
// as a minimal, BUILDABLE skeleton; fill in real per-product content with the
// `user-guide-builder` skill (screenshot-backed walkthroughs of each page/feature).
//
// Rename "Your Product" below (and everywhere else in this file) once you've
// rebranded the app — see the `rebrand` skill / next-app/lib/branding.ts.
export default defineConfig({
  title: "Your Product — User Guide",
  description: "End-user manual for Your Product.",

  lang: "en-US",
  lastUpdated: true,
  cleanUrls: true,

  // Ignore localhost links and external placeholder URLs during build.
  ignoreDeadLinks: [/localhost/, /127\.0\.0\.1/, /your-app\.zeabur\.app/],

  head: [
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "Your Product — User Guide" }],
  ],

  themeConfig: {
    siteTitle: "Your Product Guide",

    nav: [{ text: "Guide", link: "/guide/" }],

    sidebar: {
      "/guide/": [
        {
          text: "User Guide",
          collapsed: false,
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Getting Started", link: "/guide/getting-started" },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/cloud-f1/ai-coding-nexjs-template",
      },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Your Product",
    },

    search: {
      provider: "local",
    },
  },
});
