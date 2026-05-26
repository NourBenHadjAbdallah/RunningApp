// constants/tabBar.ts
// Import this in any screen that needs bottom padding to avoid the floating tab bar
// covering important content or buttons.
//
// Usage:
//   import { TAB_BAR_BOTTOM_PADDING } from '../../constants/tabBar'
//   ...
//   contentContainerStyle={{ paddingBottom: TAB_BAR_BOTTOM_PADDING }}

import { Platform } from 'react-native'

// Pill height + bottom safe area estimate + breathing room
export const BAR_HEIGHT             = 62
export const H_MARGIN               = 16
export const TAB_BAR_BOTTOM_PADDING = BAR_HEIGHT + (Platform.OS === 'ios' ? 34 : 24) + 12