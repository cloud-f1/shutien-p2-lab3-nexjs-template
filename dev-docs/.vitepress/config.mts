import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: '@saas Template Docs',
  description:
    'Developer documentation, module catalog, whitepaper, API reference, and live demo gallery for the @saas Next.js modular registry SaaS template.',

  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,

  // Ignore localhost links and external URLs during build
  ignoreDeadLinks: [
    /localhost/,
    /127\.0\.0\.1/,
    /your-app\.zeabur\.app/,
  ],

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: '@saas Template Docs' }],
    [
      'meta',
      {
        name: 'og:description',
        content:
          'Production-ready Next.js SaaS template with modular registry, 3-tier RBAC, billing abstraction, and AI agent team.',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: '@saas Docs',

    nav: [
      { text: 'Dev Guide', link: '/docs/' },
      { text: 'Module Catalog', link: '/modules/' },
      {
        text: 'Whitepaper',
        items: [
          { text: 'English', link: '/whitepaper/en' },
          { text: '繁體中文', link: '/whitepaper/zh-TW' },
        ],
      },
      { text: 'API Reference', link: '/api/' },
      { text: 'Live Demo', link: '/demo/' },
    ],

    sidebar: {
      '/docs/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/docs/' },
            { text: 'Quick Start', link: '/docs/getting-started' },
            { text: 'API Guide', link: '/docs/api-guide' },
            { text: 'Deployment', link: '/docs/deployment' },
            { text: 'Testing', link: '/docs/testing' },
            { text: 'Changelog', link: '/docs/changelog' },
          ],
        },
        {
          text: 'Guides',
          collapsed: false,
          items: [
            { text: 'Quick Start', link: '/docs/guides/quickstart' },
            { text: 'First Epic Walkthrough', link: '/docs/guides/first-epic' },
            { text: 'Deploy Guide', link: '/docs/guides/deploy-guide' },
            { text: 'Fork Security Setup', link: '/docs/guides/fork-security' },
            { text: 'Memory System', link: '/docs/guides/memory-system' },
            { text: 'AI Agent Team', link: '/docs/guides/ai-agent-team' },
            { text: 'Custom Agents', link: '/docs/guides/custom-agents' },
            { text: 'Autopilot Mode', link: '/docs/guides/autopilot' },
            { text: 'Authoring a Module', link: '/docs/guides/authoring-a-module' },
            { text: 'Installing a Module via AI', link: '/docs/guides/ai-module-install' },
          ],
        },
        {
          text: 'Modules',
          collapsed: true,
          items: [
            { text: 'Landing', link: '/modules/landing' },
            { text: 'Account', link: '/modules/account' },
            { text: 'Admin', link: '/modules/admin' },
            { text: 'Billing — Stripe', link: '/modules/billing-stripe' },
            { text: 'Billing — ECPay 綠界', link: '/modules/billing-ecpay' },
            { text: 'Hello Module', link: '/modules/hello-module' },
          ],
        },
      ],
      '/modules/': [
        {
          text: 'Module Catalog',
          items: [{ text: 'All Modules', link: '/modules/' }],
        },
        {
          text: 'Phase 56 Modules',
          items: [
            { text: 'Landing Page', link: '/modules/landing' },
            { text: 'Account Settings', link: '/modules/account' },
            { text: 'Admin Dashboard', link: '/modules/admin' },
            { text: 'Billing — Stripe', link: '/modules/billing-stripe' },
            { text: 'Billing — ECPay 綠界', link: '/modules/billing-ecpay' },
            { text: 'Hello Module', link: '/modules/hello-module' },
          ],
        },
        {
          text: 'Module Guides',
          items: [
            { text: 'Authoring a Module', link: '/docs/guides/authoring-a-module' },
            { text: 'Installing via AI (MCP)', link: '/docs/guides/ai-module-install' },
          ],
        },
      ],
      '/whitepaper/': [
        {
          text: 'Whitepaper',
          items: [
            { text: 'English', link: '/whitepaper/en' },
            { text: '繁體中文', link: '/whitepaper/zh-TW' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Interactive Playground', link: '/api/playground' },
            { text: 'Health Check', link: '/api/health' },
            { text: 'Auth Endpoints', link: '/api/auth' },
            { text: 'Server Actions', link: '/api/server-actions' },
          ],
        },
      ],
      '/demo/': [
        {
          text: 'Live Demo Gallery',
          items: [
            { text: 'Overview', link: '/demo/' },
            { text: 'Landing Page', link: '/demo/landing' },
            { text: 'Dashboard', link: '/demo/dashboard' },
            { text: 'Account Settings', link: '/demo/account' },
            { text: 'Admin Panel', link: '/demo/admin' },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/qwedsazxc78/ai-coding-nexjs-template',
      },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 @saas Template',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern:
        'https://github.com/qwedsazxc78/ai-coding-nexjs-template/edit/main/dev-docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
