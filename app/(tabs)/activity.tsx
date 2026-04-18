import { Stack } from 'expo-router'
import ActivityDetailScreen from '../../screens/ActivityDetailScreen'

export default function ActivityRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,   // ActivityDetailScreen has its own back handling
          
        }}
      />
      <ActivityDetailScreen />
    </>
  )
}