import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copied from closet-widget during local startup/build; lint its source repo.
    "public/widget.js",
    // Historical one-off maintenance probes. They are not application or CI code.
    "check_gallery.js",
    "create_sites.ts",
    "fix-db.js",
    "fix-menu.js",
    "query_admin.js",
    "test-gemini.js",
    "test_admin_setup.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // These screens render user-selected blob/data URLs and editor previews;
    // Next Image cannot safely optimize those transient sources.
    files: [
      "src/app/dashboard/website/page.tsx",
      "src/app/intake/**/IntakeFormClient.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
