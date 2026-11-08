// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const checkFile = require('eslint-plugin-check-file');
const fs = require('node:fs');
const path = require('node:path');

// Each folder in src/features gets its own zone, so a new feature is
// fenced off with no config change.
const features = fs.readdirSync(path.join(__dirname, 'src/features'));
const shared = ['components', 'hooks', 'lib', 'stores', 'theme', 'types', 'utils'].map(
  (dir) => `./src/${dir}`,
);

// The ADR 0012 margin rule and the ADR 0037 file system rule. Every
// block below that sets `no-restricted-syntax` or `no-restricted-imports`
// repeats them, because a later block replaces the options of an
// earlier one for every file both match.
const marginRule = {
  selector:
    'Property[key.name=/^margin(Top|Bottom|Left|Right|Vertical|Horizontal|Start|End)?$/], Property[key.value=/^margin(Top|Bottom|Left|Right|Vertical|Horizontal|Start|End)?$/]',
  message:
    'Spacing ownership: do not set a margin in a style. The container owns the gaps with `gap` or symmetric padding (see docs/adr/0012-spacing-ownership-rule.md).',
};
const fileSystemPath = {
  name: 'expo-file-system/legacy',
  message:
    'Only src/lib/vault/adapters/saf.ts imports it. Use the VaultAdapter from useVault() (ADR 0037).',
};

// Motion lives in surfaces (ADR 0046). Each list below is one ban, and
// the blocks further down combine them by folder.
const motionMessage = (what) => `${what} Use the surfaces in src/components/motion (ADR 0046).`;
const gestureHooks = [
  'GestureDetector',
  'InterceptingGestureDetector',
  'VirtualGestureDetector',
  'useCompetingGestures',
  'useExclusiveGestures',
  'useFlingGesture',
  'useHoverGesture',
  'useLongPressGesture',
  'useManualGesture',
  'useNativeGesture',
  'usePanGesture',
  'usePinchGesture',
  'useRotationGesture',
  'useSimultaneousGestures',
  'useTapGesture',
];
const oldMotionPaths = [
  {
    name: 'react-native',
    importNames: [
      'Animated',
      'PanResponder',
      'Pressable',
      'TouchableOpacity',
      'TouchableHighlight',
      'TouchableWithoutFeedback',
      'ScrollView',
    ],
    message: motionMessage(
      "React Native's animation, responder, press and scroll exports are retired. Press with gesture handler's Pressable, scroll with MotionScrollView.",
    ),
  },
  { name: '@/lib/swipe', importNames: ['swipeProps'], message: motionMessage('The swipe tripwire is retired.') },
];
const gestureBuilderPath = {
  name: 'react-native-gesture-handler',
  importNames: ['Gesture'],
  message: motionMessage('The gesture builder API is retired.'),
};
const workletPaths = [
  { name: 'react-native-worklets', message: motionMessage('Only the motion folders cross threads.') },
  {
    name: 'react-native-gesture-handler',
    importNames: gestureHooks,
    message: motionMessage('Only the motion folders build gestures.'),
  },
];
const internalPattern = {
  group: ['@/components/motion/internal', '@/components/motion/internal/*'],
  message: motionMessage('The internal folder is private to src/components/motion.'),
};
const featurePaths = (allowGestures) => [
  { name: 'react-native-reanimated', message: motionMessage('Features and routes write no worklet.') },
  { name: 'react-native-worklets', message: motionMessage('Features and routes write no worklet.') },
  {
    name: 'react-native-gesture-handler',
    allowImportNames: ['Pressable', ...allowGestures],
    message: motionMessage('Features and routes import only Pressable from gesture handler.'),
  },
  {
    name: '@/lib/motion/entrances',
    allowImportNames: ['markLanded'],
    message: motionMessage('Features import only markLanded from the entrances.'),
  },
  {
    name: '@/lib/motion/progress',
    allowImportNames: ['useProgress', 'Progress'],
    message: motionMessage('Features import only useProgress and Progress from the clocks.'),
  },
];
const featurePattern = {
  regex: '^@/lib/motion/(?!(tokens|entrances|progress)$)',
  message: motionMessage('Features import only the tokens, the landed mark and the clock from lib/motion.'),
};

/** The `no-restricted-imports` options for one folder. */
function importBans({ fileSystem = true, internal = true, worklets = true, feature = null }) {
  const paths = [...oldMotionPaths];
  if (fileSystem) {
    paths.push(fileSystemPath);
  }
  // A feature bans every gesture handler export but Pressable, which
  // covers the builder and the hooks, so each banned import reports once.
  if (feature) {
    paths.push(...featurePaths(feature.allowGestures));
  } else {
    paths.push(gestureBuilderPath);
    if (worklets) {
      paths.push(...workletPaths);
    }
  }
  const patterns = [];
  if (internal) {
    patterns.push(internalPattern);
  }
  if (feature) {
    patterns.push(featurePattern);
  }
  return ['error', { paths, patterns }];
}

const touchListenerRule = {
  selector: "CallExpression[callee.property.name='addEventListener'][arguments.0.value=/^touch/]",
  message: motionMessage('Only MotionScrollView listens for touches.'),
};
const motionSyntaxRules = [
  {
    selector: 'JSXAttribute[name.name=/^onPointer(Down|Move|Up|Cancel)$/]',
    message: motionMessage('Gesture handler reads the pointer.'),
  },
  {
    selector: 'ObjectExpression > Property[key.name=/^onPointer(Down|Move|Up|Cancel)$/]',
    message: motionMessage('Gesture handler reads the pointer.'),
  },
  {
    selector: "MemberExpression[object.name='AccessibilityInfo'][property.name='isReduceMotionEnabled']",
    message: motionMessage("Every animation passes ReduceMotion.System; read the switch with Reanimated's useReducedMotion."),
  },
  {
    selector:
      "JSXOpeningElement[name.name=/^(SectionList|FlatList)$/]:not(:has(JSXAttribute[name.name='renderScrollComponent']))",
    message: motionMessage('A list scrolls with renderScrollComponent={renderMotionScroll}.'),
  },
];

// Today's users of the old motion paths. Each port ticket (0059 to
// 0062) removes its own files, and the port that empties the list
// deletes it. They keep the margin and file system rules.
const motionAllowlist = [
  'src/lib/motion/legacy.ts',
  // 0059
  'src/components/swipe-pager.tsx',
  'src/components/ui/tab-strip.tsx',
  'src/features/lists/components/list-notices.tsx',
  'src/features/planner/components/month-grid.tsx',
  'src/features/planner/components/month-pane.tsx',
  'src/features/planner/components/month-view.tsx',
  'src/features/planner/components/period-strip.tsx',
  'src/lib/swipe.test.ts',
  'src/lib/swipe.ts',
  // 0059, then 0060
  'src/features/lists/lists-screen.tsx',
  // 0059, then 0061
  'src/features/planner/components/day/day-spread.tsx',
  // 0060
  'src/components/task-row.tsx',
  'src/components/ui/card-group-row.tsx',
  'src/features/lists/components/reorder-ghost.tsx',
  'src/features/lists/components/reorder-row.tsx',
  'src/features/lists/components/task-card-row.test.tsx',
  'src/features/lists/components/task-card-row.tsx',
  'src/features/lists/hooks/use-row-reorder.ts',
  // 0061
  'src/features/planner/components/day/overdue-group.tsx',
  'src/features/planner/components/day/split-handle.tsx',
  'src/features/planner/components/day/timeline-pane.tsx',
  'src/features/planner/components/drag-ghost.tsx',
  'src/features/planner/components/drag.tsx',
  'src/features/planner/components/source-toggle.tsx',
  'src/features/planner/components/task-list-section.tsx',
  'src/features/planner/components/task-pills.tsx',
  'src/features/planner/components/timeline.tsx',
  'src/features/planner/components/week-view.tsx',
  'src/features/planner/hooks/use-drag-session.ts',
  'src/features/planner/hooks/use-split-pane.ts',
  'src/features/planner/hooks/use-touch-drag-gate.ts',
  // 0062
  'src/components/bottom-bar/bottom-bar.tsx',
  'src/components/ui/sheet.tsx',
  'src/features/capture/components/capture-dock.tsx',
  'src/features/capture/hooks/use-capture-sheet.ts',
];

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Spacing ownership (docs/adr/0012): a child never declares
      // spacing outside itself, so no style sets a margin on any side.
      // The container owns the gaps: a `gap`, or symmetric padding.
      'no-restricted-syntax': ['error', marginRule],
    },
  },
  {
    // Import boundaries (ADR 0039): code flows from the shared folders
    // to the features to the routes, and type-only imports count. The
    // node resolver from eslint-config-expo cannot read the `@/` alias,
    // and the zones then skip those imports without a word, so the
    // TypeScript resolver comes first.
    files: ['src/**/*.{ts,tsx}'],
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            ...features.map((name) => ({
              target: `./src/features/${name}`,
              from: './src/features',
              except: [`./${name}`],
              message: 'A feature never imports another feature (ADR 0039).',
            })),
            {
              target: './src/features',
              from: './src/app',
              message: 'A feature never imports a route (ADR 0039).',
            },
            {
              target: shared,
              from: ['./src/features', './src/app'],
              message: 'Shared code never imports a feature or a route (ADR 0039).',
            },
            {
              target: ['./src/lib', './src/utils', './src/types', './src/theme'],
              from: ['./src/components', './src/hooks', './src/stores'],
              message: 'lib, utils, types and theme sit at the bottom (ADR 0039).',
            },
          ],
        },
      ],
    },
  },
  {
    // Every file call goes through the vault adapter (ADR 0037), so
    // only the SAF adapter talks to the folder. Tests mock the module
    // with vi.mock, which is not an import. Motion lives in surfaces
    // (ADR 0046): no file in src uses the retired motion paths, and
    // only the motion folders cross threads or build gestures.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': importBans({}),
      'no-restricted-syntax': ['error', marginRule, ...motionSyntaxRules, touchListenerRule],
    },
  },
  {
    files: ['src/lib/vault/adapters/saf.ts'],
    rules: {
      'no-restricted-imports': importBans({ fileSystem: false }),
    },
  },
  {
    files: ['src/lib/motion/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': importBans({ worklets: false }),
    },
  },
  {
    files: ['src/components/motion/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': importBans({ internal: false, worklets: false }),
    },
  },
  {
    files: ['src/components/motion/scroll-view.tsx'],
    rules: {
      'no-restricted-syntax': ['error', marginRule, ...motionSyntaxRules],
    },
  },
  {
    // Features and routes write no worklet. They pass data and plain
    // functions to the surfaces.
    files: ['src/features/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': importBans({ feature: { allowGestures: [] } }),
    },
  },
  {
    files: ['src/app/_layout.tsx'],
    rules: {
      'no-restricted-imports': importBans({
        feature: { allowGestures: ['GestureHandlerRootView'] },
      }),
    },
  },
  {
    files: motionAllowlist,
    rules: {
      'no-restricted-imports': ['error', { paths: [fileSystemPath] }],
      'no-restricted-syntax': ['error', marginRule],
    },
  },
  {
    // File and folder names use kebab-case (ADR 0039). Route files
    // under src/app keep the names expo-router needs.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/**'],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { 'src/**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { 'src/!(app)/**/': 'KEBAB_CASE' }],
    },
  },
  {
    // A test declares its vi.mock calls first and imports the modules
    // they replace after them, so the reader sees the mocks first.
    // Vitest hoists the mocks either way.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'import/first': 'off',
    },
  },
  {
    // The Playwright suite holds no React code. Its fixtures hand
    // their value on through a callback named `use`, which the hooks
    // rule would read as React's `use`.
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    ignores: ['dist/*', 'e2e/playwright-report/*', 'e2e/test-results/*'],
  },
]);

