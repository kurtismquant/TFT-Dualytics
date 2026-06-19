import postcssGlobalData from '@csstools/postcss-global-data'
import postcssCustomMedia from 'postcss-custom-media'

// Inject the shared @custom-media breakpoint definitions (src/styles/breakpoints.css)
// into every CSS Module, then resolve `@media (--bp-*)` queries to real media queries.
export default {
  plugins: [
    postcssGlobalData({
      files: ['./src/styles/breakpoints.css'],
    }),
    postcssCustomMedia(),
  ],
}
