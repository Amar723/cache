module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // React Navigation's `tabBarIcon` / `header*` options are render props that
    // legitimately return elements inline; the icon components themselves are
    // declared at module scope.
    'react/no-unstable-nested-components': ['warn', {allowAsProps: true}],
  },
};
